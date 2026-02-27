# Story 1.7: Error Tracking, Monitoring & Deployment Config

Status: done

<!-- When this story contradicts project-context.md, project-context.md is authoritative. -->

## Story

As an **admin**,
I want automated error alerts, structured logging, and deployment configuration,
So that the platform is observable and deployable from day one.

## Acceptance Criteria

1. **Given** the backend is deployed, **When** an unhandled error occurs in the Fastify server or worker process, **Then** the error is captured and reported to Sentry with stack trace and request context (FR53).
2. **And** Sentry is configured with environment tags (development, staging, production).
3. **And** pino structured logging outputs JSON format compatible with Railway log aggregation (ARCH-24).
4. **And** Bull Board is scaffolded as a route for queue monitoring (empty queues at this stage; functional when queues are created in Epic 3).
5. **And** HTTPS/TLS is enforced on all endpoints (NFR-S3).
6. **And** a `docker-compose.yml` entry for Metabase (free tier) is included in the local dev setup, pre-configured to connect to the local PostgreSQL database for analytics queries.
7. **And** a `railway.toml` (or equivalent deployment config) defines all 6 services (api, worker, postgres, redis, webapp, website) with environment variable templates and start commands (ARCH-22).
8. **And** environment variable templates document all required config (DATABASE_URL, REDIS_URL, SENTRY_DSN, FLY_API_TOKEN, FIREBASE_CONFIG) without containing actual secrets.
9. **And** a deployment README documents the Railway service topology and deployment process.

## Tasks / Subtasks

