# Story 1.4: Fastify Server Bootstrap & Plugin Architecture

Status: done

<!-- When this story contradicts project-context.md, project-context.md is authoritative. -->

## Story

As a **developer**,
I want a Fastify server with domain-isolated plugins and structured logging,
So that I can add feature endpoints in the correct plugin without cross-plugin coupling.

## Acceptance Criteria

1. **Given** the backend app is started via `pnpm dev`, **When** the Fastify server initializes, **Then** it registers the auth plugin and 5 domain plugins (`execution`, `tutor`, `curriculum`, `progress`, `account`) in the specified order per ARCH-5.
2. Each plugin is in its own directory under `apps/backend/src/plugins/`.
3. Plugins import only from `packages/shared` and `packages/*`, never from other plugins (ARCH-15).
4. Pino JSON logging is configured for structured log output.
5. A `GET /health` endpoint returns `200 OK` with service status.
6. CORS is configured to allow requests from the webapp origin.
7. A separate worker entry point (`apps/backend/src/worker/worker.ts`) exists sharing the same codebase but running as an independent process (ARCH-18).
8. API routes use kebab-case naming per ARCH-21.

## Tasks / Subtasks

- [x] Task 1: Install new dependencies (AC: #1, #6)
  - [x] 1.1 Install `@fastify/cors`: `pnpm --filter backend add @fastify/cors`
  - [x] 1.2 Install `fastify-plugin`: `pnpm --filter backend add fastify-plugin`
    - Required to break Fastify's default plugin encapsulation for the auth plugin
    - The auth plugin's `onRequest` hook and `uid` decorator MUST be visible to all sibling plugins
    - Domain plugins do NOT use `fastify-plugin` — they should stay encapsulated

- [x] Task 2: Wire Redis connection in `shared/redis.ts` (AC: #7 — worker foundation)
  - [x] 2.1 Replace placeholder in `apps/backend/src/shared/redis.ts` with ioredis connection
    - `ioredis` is already in `package.json` (v5.6.1) — do NOT install again
    - Import as `import Redis from 'ioredis'` (default export)
  - [x] 2.2 Read `REDIS_URL` from `process.env['REDIS_URL']`
    - Throw if missing (same pattern as `db.ts`)
  - [x] 2.3 Export `redis` client instance and `destroyRedis()` cleanup function
  - [x] 2.4 Note: `redis.ts` is NOT imported by `app.ts` or any plugin stub in this story
    - It exists as a ready utility for Story 2.1 (rate limiter) and Story 3.3 (BullMQ)
    - No test will fail from the REDIS_URL requirement because nothing imports it yet
    - **Warning for Story 1.5:** `redis.ts` throws at module-evaluation time if `REDIS_URL` is missing. Story 1.5 test infrastructure must handle this — any test that transitively imports `redis.ts` will crash without REDIS_URL. Same hazard exists for `db.ts` / `DATABASE_URL`. Story 1.5 must mock or provide env vars before import.

- [x] Task 3: Create `app.ts` with Fastify factory function (AC: #1, #4, #5, #6)
  - [x] 3.1 Create `apps/backend/src/app.ts` with `async function buildApp()` that returns a configured `FastifyInstance`
    - This separates app configuration from startup for testability
    - Story 1.5 will import `buildApp()` for integration test helpers
  - [x] 3.2 Configure Fastify with pino logging:
    - Production (`NODE_ENV === 'production'`): JSON output (pino default — no transport)
    - Development: pino-pretty transport (`{ target: 'pino-pretty' }`)
    - Default log level: `process.env['LOG_LEVEL'] ?? 'info'`
  - [x] 3.3 Register `@fastify/cors`:
    - `origin: process.env['CORS_ORIGIN'] ?? 'http://localhost:5173'`
    - `credentials: true`
    - Webapp dev server runs on port 5173 (Vite default)
    - Production: set `CORS_ORIGIN` env var to the webapp domain
  - [x] 3.4 Register health endpoint BEFORE auth plugin (unauthenticated):
    - `GET /health` returns `{ status: 'ok' }`
    - Must be registered at the root level before the auth plugin so it's not subject to auth hooks
  - [x] 3.5 Register auth plugin (position 1 — ARCH-5):
    - `await fastify.register(authPlugin)`
    - No prefix — auth hooks are global (the `onRequest` hook and `uid` decorator must propagate to all routes)
    - Note: Architecture lists `/api/auth` as auth prefix, but that's for auth-specific routes (if any are needed in Story 2.1). The plugin itself is registered without prefix because its hooks must be global via `fastify-plugin`.
  - [x] 3.6 Register domain plugins with route prefixes (position 3 — ARCH-5, ARCH-21):
    - `await fastify.register(executionPlugin, { prefix: '/api/execution' })`
    - `await fastify.register(tutorPlugin, { prefix: '/api/tutor' })`
    - `await fastify.register(curriculumPlugin, { prefix: '/api/curriculum' })`
    - `await fastify.register(progressPlugin, { prefix: '/api/progress' })`
    - `await fastify.register(accountPlugin, { prefix: '/api/account' })`
  - [x] 3.7 Export `buildApp` as named export

- [x] Task 4: Update `server.ts` as thin entry point (AC: #1)
  - [x] 4.1 Replace current server.ts content with:
    - Import `buildApp` from `./app.js`
    - Call `buildApp()`, then `fastify.listen({ port, host })`
    - Port: `Number(process.env['PORT'] ?? 3001)` (dev default 3001; architecture doc says 3000 but existing code uses 3001 to avoid local conflicts — Railway sets `PORT` in production so this only affects local dev)
    - Host: `process.env['HOST'] ?? '0.0.0.0'`
  - [x] 4.2 Add graceful shutdown handlers for `SIGTERM` and `SIGINT`:
    - Log signal received, call `app.close()`, exit 0
  - [x] 4.3 Keep error handler for startup failure:
    - Use `app.log.error(err)` if app is initialized
    - Use inline ESLint disable for `console.error` if app is not yet initialized
  - [x] 4.4 Do NOT export anything from server.ts — it's a side-effectful entry point

- [x] Task 5: Implement auth plugin skeleton (AC: #1, #3)
  - [x] 5.1 Replace `apps/backend/src/plugins/auth/index.ts` with a proper Fastify plugin
  - [x] 5.2 Wrap with `fastify-plugin` (`fp`) to break encapsulation:
    - `import fp from 'fastify-plugin'`
    - `export const authPlugin = fp(async (fastify) => { ... }, { name: 'auth-plugin' })`
  - [x] 5.3 Decorate request with `uid`:
    - `fastify.decorateRequest('uid', '')`
  - [x] 5.4 Add TypeScript module augmentation for `FastifyRequest`:
    ```typescript
    declare module 'fastify' {
      interface FastifyRequest {
        uid: string
      }
    }
    ```
  - [x] 5.5 Add global `onRequest` hook — **NO-OP STUB for now**:
    - Hook body: skip `/health`, then return (allows all other requests through)
    - Add `// TODO(story-2.1): Implement Firebase ID token verification` comment
    - Do NOT reject any requests — Firebase auth is Story 2.1
  - [x] 5.6 Health endpoint exemption — **REQUIRED URL check**:
    - Because `fastify-plugin` (`fp`) breaks encapsulation, the auth hook propagates to the parent scope. This means it WILL apply to the `/health` route even though health is registered before the auth plugin. This is how Fastify works — `fp()` hoists hooks to the parent context.
    - The `onRequest` hook MUST skip `/health`:
      ```typescript
      fastify.addHook('onRequest', async (request) => {
        if (request.url === '/health') return
        // TODO(story-2.1): Firebase token verification
      })
      ```
    - Verify after implementation: `GET /health` returns 200 without auth headers

- [x] Task 6: Implement domain plugin skeletons (AC: #1, #2, #3, #8)
  - [x] 6.1 Replace `apps/backend/src/plugins/execution/index.ts`:
    - Export a named Fastify plugin function (`executionPlugin`)
    - Do NOT wrap with `fastify-plugin` — domain plugins stay encapsulated
    - Empty plugin body (no routes yet — Story 3.x)
    - Add comment documenting future routes: `POST /submit`, `GET /:submissionId/stream`
  - [x] 6.2 Replace `apps/backend/src/plugins/tutor/index.ts`:
    - Export `tutorPlugin`
    - Empty body (Story 6.x)
    - Comment: `GET /:sessionId/stream`, `POST /:sessionId/message`, `GET /:sessionId/messages`
  - [x] 6.3 Replace `apps/backend/src/plugins/curriculum/index.ts`:
    - Export `curriculumPlugin`
    - Empty body (Story 4.x)
    - Comment: `GET /tracks`, `GET /milestones/:id`
  - [x] 6.4 Replace `apps/backend/src/plugins/progress/index.ts`:
    - Export `progressPlugin`
    - Empty body (Story 5.x)
    - Comment: `POST /save`, `POST /sessions`
    - **Architecture note:** Routes `GET /api/workspace/:milestoneId`, `GET /api/overview`, `GET /api/completion/:milestoneId` belong to the progress domain but their paths don't start with `/api/progress`. This is an unresolved architecture question — Story 5.x must decide: register these routes at the app level, use a different prefix, or adjust the frontend URLs. Not a blocker for this story's empty stub.
  - [x] 6.5 Replace `apps/backend/src/plugins/account/index.ts`:
    - Export `accountPlugin`
    - Empty body (Story 8.x)
    - Comment: `GET /profile`, `PUT /profile`, `POST /onboarding`, `GET /export`, `DELETE /`
  - [x] 6.6 Plugin function signature pattern (same for all 5 domain plugins):
    ```typescript
    import type { FastifyInstance } from 'fastify'

    export async function executionPlugin(fastify: FastifyInstance): Promise<void> {
      // Routes added in Story 3.x
    }
    ```
  - [x] 6.7 File structure note: For stubs, all plugin logic lives directly in `index.ts`. When real routes are added in future stories, move the plugin implementation to `{name}-plugin.ts` (e.g., `execution-plugin.ts`) and have `index.ts` re-export it — per the architecture directory structure showing `auth/index.ts` + `auth/auth-plugin.ts` as separate files.
  - [x] 6.8 DI pattern note: Current stubs accept no options. When real implementations are added, the signature will change to accept dependencies via options (per project-context DI rule):
    ```typescript
    // Future pattern (NOT for this story):
    // export async function executionPlugin(fastify: FastifyInstance, opts: ExecutionPluginOpts): Promise<void>
    // Registration: await fastify.register(executionPlugin, { prefix: '/api/execution', db, redis })
    ```

- [x] Task 7: Wire worker entry point (AC: #7)
  - [x] 7.1 Replace `apps/backend/src/worker/worker.ts` placeholder with a proper entry point:
    - Import pino directly for logging (worker does NOT use Fastify)
    - Log "Worker started" on startup
    - Log "Worker shutting down" on SIGTERM/SIGINT
    - Keep the Node.js event loop alive so the process doesn't exit: use `setInterval(() => {}, 1 << 30)` as a no-op keep-alive timer (BullMQ will provide its own event loop activity in Story 3.3, at which point this can be removed)
  - [x] 7.2 Use pino directly (not Fastify logger):
    ```typescript
    import pino from 'pino'
    const logger = pino({ level: process.env['LOG_LEVEL'] ?? 'info' })
    ```
  - [x] 7.3 Add graceful shutdown handlers (SIGTERM, SIGINT):
    - Log shutdown, exit cleanly
  - [x] 7.4 BullMQ dependency and processor registration deferred to Story 3.3
  - [x] 7.5 Ensure `start:worker` script (`node dist/worker/worker.js`) will work after `tsc` build
  - [x] 7.6 Add `dev:worker` script to package.json:
    - `"dev:worker": "dotenv -e ../../.env -- tsx --watch src/worker/worker.ts"`
    - This is intentionally NOT in the Turbo `dev` pipeline — the worker is started separately when needed via `pnpm --filter backend dev:worker`. Most development only needs the API server.

- [x] Task 8: Update dev script to load environment variables (AC: #1)
  - [x] 8.1 Update `apps/backend/package.json` dev script:
    - FROM: `"dev": "tsx --watch src/server.ts"`
    - TO: `"dev": "dotenv -e ../../.env -- tsx --watch src/server.ts"`
    - `dotenv-cli` is already installed as a devDep (added in Story 1.3)
    - This ensures `DATABASE_URL`, `REDIS_URL`, etc. are available when future plugins import `db.ts` and `redis.ts`
  - [x] 8.2 Do NOT modify `start:api` or `start:worker` (production) — Railway sets env vars directly in service config
  - [x] 8.3 Update `.env.example` to document new env vars used in this story:
    - `CORS_ORIGIN` — webapp URL for CORS (default: `http://localhost:5173`)
    - `LOG_LEVEL` — pino log level (default: `info`)
    - `HOST` — server bind address (default: `0.0.0.0`)
    - `PORT` — server listen port (default: `3001`)

- [x] Task 9: Validate (AC: #1-#8)
  - [x] 9.1 `pnpm typecheck` — zero errors across all 7 packages
  - [x] 9.2 `pnpm lint` — zero lint errors
  - [x] 9.3 `pnpm test` — all existing tests pass (0 regressions)
  - [x] 9.4 `pnpm build` — TypeScript compiles to `dist/` successfully
  - [x] 9.5 Manual: start server (`pnpm --filter backend dev`), hit `http://localhost:3001/health` — expect `{ "status": "ok" }`
  - [x] 9.6 Manual: verify pino-pretty logs show plugin registration in dev console
  - [x] 9.7 Manual: start worker (`pnpm --filter backend dev:worker`) — verify it starts and logs without error

## Dev Notes

### Rules (MUST Follow)

**Plugin Architecture (ARCH-5, ARCH-15):**
- Auth plugin MUST be registered FIRST — it provides the global `onRequest` hook and `uid` decorator
- Rate limiter is position 2 (Story 2.1 — not implemented here)
- Domain plugins are position 3 — registered AFTER auth
- Plugins MUST NOT import from each other — only from `packages/*` and `src/shared/`
- Domain plugins MUST NOT use `fastify-plugin` — keep them encapsulated
- Auth plugin MUST use `fastify-plugin` — its hooks/decorators must be global

**Fastify Patterns:**
- `return { data }` for JSON responses (Fastify auto-serializes) — never `reply.send()` then return
- Route handlers are `async` — return the response directly
- Plugins are async functions: `async function plugin(fastify: FastifyInstance): Promise<void>`
- Request decorators: `fastify.decorateRequest('uid', '')` with module augmentation
- Route testing: `fastify.inject()` only — never supertest, never real HTTP (Story 1.5)

**Logging (ARCH-24):**
- Production: JSON format (pino default — no transport config)
- Development: pino-pretty for readable output
- Log levels: `error` (platform errors), `warn` (degraded state), `info` (business events), `debug` (dev only)
- NEVER log user code content or AI conversation content at `info` or above

**Naming Conventions (ARCH-21):**
- Route paths: kebab-case, plural nouns: `/api/execution/submissions`
- Plugin files: kebab-case: `execution-plugin.ts`, `auth-plugin.ts`
- Plugin function names: camelCase: `executionPlugin`, `authPlugin`
- Route prefixes: `/api/{domain}` — no trailing slash

**Worker (ARCH-18):**
- Worker and API share ONE codebase (`apps/backend`) — do NOT create `apps/worker/`
- Separate entry points: `src/server.ts` (API) vs `src/worker/worker.ts` (worker)
- Separate Railway services: `start:api` vs `start:worker`
- Worker uses pino directly — NOT Fastify logger (worker has no Fastify instance)

**Import Paths:**
- Backend uses `moduleResolution: "NodeNext"` — ALL relative imports MUST have `.js` extensions
  - `import { buildApp } from './app.js'` — NOT `'./app'`
  - `import { authPlugin } from './plugins/auth/index.js'` — NOT `'./plugins/auth'`
- Internal packages: `import { ... } from '@tycs/shared'` — no `.js` extension needed
- Never import from another plugin's internals

**Code Style:**
- Named exports only — no default exports
  - Exception: `fastify-plugin` wrapping uses `fp()` which returns a value you assign to a named export
- No `any` type
- Explicit return types on exported functions
- No `enum` — use union types
- No `as` casting — use `satisfies` or type narrowing

### Anti-Patterns (MUST AVOID)

- Do NOT create routes with actual business logic — that's Stories 2.x through 8.x
- Do NOT implement Firebase token verification — that's Story 2.1
- Do NOT implement rate limiting — that's Story 2.1
- Do NOT install `bullmq` — that's Story 3.3
- Do NOT create test infrastructure (`createTestApp`, `testTransaction`) — that's Story 1.5
- Do NOT use `supertest` or real HTTP for testing — use `fastify.inject()` (Story 1.5)
- Do NOT import `db.ts` or `redis.ts` in plugin stubs — they have no business logic yet
- Do NOT use `import Redis from 'redis'` — use `import Redis from 'ioredis'`
- Do NOT create new Zustand stores (frontend concern, not this story)
- Do NOT add `@/` import aliases — use relative paths with `.js` extensions
- Do NOT use `console.log` — use pino logger (exception: startup failure in server.ts before logger exists)
- Do NOT use `process.exit(1)` in plugins — only in entry points (server.ts, worker.ts)
- Do NOT register health endpoint inside a plugin — register at root level in app.ts before auth

### Previous Story Intelligence (Story 1.3)

**What was established:**
- `apps/backend/src/shared/db.ts` — `Kysely<DB>` typed instance (replaced `Kysely<any>`)
- `apps/backend/src/shared/id.ts` — `generateId()` using cuid2
- `apps/backend/src/scripts/seed.ts` — idempotent seed script with transaction wrapper
- `packages/shared/src/constants.ts` — `TRACKS` and `MILESTONES` as const objects
- `packages/shared/src/types/db.ts` — generated by kysely-codegen (gitignored)
- All barrel exports use `.js` extensions for NodeNext compatibility
- dotenv-cli installed in both `@tycs/shared` and `@tycs/backend` devDeps

**Learnings from Story 1.3:**
- `.js` extensions on relative imports are MANDATORY — backend uses `moduleResolution: "NodeNext"`
- `dotenv-cli` is the project standard for loading root `.env` in npm scripts
- `pg` is CJS — use `import pg from 'pg'` then `pg.Pool` (not `import { Pool }`)
- ESLint enforces `no-explicit-any: 'error'` and `no-console: 'error'`

**What was established in Story 1.2:**
- PostgreSQL 16 on port 5433 (not default 5432)
- `docker-compose.yml` with PostgreSQL + Redis 7
- DATABASE_URL: `postgresql://tycs:tycs@localhost:5433/tycs`
- Kysely migration system with `kysely-ctl`

**What was established in Story 1.1:**
- Monorepo with 7 workspaces (3 apps + 4 packages)
- All plugin directories created with placeholder stubs
- Worker directory with placeholder
- `toCamelCase()` utility in `@tycs/shared`
- ESLint config extends from `@tycs/config`
- Turbo orchestration: `pnpm dev` runs all workspaces concurrently

### Git Intelligence (Recent Commits)

```
1e383ed Implement Story 1.3: Database codegen and shared utilities
a7576ea Implement Story 1.2: Database foundation and migration system
a1829bf Implement Story 1.1: Monorepo scaffold and local dev environment
```

**Files modified in Story 1.3 (most recent):**
- `packages/shared/package.json` — added kysely-codegen, dotenv-cli
- `packages/shared/src/index.ts` — barrel exports with `.js` extensions
- `apps/backend/src/shared/db.ts` — `Kysely<any>` → `Kysely<DB>`
- `apps/backend/package.json` — added dotenv-cli, db:seed script

**Patterns from recent commits:**
- Commit messages: `Implement Story X.Y: Brief description`
- `.js` extensions on all relative imports in shared and backend
- Named exports only throughout codebase
- `as const` for constant objects (not TS enum)

### Project Structure Notes

**Files to CREATE:**
```
apps/backend/src/
├── app.ts                        # NEW — Fastify factory function (buildApp)
```

**Note on `app.ts` vs `server.ts`:** The architecture doc and project-context.md describe plugin registration in `server.ts`. This story intentionally splits into `app.ts` (factory) + `server.ts` (entry point) for testability — Story 1.5 needs to import `buildApp()` without triggering `listen()`. After this story, `project-context.md` should be updated to reference `app.ts` for plugin registration order (not `server.ts`).

**Files to MODIFY:**
```
apps/backend/src/
├── server.ts                     # UPDATE — thin entry point importing buildApp
├── shared/
│   └── redis.ts                  # UPDATE — wire ioredis connection
├── plugins/
│   ├── auth/index.ts             # UPDATE — proper Fastify plugin with fp()
│   ├── execution/index.ts        # UPDATE — proper Fastify plugin function
│   ├── tutor/index.ts            # UPDATE — proper Fastify plugin function
│   ├── curriculum/index.ts       # UPDATE — proper Fastify plugin function
│   ├── progress/index.ts         # UPDATE — proper Fastify plugin function
│   └── account/index.ts          # UPDATE — proper Fastify plugin function
├── worker/
│   └── worker.ts                 # UPDATE — proper entry point with pino logger
apps/backend/package.json          # UPDATE — add deps, update dev script
pnpm-lock.yaml                    # UPDATED by pnpm install
```

**Files NOT to touch:**
- `apps/backend/src/shared/db.ts` — already typed, no changes needed
- `apps/backend/src/shared/id.ts` — already complete
- `apps/backend/src/scripts/seed.ts` — already complete
- `apps/backend/kysely.config.ts` — migration config, no changes
- `apps/backend/migrations/` — no new migrations in this story
- `apps/backend/eslint.config.js` — already configured
- `apps/backend/tsconfig.json` — already configured
- `packages/shared/` — no changes needed
- `packages/config/` — no changes needed
- `apps/webapp/` — frontend, not this story
- `apps/website/` — marketing site, not this story

### Reference Implementation Patterns

**app.ts pattern:**
```typescript
import type { FastifyInstance } from 'fastify'
import Fastify from 'fastify'
import cors from '@fastify/cors'
import { authPlugin } from './plugins/auth/index.js'
import { executionPlugin } from './plugins/execution/index.js'
import { tutorPlugin } from './plugins/tutor/index.js'
import { curriculumPlugin } from './plugins/curriculum/index.js'
import { progressPlugin } from './plugins/progress/index.js'
import { accountPlugin } from './plugins/account/index.js'

export async function buildApp(): Promise<FastifyInstance> {
  const fastify = Fastify({
    logger: {
      level: process.env['LOG_LEVEL'] ?? 'info',
      transport:
        process.env['NODE_ENV'] !== 'production'
          ? { target: 'pino-pretty' }
          : undefined,
    },
  })

  // CORS — allow webapp origin
  await fastify.register(cors, {
    origin: process.env['CORS_ORIGIN'] ?? 'http://localhost:5173',
    credentials: true,
  })

  // Health check — unauthenticated, registered before auth plugin
  fastify.get('/health', async () => {
    return { status: 'ok' }
  })

  // --- Plugin registration order (ARCH-5) ---
  // Position 1: Auth (global onRequest hook — must be first)
  await fastify.register(authPlugin)

  // Position 2: Rate limiter (Story 2.1 — depends on auth for uid)

  // Position 3: Domain plugins
  await fastify.register(executionPlugin, { prefix: '/api/execution' })
  await fastify.register(tutorPlugin, { prefix: '/api/tutor' })
  await fastify.register(curriculumPlugin, { prefix: '/api/curriculum' })
  await fastify.register(progressPlugin, { prefix: '/api/progress' })
  await fastify.register(accountPlugin, { prefix: '/api/account' })

  return fastify
}
```

**server.ts pattern:**
```typescript
import { buildApp } from './app.js'

async function start(): Promise<void> {
  const app = await buildApp()

  const port = Number(process.env['PORT'] ?? 3001)
  const host = process.env['HOST'] ?? '0.0.0.0'

  await app.listen({ port, host })

  for (const signal of ['SIGTERM', 'SIGINT'] as const) {
    process.on(signal, () => {
      app.log.info({ signal }, 'Shutting down')
      app.close().then(() => process.exit(0))
    })
  }
}

start().catch((err: unknown) => {
  // eslint-disable-next-line no-console
  console.error('Failed to start server:', err)
  process.exit(1)
})
```

**Auth plugin pattern (plugins/auth/index.ts):**
```typescript
import type { FastifyInstance } from 'fastify'
import fp from 'fastify-plugin'

declare module 'fastify' {
  interface FastifyRequest {
    uid: string
  }
}

async function auth(fastify: FastifyInstance): Promise<void> {
  fastify.decorateRequest('uid', '')

  fastify.addHook('onRequest', async (request) => {
    if (request.url === '/health') return
    // TODO(story-2.1): Implement Firebase ID token verification
    // 1. Extract Authorization: Bearer <token>
    // 2. Verify via Firebase Admin SDK auth.verifyIdToken()
    // 3. Set request.uid = decodedToken.uid
    // 4. Return 401 if missing/invalid/expired
  })
}

export const authPlugin = fp(auth, { name: 'auth-plugin' })
```

**Domain plugin pattern (e.g., plugins/execution/index.ts):**
```typescript
import type { FastifyInstance } from 'fastify'

export async function executionPlugin(fastify: FastifyInstance): Promise<void> {
  // Routes added in Story 3.x:
  // POST /submit — submit code for execution
  // GET /:submissionId/stream — SSE stream for execution results
}
```

**Redis connection pattern (shared/redis.ts):**
```typescript
import Redis from 'ioredis'

if (!process.env['REDIS_URL']) {
  throw new Error('REDIS_URL environment variable is required')
}

export const redis = new Redis(process.env['REDIS_URL'])

export async function destroyRedis(): Promise<void> {
  await redis.quit()
}
```

**Worker entry point pattern (worker/worker.ts):**
```typescript
import pino from 'pino'

const logger = pino({
  level: process.env['LOG_LEVEL'] ?? 'info',
  transport:
    process.env['NODE_ENV'] !== 'production'
      ? { target: 'pino-pretty' }
      : undefined,
})

logger.info('Worker started')

// BullMQ processors registered in Story 3.3

// Keep the event loop alive until BullMQ provides its own activity (Story 3.3)
const keepAlive = setInterval(() => {}, 1 << 30)

for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.on(signal, () => {
    logger.info({ signal }, 'Worker shutting down')
    clearInterval(keepAlive)
    process.exit(0)
  })
}
```

**Updated package.json scripts:**
```json
{
  "scripts": {
    "dev": "dotenv -e ../../.env -- tsx --watch src/server.ts",
    "dev:worker": "dotenv -e ../../.env -- tsx --watch src/worker/worker.ts",
    "start:api": "node dist/server.js",
    "start:worker": "node dist/worker/worker.js",
    "build": "tsc",
    "lint": "eslint .",
    "typecheck": "tsc --noEmit",
    "db:migrate": "kysely migrate:latest",
    "db:seed": "dotenv -e ../../.env -- tsx src/scripts/seed.ts",
    "db:migrate:down": "kysely migrate:down",
    "db:migrate:make": "kysely migrate:make"
  }
}
```

### Downstream Dependencies

| Story | What It Needs From 1.4 |
|---|---|
| 1.5 Test Infrastructure | `buildApp()` export from `app.ts` for `fastify.inject()` test helpers |
| 1.7 Error Tracking | Fastify instance for Sentry plugin registration, pino logger for structured logging |
| 2.1 Firebase Auth | Auth plugin skeleton to add Firebase `verifyIdToken()` logic |
| 2.1 Rate Limiter | Auth plugin + Redis connection for sliding window rate limiter |
| 3.3 BullMQ Worker | Worker entry point + Redis connection for job queue processing |
| 3.4 Submission API | Execution plugin to add `POST /submit` and `GET /:id/stream` routes |
| All API stories | Plugin architecture + route prefixes for adding domain routes |

### Library Version Notes

| Library | Version | Notes |
|---|---|---|
| `fastify` | 5.3.3 | Already installed. v5 is ESM-first, async plugin registration. |
| `@fastify/cors` | Latest v11.x | Compatible with Fastify 5. Ships its own TypeScript types — no `@types/` package needed. Install via `pnpm --filter backend add @fastify/cors`. |
| `fastify-plugin` | Latest v5.x | Compatible with Fastify 5. Ships its own types. Breaks plugin encapsulation for auth hooks. |
| `ioredis` | 5.6.1 | Already installed. Default import: `import Redis from 'ioredis'`. |
| `pino` | 9.7.0 | Already installed. Used directly in worker (not via Fastify). |
| `pino-pretty` | 13.1.3 | Already installed as devDep. Used via Fastify logger transport config. |

### References

- [Source: _bmad-output/planning-artifacts/architecture.md#Fastify-Plugin-Architecture — 6 plugins, prefixes, registration order]
- [Source: _bmad-output/planning-artifacts/architecture.md#Plugin-Registration-Order — ARCH-5: auth first, rate limiter second, domain third]
- [Source: _bmad-output/planning-artifacts/architecture.md#Plugin-Isolation — ARCH-15: no cross-plugin imports]
- [Source: _bmad-output/planning-artifacts/architecture.md#Worker-API-Communication — ARCH-18: shared codebase, separate entry points]
- [Source: _bmad-output/planning-artifacts/architecture.md#API-Route-Naming — ARCH-21: kebab-case, /api/{domain} prefixes]
- [Source: _bmad-output/planning-artifacts/architecture.md#Logging — ARCH-24: pino levels, JSON in prod, privacy rules]
- [Source: _bmad-output/planning-artifacts/architecture.md#Backend-Directory-Structure — plugin dirs, shared/, worker/]
- [Source: _bmad-output/planning-artifacts/architecture.md#Health-Endpoint — GET /health, exempt from auth, Railway health checks]
- [Source: _bmad-output/planning-artifacts/architecture.md#Dependency-Injection — plugins accept deps via options for testability]
- [Source: _bmad-output/planning-artifacts/epics.md#Story-1.4 — Acceptance criteria and story definition]
- [Source: _bmad-output/project-context.md#Framework-Specific-Rules — Fastify plugin patterns, SSE config, route responses]
- [Source: _bmad-output/project-context.md#Technology-Stack — Fastify, ioredis, pino, Node >=20]
- [Source: _bmad-output/project-context.md#Development-Workflow — pnpm dev, docker compose, scoped installs]
- [Source: _bmad-output/project-context.md#Anti-Patterns — no cross-plugin imports, no redis npm package, no console.log]
- [Source: _bmad-output/implementation-artifacts/1-3-database-codegen-and-shared-utilities.md — Previous story context, dotenv-cli, .js extensions]
- [Source: _bmad-output/implementation-artifacts/1-1-monorepo-scaffold-and-local-dev-environment.md — Plugin directory stubs, workspace structure]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

- ioredis with NodeNext moduleResolution: `import Redis from 'ioredis'` (default import) fails with "not constructable" error. Fixed by using named import: `import { Redis } from 'ioredis'`. CJS interop issue specific to NodeNext.
- ESLint `@typescript-eslint/no-unused-vars` from `tseslint.configs.strict` does NOT have `argsIgnorePattern: "^_"` configured. Underscore-prefixed params are still flagged. Used inline `eslint-disable-next-line` for domain plugin stubs.
- `@tycs/webapp:build` fails with `Can't resolve 'tailwindcss'` — pre-existing issue unrelated to this story. Backend build succeeds independently.

### Completion Notes List

- Task 1: Installed `@fastify/cors` ^11.2.0 and `fastify-plugin` ^5.1.0
- Task 2: Wired `redis.ts` with `{ Redis } from 'ioredis'` (named import for NodeNext compat), `REDIS_URL` required, exports `redis` + `destroyRedis()`
- Task 3: Created `app.ts` with `buildApp()` factory — CORS, health endpoint, auth plugin (position 1), 5 domain plugins (position 3) with `/api/{domain}` prefixes
- Task 4: `server.ts` is now thin entry point: imports `buildApp`, listens on port, graceful shutdown on SIGTERM/SIGINT
- Task 5: Auth plugin wrapped with `fp()` for global hooks, `decorateRequest('uid', '')`, module augmentation, `onRequest` hook skips `/health`
- Task 6: 5 domain plugins as empty async functions with future route comments, eslint-disable for unused fastify param
- Task 7: Worker entry point with pino logger, pino-pretty in dev, keep-alive timer, graceful shutdown
- Task 8: Dev script uses `dotenv -e ../../.env`, added `dev:worker` script, `.env.example` updated with CORS_ORIGIN/LOG_LEVEL/HOST/PORT
- Task 9: All validations pass — typecheck (0 errors), lint (0 errors), test (13 pass, 0 regressions), build (backend compiles), health returns `{"status":"ok"}`, worker starts cleanly

### File List

- `apps/backend/src/app.ts` — NEW: Fastify factory function with plugin registration
- `apps/backend/src/server.ts` — MODIFIED: thin entry point importing buildApp
- `apps/backend/src/shared/redis.ts` — MODIFIED: ioredis connection with REDIS_URL
- `apps/backend/src/plugins/auth/index.ts` — MODIFIED: Fastify plugin with fp(), uid decorator, onRequest hook
- `apps/backend/src/plugins/execution/index.ts` — MODIFIED: named plugin function stub
- `apps/backend/src/plugins/tutor/index.ts` — MODIFIED: named plugin function stub
- `apps/backend/src/plugins/curriculum/index.ts` — MODIFIED: named plugin function stub
- `apps/backend/src/plugins/progress/index.ts` — MODIFIED: named plugin function stub
- `apps/backend/src/plugins/account/index.ts` — MODIFIED: named plugin function stub
- `apps/backend/src/worker/worker.ts` — MODIFIED: pino logger, keep-alive, graceful shutdown
- `apps/backend/package.json` — MODIFIED: added @fastify/cors, fastify-plugin, dev script with dotenv, dev:worker script
- `.env.example` — MODIFIED: added CORS_ORIGIN, LOG_LEVEL, HOST, PORT
- `pnpm-lock.yaml` — MODIFIED: lockfile updated by pnpm install

## Review Follow-ups

- [ ] [AI-Review][MEDIUM] Story 1.5 must add integration tests for `buildApp()` and `GET /health` using `fastify.inject()` — Story 1.4 ships with zero test files because test infrastructure is deferred

## Senior Developer Review (AI)

**Reviewer:** Code Review Workflow (Claude Opus 4.6)
**Date:** 2026-02-26
**Outcome:** Changes Requested → Auto-Fixed

**Issues Found:** 3 Medium, 3 Low (0 Critical)

| # | Severity | File | Description | Resolution |
|---|---|---|---|---|
| M1 | MEDIUM | `server.ts:12-13` | `.then()` chain in signal handler violates async/await rule + unhandled rejection hangs process on `app.close()` failure | Fixed: added rejection handler via two-arg `.then()`, prefixed with `void` |
| M2 | MEDIUM | `redis.ts` | No `.on('error')` handler — will crash process on connection failure when imported | Fixed: added error event listener |
| M3 | MEDIUM | (no file) | No tests for Story 1.4 code — `buildApp()` and `/health` are testable without infrastructure | Deferred: added follow-up item for Story 1.5 |
| L1 | LOW | `auth/index.ts:14` | `request.url === '/health'` is fragile — includes query string | Fixed: added `startsWith('/health?')` fallback |
| L2 | LOW | `.env.example` | Missing `NODE_ENV` documentation (controls logging format) | Fixed: added commented `NODE_ENV` entry |
| L3 | LOW | `project-context.md:83` | Still references `server.ts` for plugin registration — now lives in `app.ts` | Fixed: updated reference |

**Validation after fixes:** typecheck (0 errors), lint (0 errors), test (13 pass, 0 regressions), build (compiles)

## Change Log

- 2026-02-26: Code review — fixed 5 issues (M1: signal handler rejection, M2: Redis error handler, L1: health URL check, L2: .env.example NODE_ENV, L3: project-context.md reference); deferred M3 (tests) to Story 1.5
- 2026-02-26: Implemented Story 1.4 — Fastify server bootstrap with plugin architecture, health endpoint, auth plugin skeleton, 5 domain plugin stubs, Redis connection, worker entry point, env var configuration