- [x]Task 1: Install and configure Sentry for backend (AC: #1, #2)
  - [x]1.1 Install `@sentry/node` in backend:
    ```bash
    pnpm --filter backend add @sentry/node
    ```
    - `@sentry/node` v10.x — provides native Fastify support
    - Do NOT install `@sentry/fastify` separately — it's bundled in `@sentry/node` since v8

  - [x]1.2 Create `apps/backend/src/instrument.ts` — Sentry initialization:
    ```typescript
    import * as Sentry from '@sentry/node'

    const dsn = process.env['MCC_SENTRY_DSN']

    if (dsn) {
      Sentry.init({
        dsn,
        environment: process.env['NODE_ENV'] ?? 'development',
        // Only send errors in staging/production — skip in development/test
        enabled: process.env['NODE_ENV'] === 'production' || process.env['NODE_ENV'] === 'staging',
        tracesSampleRate: 0, // No performance monitoring for MVP (ARCH: "No custom APM for MVP")
      })
    }

    export { Sentry }
    ```
    - Named export `Sentry` for reuse in app.ts error handler
    - **CRITICAL:** `enabled: false` in development/test — prevents noise and test interference
    - `tracesSampleRate: 0` — architecture explicitly says no APM for MVP
    - Gracefully no-ops when `MCC_SENTRY_DSN` is not set (local dev without Sentry)

  - [x]1.3 Update `apps/backend/src/server.ts` — import instrument FIRST + Sentry flush on shutdown:
    ```typescript
    import { Sentry } from './instrument.js'  // Must be first — Sentry auto-instrumentation
    import { buildApp } from './app.js'

    async function start(): Promise<void> {
      const app = await buildApp()

      const port = Number(process.env['PORT'] ?? 3001)
      const host = process.env['HOST'] ?? '0.0.0.0'

      await app.listen({ port, host })

      for (const signal of ['SIGTERM', 'SIGINT'] as const) {
        process.on(signal, () => {
          app.log.info({ signal }, 'Shutting down')
          void (async () => {
            await Sentry.close(2000)
            await app.close()
            process.exit(0)
          })().catch(() => process.exit(1))
        })
      }
    }

    start().catch((err: unknown) => {
      // eslint-disable-next-line no-console
      console.error('Failed to start server:', err)
      process.exit(1)
    })
    ```
    - **Why first:** Sentry v10 hooks into Node.js module loading for auto-instrumentation. It must load before any other module to instrument `http`, `pg`, `ioredis`, etc.
    - The `.js` extension follows the project's existing NodeNext import pattern
    - `Sentry.close(2000)` flushes pending events with 2s timeout before shutdown
    - Uses `async/await` inside async IIFE — project-context bans `.then()` chains

  - [x]1.4 Update `apps/backend/src/worker/worker.ts` — import instrument FIRST + Sentry flush:
    ```typescript
    import { Sentry } from '../instrument.js'  // Must be first — Sentry auto-instrumentation
    import pino from 'pino'
    // ... rest of worker.ts unchanged, except shutdown:
    process.on(signal, () => {
      logger.info({ signal }, 'Worker shutting down')
      clearInterval(keepAlive)
      void (async () => {
        await Sentry.close(2000)
        process.exit(0)
      })()
    })
    ```

  - [x]1.5 Add custom error handler in `apps/backend/src/app.ts`:
    ```typescript
    import { Sentry } from './instrument.js'

    // After all plugin registrations, before returning fastify:
    fastify.setErrorHandler((error, request, reply) => {
      const statusCode = error.statusCode ?? 500

      if (statusCode >= 500) {
        Sentry.captureException(error, {
          extra: {
            method: request.method,
            url: request.url,
            params: request.params,
          },
        })
        request.log.error(error, 'Platform error')
      } else {
        request.log.warn(error, 'Client error')
      }

      reply.status(statusCode).send({
        error: {
          code: error.code ?? 'INTERNAL_ERROR',
          message: error.message,
        },
      })
    })
    ```
    - **Architecture pattern (verbatim):** 500+ → Sentry, response as `{ error: { code, message } }`
    - **Do NOT use `Sentry.setupFastifyErrorHandler()`** — it overrides our custom response format. We call `captureException` manually for control.
    - Request context (method, URL, params) included for debugging in Sentry
    - `request.log.error` uses Fastify's built-in pino logger (ARCH-24 logging levels)
    - User-code errors (SSE payloads) never reach this handler — they're 200 OK responses

  - [x]1.5a **Auth plugin exemption for admin routes** — Update `apps/backend/src/plugins/auth/index.ts`:
    ```typescript
    fastify.addHook('onRequest', async (request) => {
      if (request.url === '/health' || request.url.startsWith('/health?')) return
      if (request.url.startsWith('/admin')) return  // Admin routes use basic auth, not Firebase
      // TODO(story-2.1): Implement Firebase ID token verification
    })
    ```
    - **CRITICAL:** Without this, the auth plugin's global `onRequest` hook (registered via `fastify-plugin`) intercepts `/admin/queues` requests and returns 401 before basic auth can process them
    - Admin routes are protected by their own basic auth — they don't need Firebase auth

- [x]Task 2: Scaffold Bull Board for queue monitoring (AC: #4)
  - [x]2.1 Install Bull Board packages:
    ```bash
    pnpm --filter backend add @bull-board/api @bull-board/fastify @fastify/basic-auth
    ```
    - `@bull-board/api` v6.x — dashboard core
    - `@bull-board/fastify` v6.x — Fastify adapter
    - `@fastify/basic-auth` — protects admin route

  - [x]2.2 Create `apps/backend/src/plugins/admin/index.ts` — admin plugin with Bull Board:
    ```typescript
    import type { FastifyInstance } from 'fastify'
    import basicAuth from '@fastify/basic-auth'
    import { createBullBoard } from '@bull-board/api'
    import { FastifyAdapter } from '@bull-board/fastify'

    async function adminPlugin(fastify: FastifyInstance): Promise<void> {
      // Basic auth for /admin routes
      const adminUser = process.env['MCC_ADMIN_USER'] ?? 'admin'
      const adminPass = process.env['MCC_ADMIN_PASSWORD']

      if (!adminPass) {
        fastify.log.warn('MCC_ADMIN_PASSWORD not set — Bull Board disabled')
        return
      }

      await fastify.register(basicAuth, {
        validate: async (username, password, _req, _reply) => {
          if (username !== adminUser || password !== adminPass) {
            throw new Error('Unauthorized')
          }
        },
        authenticate: { realm: 'mycscompanion-admin' },
      })

      // Bull Board setup — empty queues, filled in Epic 3
      const serverAdapter = new FastifyAdapter()
      serverAdapter.setBasePath('/admin/queues')

      createBullBoard({
        queues: [], // Queues added dynamically in Epic 3 (Story 3.3)
        serverAdapter,
      })

      // Use setBasePath ONLY — do NOT also pass prefix, or routes will double-prefix
      await fastify.register(serverAdapter.registerPlugin())

      // Protect all routes in this plugin scope with basic auth
      fastify.addHook('onRequest', fastify.basicAuth)

      // TODO(story-10.x): Add POST /reload-prompts endpoint for tutor prompt hot-reload (FR56)
    }

    export { adminPlugin }
    ```
    - **Do NOT use `fastify-plugin` (fp) wrapper** — admin plugin must be SCOPED, not global. Using `fp()` would leak the `basicAuth` `onRequest` hook to ALL routes, breaking the API. Only the auth plugin uses `fp()` because its hook must be global.
    - **Do NOT use `export default`** — named exports only per project-context
    - **Architecture:** Bull Board at `/admin/queues` with basic auth
    - Empty queues array — functional dashboard that shows "no queues" until Epic 3
    - `MCC_ADMIN_PASSWORD` required — gracefully disables in local dev if not set
    - `basicAuth` validate signature requires 4 params: `(username, password, req, reply)` — prefix unused with `_`
    - Bull Board `setBasePath` sets the internal base path. Do NOT also pass `{ prefix: '/admin/queues' }` to `register()` — this would double-prefix to `/admin/queues/admin/queues`

  - [x]2.3 Register admin plugin in `apps/backend/src/app.ts`:
    ```typescript
    import { adminPlugin } from './plugins/admin/index.js'

    // Position 4: Admin tools (Bull Board) — after domain plugins, uses own auth (basic auth)
    await fastify.register(adminPlugin, { prefix: '/admin' })
    ```
    - Position: AFTER domain plugins, BEFORE `setErrorHandler` (error handler must be last)
    - `{ prefix: '/admin' }` scopes the plugin — Bull Board serves at `/admin/queues`
    - The plugin's `basicAuth` hook is scoped to `/admin/*` routes only (because we do NOT use `fastify-plugin`)

  - [x]2.4 Create `apps/backend/src/plugins/admin/` directory:
    - Only `index.ts` — barrel file IS the plugin (per project convention)
    - Do NOT create separate files for Bull Board — keep it minimal as a scaffold

- [x]Task 3: Verify pino structured logging (AC: #3)
  - [x]3.1 Verify current logging configuration is Railway-compatible:
    - `app.ts` already configures pino with JSON output in production (`transport: undefined` when NODE_ENV=production)
    - `pino-pretty` only used in non-production (dev convenience)
    - **No changes needed** — current config already satisfies ARCH-24
    - Verify by running: `NODE_ENV=production tsx src/server.ts` — output should be JSON lines

  - [x]3.2 Add `trustProxy: true` to Fastify config in `app.ts` (AC: #5 related):
    ```typescript
    const fastify = Fastify({
      logger: { /* existing config */ },
      trustProxy: true, // Trust Railway's reverse proxy for X-Forwarded-* headers
    })
    ```
    - Required for correct `request.protocol` (https) and client IP forwarding behind Railway's edge proxy

- [x]Task 4: HTTPS/TLS enforcement (AC: #5)
  - [x]4.1 **Railway handles TLS termination at the edge** — no app-level TLS configuration needed:
    - Railway automatically provisions TLS certificates for all services
    - The app receives plain HTTP from Railway's internal proxy
    - `trustProxy: true` (Task 3.2) ensures Fastify reads the correct protocol from `X-Forwarded-Proto`
    - Document this in the deployment README (Task 7)
    - **No code changes needed beyond `trustProxy: true`**

- [x]Task 5: Add Metabase to docker-compose (AC: #6)
  - [x]5.1 Add Metabase service to `docker-compose.yml`:
    ```yaml
    metabase:
      image: metabase/metabase:latest
      ports:
        - "3000:3000"
      environment:
        MB_DB_TYPE: postgres
        MB_DB_DBNAME: mycscompanion
        MB_DB_PORT: 5432
        MB_DB_USER: mycscompanion
        MB_DB_PASS: mycscompanion
        MB_DB_HOST: postgres
      depends_on:
        - postgres
    ```
    - **Port 3000**: Metabase default. Does NOT conflict — the Fastify backend runs on port 3001 locally.
    - Connects to the same PostgreSQL via Docker network (`postgres` hostname)
    - Uses the `mycscompanion` database directly for analytics queries
    - `latest` tag for free/open-source Metabase — no license required
    - **Not started by default** with `pnpm dev` — users run `docker compose up metabase` when needed

- [x]Task 6: Railway deployment configuration (AC: #7, #8)
  - [x]6.1 **IMPORTANT: Railway services are created via the dashboard, NOT config files.** The `railway.toml` controls per-service build/deploy settings only.

  - [x]6.2 Create `apps/backend/railway.toml` for API service:
    ```toml
    [build]
    buildCommand = "cd ../.. && pnpm install --frozen-lockfile && pnpm --filter backend build"

    [deploy]
    startCommand = "node --import ./dist/instrument.js dist/server.js"
    healthcheckPath = "/health"
    healthcheckTimeout = 5
    preDeployCommand = "pnpm --filter backend db:migrate"
    ```
    - `preDeployCommand` runs migrations before API starts — failure aborts deploy (ARCH)
    - `startCommand` uses `--import` flag for Sentry instrumentation in production
    - `healthcheckPath` enables Railway's built-in health monitoring
    - Build command runs from monorepo root to resolve workspace dependencies

  - [x]6.3 Create `apps/backend/railway.worker.toml` for worker service documentation:
    ```toml
    # Worker service — separate Railway service pointing to same repo
    # Configure in Railway dashboard: root directory = apps/backend
    [build]
    buildCommand = "cd ../.. && pnpm install --frozen-lockfile && pnpm --filter backend build"

    [deploy]
    startCommand = "node --import ./dist/instrument.js dist/worker/worker.js"
    ```
    - Worker has NO health check path (it's not an HTTP server)
    - Worker has NO pre-deploy migration (API handles that)
    - Same build — different start command

  - [x]6.4 Create `apps/webapp/railway.toml` for webapp service:
    ```toml
    [build]
    buildCommand = "cd ../.. && pnpm install --frozen-lockfile && pnpm --filter webapp build"

    [deploy]
    startCommand = "npx serve dist -s -l 3000"
    ```
    - `-s` flag: SPA mode (all routes fallback to index.html for React Router)
    - Static site — no pre-deploy command

  - [x]6.5 Create `apps/website/railway.toml` for website service:
    ```toml
    [build]
    buildCommand = "cd ../.. && pnpm install --frozen-lockfile && pnpm --filter website build"

    [deploy]
    startCommand = "npx serve dist -l 3000"
    ```
    - Astro static build — no SPA fallback needed (Astro generates all routes)

- [x]Task 7: Environment variable templates (AC: #8)
  - [x]7.1 UPDATE existing `.env.example` at project root (file already exists — append new vars, do NOT overwrite):
    ```bash
    # ============================================
    # mycscompanion Environment Variables
    # Copy to .env and fill in values as needed.
    # ============================================

    # --- Database (Story 1.2) ---
    DATABASE_URL=postgresql://mycscompanion:mycscompanion@localhost:5433/mycscompanion

    # --- Redis (Story 1.4) ---
    REDIS_URL=redis://localhost:6379

    # --- Sentry (Story 1.7) ---
    # Get DSN from https://sentry.io → Project Settings → Client Keys
    MCC_SENTRY_DSN=

    # --- Firebase Server (Story 2.1) ---
    # Service account JSON (base64 encoded or path)
    FIREBASE_SERVICE_ACCOUNT=

    # --- Firebase Client (Story 2.1) ---
    # Firebase web app config JSON
    MCC_FIREBASE_CONFIG=

    # --- Anthropic AI (Story 6.1) ---
    ANTHROPIC_API_KEY=

    # --- Fly.io Execution (Story 3.2) ---
    MCC_FLY_API_TOKEN=

    # --- Admin (Story 1.7) ---
    # Required for Bull Board access at /admin/queues
    MCC_ADMIN_USER=admin
    MCC_ADMIN_PASSWORD=

    # --- General ---
    NODE_ENV=development
    PORT=3001
    HOST=0.0.0.0
    CORS_ORIGIN=http://localhost:5173
    LOG_LEVEL=info
    ```
    - Documents ALL known environment variables with story references
    - No actual secrets — only structure and local dev defaults
    - `MCC_` prefix for all custom env vars per project-context naming convention
    - Third-party vars keep standard names (`ANTHROPIC_API_KEY`, `DATABASE_URL`)

  - [x]7.2 Ensure `.env` is in `.gitignore` (already is) and `.env.example` is NOT gitignored

- [x]Task 8: Deployment README (AC: #9)
  - [x]8.1 Create `docs/deployment.md`:
    Document the following:
    - **Railway Service Topology** — table of all 6 services with types, start commands, and notes
    - **Service Creation** — step-by-step guide for setting up Railway project with all services
    - **Environment Variables per Service** — which vars each service needs
    - **Database Migrations** — how pre-deploy command handles migrations
    - **TLS/HTTPS** — Railway handles automatically, no app config needed
    - **Monitoring Setup** — Sentry DSN creation, Bull Board access, Metabase local setup
    - **Deployment Flow** — push to main → CI → Railway auto-deploy
    - **Rollback** — Railway's built-in rollback via dashboard
    - **Local Dev vs Production Differences** — port differences, .env vs Railway env vars

  - [x]8.2 Railway Service Topology table for README:
    | Service | Railway Type | Start Command | Pre-Deploy | Health Check |
    |---|---|---|---|---|
    | api | Web service (Railway-assigned port, typically 3000) | `node --import ./dist/instrument.js dist/server.js` | `pnpm --filter backend db:migrate` | `/health` |
    | worker | Worker service | `node --import ./dist/instrument.js dist/worker/worker.js` | — | — |
    | postgres | Managed PostgreSQL | — (managed) | — | Built-in |
    | redis | Managed Redis | — (managed) | — | Built-in |
    | webapp | Static site | `npx serve dist -s -l 3000` | — | — |
    | website | Static site | `npx serve dist -l 3000` | — | — |

- [x]Task 9: Update package.json start scripts for Sentry (AC: #1)
  - [x]9.1 Update `apps/backend/package.json` start scripts:
    ```json
    "start:api": "node --import ./dist/instrument.js dist/server.js",
    "start:worker": "node --import ./dist/instrument.js dist/worker/worker.js"
    ```
    - Production entry points use `--import` flag for Sentry auto-instrumentation
    - Dev scripts (`dev`, `dev:worker`) remain unchanged — Sentry disabled in dev via `enabled: false`

- [x]Task 10: Unit tests for error handler and admin route (AC: #1, #4)
  - [x]10.1 Create `apps/backend/src/test/error-handler.test.ts`:
    - Test that 500+ errors call `Sentry.captureException` — mock `@sentry/node` with `vi.mock()`
    - Test that 4xx errors do NOT call `Sentry.captureException`
    - Test that error response format is `{ error: { code: string, message: string } }`
    - Use `fastify.inject()` — never supertest, never real HTTP
  - [x]10.2 Create `apps/backend/src/plugins/admin/admin.test.ts`:
    - Test `GET /admin/queues` returns 401 without credentials
    - Test `GET /admin/queues` returns 200 with valid basic auth credentials
    - Use `fastify.inject()` with `headers: { authorization: 'Basic ...' }`
    - Test names describe behavior: `it('should return 401 when no credentials provided')`
  - [x]10.3 Test that error handler respects boundary rule:
    - Platform errors (500) trigger Sentry + `request.log.error`
    - Confirm user-code errors (200 OK SSE) never reach error handler (they don't throw)

- [x]Task 11: Validate complete implementation (AC: #1-#9)
  - [x]10.1 Run `pnpm lint` — zero errors across all workspaces
  - [x]10.2 Run `pnpm typecheck` — zero type errors
  - [x]10.3 Run `pnpm test` — all existing tests pass (no regression)
  - [x]10.4 Run `pnpm build` — all workspaces build successfully
  - [x]10.5 Verify Bull Board route: Start backend, navigate to `http://localhost:3001/admin/queues` — returns 401 without credentials, shows empty dashboard with credentials
  - [x]10.6 Verify Sentry integration: Set `MCC_SENTRY_DSN` to a test DSN, trigger an error, confirm it appears in Sentry dashboard (or verify `Sentry.captureException` is called in tests)
  - [x]10.7 Verify pino JSON: `NODE_ENV=production tsx src/server.ts` outputs JSON log lines
  - [x]10.8 Verify Metabase: `docker compose up metabase` starts Metabase on port 3000, connects to PostgreSQL
  - [x]10.9 Verify deployment configs: All `railway.toml` files are valid TOML

## Dev Notes

### Rules (MUST Follow)

**Sentry Integration (Architecture + project-context):**
- Custom `setErrorHandler` with manual `Sentry.captureException` — do NOT use `Sentry.setupFastifyErrorHandler()` (it overrides our response format)
- Error response format: `{ error: { code: string, message: string } }` — no wrapper object
- 500+ errors → Sentry + `request.log.error()`. 4xx → `request.log.warn()` only
- User-code errors (SSE payloads) NEVER reach the error handler — they're 200 OK responses
- User-code errors must NEVER trigger Sentry (boundary test requirement)

**Sentry Initialization (ESM critical):**
- `instrument.ts` must be imported FIRST in both `server.ts` and `worker.ts`
- Production start commands use `node --import ./dist/instrument.js` for proper auto-instrumentation
- Sentry `enabled: false` in development/test — no test interference

**Bull Board (Architecture):**
- Route: `/admin/queues` with basic auth via `@fastify/basic-auth`
- Empty queues array — Epic 3 adds real queues dynamically
- Protected by `MCC_ADMIN_PASSWORD` env var — disabled gracefully when not set
- Do NOT create a BullMQ `Queue` instance just for the dashboard — wait for Epic 3
- Do NOT use `fastify-plugin` (fp) — admin plugin must be SCOPED to `/admin` prefix. Using fp would leak basicAuth hook globally, breaking all routes
- Do NOT pass both `setBasePath` AND `{ prefix }` — this double-prefixes the routes

**Auth Plugin Exemption (CRITICAL for this story):**
- The auth plugin's global `onRequest` hook currently only skips `/health`
- Admin routes use basic auth, NOT Firebase auth — they MUST be exempted
- Add `if (request.url.startsWith('/admin')) return` to the auth hook's skip list
- Without this, admin routes will always get 401 when Firebase auth is implemented (Story 2.1)

**Logging (ARCH-24):**
- pino already configured correctly in `app.ts` and `worker.ts`
- JSON output in production (no `pino-pretty` transport)
- Logging levels: `error` → Sentry, `warn` → degraded state, `info` → business events, `debug` → dev only
- NEVER log user code content or AI conversations at `info` or above

**Railway (ARCH-22):**
- Services created via Railway dashboard — `railway.toml` controls build/deploy settings only
- Pre-deploy command runs migrations — failure aborts deploy
- `trustProxy: true` required for correct HTTPS detection behind Railway proxy
- TLS handled by Railway edge — no app-level TLS config

**Environment Variables (project-context naming):**
- Custom vars: `MCC_` prefix (`MCC_SENTRY_DSN`, `MCC_ADMIN_PASSWORD`, `MCC_FLY_API_TOKEN`)
- Third-party keep standard names (`ANTHROPIC_API_KEY`, `DATABASE_URL`, `REDIS_URL`)
- `.env.example` committed, `.env` gitignored

### Anti-Patterns (MUST AVOID)

- Do NOT use `Sentry.setupFastifyErrorHandler()` — use custom `setErrorHandler` with manual `captureException`
- Do NOT install `@sentry/fastify` separately — it's bundled in `@sentry/node` v10
- Do NOT create BullMQ `Queue` instances in this story — no queues exist yet (Epic 3)
- Do NOT configure app-level TLS/HTTPS — Railway handles this
- Do NOT use `console.log` — use pino via Fastify logger (`request.log` or `fastify.log`)
- Do NOT hardcode Sentry DSN — always from `MCC_SENTRY_DSN` env var
- Do NOT use `Sentry.init()` inside `app.ts` — it must be in `instrument.ts` imported first
- Do NOT add Metabase to the default `docker compose up` — it's optional for local dev
- Do NOT store secrets in `railway.toml` — only structure and commands
- Do NOT create a separate `apps/worker/` directory — worker is in `apps/backend` (project-context anti-pattern)

### Previous Story Intelligence (Story 1.6)

**What was established:**
- CI pipeline fully working: lint → typecheck → test → build + E2E job
- 23 tests passing (backend: 10, shared: 13)
- CI-aware port detection via `CI` env var (5432 in CI, 5433 local)
- GitHub Actions service containers for PostgreSQL and Redis
- Pre-existing build/lint issues already fixed (Tailwind CSS, `.astro/` lint, config exports)

**Code patterns from Story 1.6:**
- Named exports only (no default) — BUT `fastify-plugin` wrapper uses default export for the plugin registration AND named export for testing
- `.js` extensions on all relative imports (NodeNext module resolution)
- `dotenv-cli` for loading `.env` in npm dev scripts
- `pnpm --filter <workspace> add` for workspace-scoped installs
- Single commit per story: `Implement Story X.Y: Brief description`

**Downstream notes from 1.6:**
> "Story 1.7: Railway deployment config builds on CI. Sentry source map upload added as CI build step."

Note: Sentry source map upload to CI is a future optimization — not in this story's ACs. The `@sentry/node` auto-instrumentation works without source maps for server-side. Source map upload becomes relevant when webapp Sentry is added (Epic 2+).

### Git Intelligence (Recent Commits)

```
0147856 Implement Story 1.6: CI/CD pipeline and quality gates
3ff8d7e Implement Story 1.5: Test infrastructure and shared utilities
b33073c Implement Story 1.4: Fastify server bootstrap and plugin architecture
1e383ed Implement Story 1.3: Database codegen and shared utilities
a7576ea Implement Story 1.2: Database foundation and migration system
a1829bf Implement Story 1.1: Monorepo scaffold and local dev environment
```

**Patterns from commits:**
- Single commit per story: `Implement Story X.Y: Brief description`
- All quality gates pass before commit (lint, typecheck, test, build)
- Stories build incrementally on each other

### Project Structure Notes

**Files to CREATE:**
```
apps/backend/src/
├── instrument.ts                          # NEW — Sentry initialization (imported first)
├── plugins/
│   └── admin/
│       └── index.ts                       # NEW — Bull Board + basic auth admin plugin
apps/backend/
├── railway.toml                           # NEW — API service deployment config
├── railway.worker.toml                    # NEW — Worker service deployment config (reference)
apps/webapp/
├── railway.toml                           # NEW — Webapp static site deployment config
apps/website/
├── railway.toml                           # NEW — Website static site deployment config
docs/
├── deployment.md                          # NEW — Deployment guide and Railway topology
```

**Files to MODIFY:**
```
apps/backend/src/server.ts                 # ADD — import instrument.ts first, Sentry flush on shutdown
apps/backend/src/worker/worker.ts          # ADD — import instrument.ts first, Sentry flush on shutdown
apps/backend/src/app.ts                    # ADD — setErrorHandler, trustProxy, admin plugin registration
apps/backend/package.json                  # ADD — @sentry/node, @bull-board/*, @fastify/basic-auth deps + update start scripts
docker-compose.yml                         # ADD — Metabase service entry
.env                                       # UPDATE — add MCC_ADMIN_USER, MCC_ADMIN_PASSWORD, ensure all vars documented
```

**Files NOT to touch:**
- `apps/backend/src/shared/db.ts` — no changes needed
- `apps/backend/src/shared/redis.ts` — no changes needed
- `apps/backend/vitest.config.ts` — no changes (Sentry disabled in test)
- `apps/backend/src/test/*` — no test file changes needed
- `.github/workflows/ci.yml` — no CI changes for this story
- `turbo.json` — no changes needed
- `packages/*` — no package changes needed

### Library Version Notes

| Library | Version | Notes |
|---|---|---|
| `@sentry/node` | ^10.x (10.40.0) | Includes Fastify support natively. Do NOT install `@sentry/fastify`. |
| `@bull-board/api` | ^6.x (6.19.0) | Dashboard core — createBullBoard API |
| `@bull-board/fastify` | ^6.x (6.16.2) | Fastify adapter — FastifyAdapter + registerPlugin |
| `@fastify/basic-auth` | latest | Basic HTTP auth for admin routes |
| `metabase/metabase` | latest (Docker) | Free/open-source analytics. Connects to PostgreSQL. |

### Downstream Dependencies

| Story | What It Gets From 1.7 |
|---|---|
| 2.x Auth stories | Sentry captures auth failures. Admin can monitor via Sentry dashboard. |
| 3.3 Submission Queue | Bull Board shows real queues. Add BullMQ adapters to existing board. |
| 3.x Execution stories | Sentry captures execution pipeline errors. Worker already instrumented. |
| 6.x Tutor stories | Sentry captures Anthropic API failures. Tutor degradation logged. |
| 10.2 Queue Management | Bull Board already mounted at `/admin/queues` — just add queue adapters. |
| 10.4 Analytics | Metabase already in docker-compose — add dashboards. |
| All future stories | Error tracking active. Deployment config ready for Railway. |

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story-1.7 — Acceptance criteria and story definition]
- [Source: _bmad-output/planning-artifacts/architecture.md#Monitoring-Observability — Sentry, Bull Board, Metabase, pino logging]
- [Source: _bmad-output/planning-artifacts/architecture.md#Railway-Service-Topology — 6 services, deployment config]
- [Source: _bmad-output/planning-artifacts/architecture.md#Process-Patterns — Error handler pattern with Sentry]
- [Source: _bmad-output/planning-artifacts/architecture.md#Communication-Patterns — Logging levels (error→Sentry, warn, info, debug)]
- [Source: _bmad-output/planning-artifacts/architecture.md#External-Integration-Points — Sentry DSN as MCC_SENTRY_DSN]
- [Source: _bmad-output/project-context.md#Error-Handling — Two-path error classification]
- [Source: _bmad-output/project-context.md#Code-Quality — MCC_ prefix for custom env vars]
- [Source: _bmad-output/project-context.md#Anti-Patterns — No console.log, no separate apps/worker]
- [Source: _bmad-output/implementation-artifacts/1-6-ci-cd-pipeline-and-quality-gates.md — CI pipeline, downstream notes for 1.7]
- [Source: apps/backend/src/app.ts — Current Fastify setup, plugin registration order]
- [Source: apps/backend/src/server.ts — Current server entry point with graceful shutdown]
- [Source: apps/backend/src/worker/worker.ts — Current worker entry point with pino]
- [Source: docker-compose.yml — Current PostgreSQL + Redis setup]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

- Bull Board route registration required `{ prefix: '/admin/queues' }` on the admin plugin instead of `{ prefix: '/admin' }` — the `setBasePath('/admin/queues')` only controls UI link generation, not Fastify route paths. Routes are registered at `/` within the plugin scope, so the prefix provides the actual URL path.
- Error handler test required `vi.hoisted()` for mock function declaration — `vi.mock` factories are hoisted above `const` declarations and can't reference them directly.
- Admin plugin `validate` callback reduced to 2 params (username, password) — ESLint strict config flags `_`-prefixed unused vars without `argsIgnorePattern`.

### Completion Notes List

- Sentry integration: `instrument.ts` with conditional init, imported first in server.ts and worker.ts, custom error handler in app.ts with manual `captureException` for 500+ errors
- Bull Board scaffolded at `/admin/queues` with basic auth via `@fastify/basic-auth`, empty queues array ready for Epic 3
- Auth plugin updated to exempt `/admin` routes from Firebase auth
- `trustProxy: true` added to Fastify for Railway reverse proxy support
- Metabase added to docker-compose with `profiles: [metabase]` — not started by default
- Railway deployment configs created for api, worker, webapp, and website services
- `.env.example` updated with all known environment variables and story references
- Deployment README created at `docs/deployment.md` with full Railway topology and setup guide
- Package.json start scripts updated to use `--import` for Sentry instrumentation
- 9 new tests added (5 error handler + 4 admin plugin), 32 total tests pass across all workspaces
- All quality gates pass: lint (0 errors), typecheck (0 errors), test (32 pass), build (3 apps)

### Change Log

- 2026-02-27: Implemented Story 1.7 — Sentry error tracking, Bull Board admin scaffold, deployment configs, env templates, deployment documentation
- 2026-02-27: Code review fixes — masked 500 error messages (H1), added vi.restoreAllMocks() to test files (M1), added .catch() to worker shutdown (M2), installed serve dependency for webapp/website (M3), updated File List with sprint-status.yaml (M4)

### File List

**Created:**
- `apps/backend/src/instrument.ts` — Sentry initialization module
- `apps/backend/src/plugins/admin/index.ts` — Bull Board + basic auth admin plugin
- `apps/backend/src/plugins/admin/admin.test.ts` — Admin plugin tests (4 tests)
- `apps/backend/src/test/error-handler.test.ts` — Error handler tests (5 tests)
- `apps/backend/railway.toml` — API service Railway deployment config
- `apps/backend/railway.worker.toml` — Worker service Railway deployment config
- `apps/webapp/railway.toml` — Webapp Railway deployment config
- `apps/website/railway.toml` — Website Railway deployment config
- `docs/deployment.md` — Deployment guide and Railway service topology

**Modified:**
- `apps/backend/src/server.ts` — Import instrument.ts first, Sentry flush on shutdown
- `apps/backend/src/worker/worker.ts` — Import instrument.ts first, Sentry flush on shutdown
- `apps/backend/src/app.ts` — Added Sentry import, trustProxy, admin plugin registration, custom error handler
- `apps/backend/src/plugins/auth/index.ts` — Added admin route exemption from Firebase auth
- `apps/backend/package.json` — Added @sentry/node, @bull-board/*, @fastify/basic-auth deps + updated start scripts
- `docker-compose.yml` — Added Metabase service with postgres profile
- `.env.example` — Updated with all environment variables and story references
- `pnpm-lock.yaml` — Updated from dependency installations
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — Story status updated to review
