---
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8]
status: 'complete'
completedAt: '2026-02-25'
inputDocuments:
  - '_bmad-output/planning-artifacts/product-brief-mycscompanion-2026-02-21.md'
  - '_bmad-output/planning-artifacts/prd.md'
  - '_bmad-output/planning-artifacts/ux-design-specification.md'
  - '_bmad-output/planning-artifacts/research/market-cs-learning-webapp-research-2026-02-21.md'
  - '_bmad-output/planning-artifacts/research/technical-cs-learning-webapp-research-2026-02-21.md'
workflowType: 'architecture'
project_name: 'mycscompanion'
user_name: 'Ducdo'
date: '2026-02-25'
---

# Architecture Decision Document

_This document builds collaboratively through step-by-step discovery. Sections are appended as we work through each architectural decision together._

## Project Context Analysis

### Requirements Overview

**Functional Requirements:**

56 FRs across 9 capability areas. The architectural weight is concentrated in three areas:

- **Code Execution & Benchmarks (FR20-25):** The execution pipeline is the most architecturally complex subsystem. It involves two distinct layers: (1) **Docker containers** — disposable, network-isolated black boxes that compile and run user code, and (2) **execution workers** — persistent processes that manage Docker container lifecycle, capture output, run benchmarks, and stream results back via SSE. The benchmark runner adds further complexity: each benchmark requires sequential execution of both the user's implementation and a pinned reference implementation on the same worker, producing a normalized ratio (±5% variance target).
- **AI Tutoring (FR14-19):** Context-aware Socratic AI with SSE streaming, stuck detection, and proactive intervention. Requires persistent SSE connections per active session, context assembly from multiple data sources (milestone brief, user code, acceptance criteria, background questionnaire), and Anthropic API integration with cost optimization (prompt caching, tiered model routing).
- **Progress & Session Management (FR33-39):** Invisible auto-save every 30-60 seconds, pre-computed session summaries at session end, zero-friction re-engagement. Requires durable state persistence and a session event stream that feeds both summaries and analytics.

Supporting areas (Learning Experience, Onboarding, Account, Content Pipeline, Marketing, Admin) are architecturally simpler — standard CRUD, Firebase Auth, static site generation, and external tooling (Bull Board, Metabase, Sentry). No custom admin panel.

**Non-Functional Requirements:**

Performance targets are aggressive but achievable: <5s compilation, <10s benchmarks, <1s AI TTFT. The benchmark consistency requirement (±5% normalized ratio) is the most architecturally demanding NFR — it requires dedicated benchmark workers, sequential execution of reference and user implementations, and CPU/memory isolation. Critically, **benchmark consistency cannot be validated in standard CI** (GitHub Actions runners lack consistent hardware) — this requires a dedicated Railway environment for benchmark regression testing, which is an infrastructure decision.

Security is dominated by code execution isolation: disposable Docker containers with CPU/memory limits, 60s timeout, `--pids-limit`, `--network=none`, read-only filesystem. Rate limiting at code submission and AI tutor boundaries.

Scalability targets are modest for MVP (100 concurrent users, 10 simultaneous executions) with a clear path to 1,000 users via horizontal scaling of execution workers and connection pooling (PgBouncer).

**UX-Driven Architectural Requirements:**

The UX specification imposes several architectural constraints beyond typical frontend concerns:

- **Content-before-tools loading pattern:** The API response for workspace data must be structured so lightweight text fields (milestone brief, acceptance criteria, session summary) can render immediately while heavier data (code state for Monaco) loads separately. This argues for either a structured response with fast-rendering fields first, or a split fetch strategy.
- **Persistent SSE per session:** Background SSE connection required even when tutor panel is collapsed, enabling server-initiated stuck detection. At 100 concurrent users = 100 persistent connections.
- **Stuck detection logic ownership:** Client-side timer tracks editor inactivity and triggers Stage 1 (subtle signal) and Stage 2 (auto-expand). Thresholds are fetched from milestone config on workspace load. The server provides threshold configuration and the tutor SSE endpoint; the detection logic itself runs client-side. This is a key architectural boundary.
- **Zero temporal framing:** Session summaries use pure content context — no dates, no relative timestamps. Pre-computed at session end, stored as plain text, injected into AI tutor system prompt on return.

**Scale & Complexity:**

- Primary domain: Full-stack web application with server-side code execution infrastructure
- Complexity level: Medium-high
- Estimated architectural subsystems: ~7 (API server, execution pipeline, AI tutor service, content/curriculum, session/progress management, auth, static site). Admin operations use external tools and are not a distinct subsystem.

### Technical Constraints & Dependencies

- **Stack locked:** React 19 + Vite, Astro, Fastify, **Kysely** + PostgreSQL, Turborepo, Railway, Firebase Auth, Anthropic SDK, BullMQ + Redis, Docker, shadcn/ui
- **ORM resolution:** The PRD specifies **Kysely** (type-safe SQL query builder — "you write SQL-like syntax with full TypeScript inference"). The technical research references Drizzle in some sections. **Kysely is authoritative per the PRD.** The architecture document must use Kysely consistently to avoid implementation confusion.
- **Hybrid deployment:** Railway for web infrastructure (API, database, Redis, static sites) + Fly.io for code execution (ephemeral Firecracker VMs via Machines API). Railway cannot run Docker-in-Docker — Fly.io provides purpose-built isolated execution.
- **Solo founder operation:** Architecture must be operationally simple — no Kubernetes, no multi-region. External tools (Bull Board, Metabase, Sentry) for admin. 7 subsystems is the ceiling for operational sustainability.
- **Cost ceiling:** ≤$0.65/user/month at 100 users. AI API costs are the largest variable.
- **Content is code:** Milestone content (starter code, reference implementations, acceptance criteria) flows through a CI pipeline (FR44). Content CI and production code execution **share the same Docker execution environment** — the content CI runner needs access to the same container images and toolchain as production workers. This is a shared infrastructure dependency.
- **Cross-subdomain auth eliminated:** All auth lives on `app.mycscompanion.dev` only. The landing page at `mycscompanion.dev` is a pure static site with CTA redirects — no auth needed. This was resolved in Step 4 (Auth & Security decisions).

### Cross-Cutting Concerns Identified

1. **Cross-subdomain authentication** — **Eliminated.** All auth confined to `app.mycscompanion.dev`. Landing page is pure static with CTA redirects. No cross-subdomain mechanism needed.
2. **SSE connection management** — AI tutor streaming, compilation output, benchmark results all use SSE. Background SSE per active session for stuck detection. Connection lifecycle, reconnection, and cleanup need a unified pattern.
3. **Error classification** — User-code errors (compilation failures, runtime panics) are expected diagnostic data shown in the terminal. Platform errors (API failures, queue errors) are unexpected and go to Sentry. Two completely different handling paths through the entire stack.
4. **Rate limiting** — Code submissions (10/min/user), AI tutor (30/min/user). Enforced at the API layer, needs Redis-backed counters.
5. **Instrumentation from day one** — Onboarding canary timestamps, stuck detection event stream, benchmark engagement tracking, session event logging. Hard MVP per the UX spec.
6. **AI cost optimization** — Prompt caching, tiered model routing, context window management, per-user rate limits. Architectural decisions, not operational afterthoughts.
7. **Graceful degradation as testable architecture** — If AI tutor is unavailable, core loop (edit→submit→benchmark) must still function. This means every component that consumes tutor data needs a designed degraded state. Fault injection (kill tutor SSE, verify workspace still works) should be an integration test pattern that shapes how components are composed.
8. **Container warm-up strategy** — Docker container cold start directly impacts the first-impression experience. The onboarding canary (<10 minutes signup to first submission) depends on fast container availability. Warm container pools or pre-pulled images are an architectural concern, not just an operational optimization.
9. **Shared execution infrastructure** — Content CI pipeline (FR44) and production code execution share Docker container images, Go toolchain, and potentially BullMQ workers. Changes to execution infrastructure affect both content validation and user-facing execution.

## Starter Template Evaluation

### Primary Technology Domain

Full-stack TypeScript monorepo (Turborepo + pnpm) with three applications: React + Vite SPA, Astro static site, and Fastify API server. Deployed on Railway.

### Starter Options Considered

| Option | Starter | Match | Verdict |
|---|---|---|---|
| A | Manual Assembly (individual CLIs) | Exact fit — each tool scaffolds its own app cleanly | **Selected** |
| B | [theogravity/fastify-starter-turbo-monorepo](https://github.com/theogravity/fastify-starter-turbo-monorepo) | Backend match (Fastify v5 + Kysely + PostgreSQL + Turborepo) but missing webapp and website | Reference pattern for Fastify+Kysely setup |
| C | [riipandi/fuelstack](https://github.com/riipandi/fuelstack) | Broad match but uses Drizzle (not Kysely), includes Next.js | Rejected — wrong ORM, unnecessary dependencies |
| — | Generic `create-turbo` starters | Scaffolds Next.js apps by default, requires significant cleanup | Rejected — more deletion than creation |

### Selected Approach: Manual Assembly

**Rationale:** The mycscompanion stack is too specific for any community starter to provide net time savings. Manual assembly using targeted CLIs where they add value (`create-vite`, `create-astro`) and hand-scaffolding where they don't (Turborepo root, Fastify backend) ensures every dependency is intentional, every pattern matches the PRD, and there's zero cleanup of unwanted opinions.

**Package Manager:** pnpm (locked). Turborepo works best with pnpm workspaces — hoisting behavior is more predictable, and the technical research already assumes pnpm.

**Initialization Sequence:**

```bash
# Step 1: Manual Turborepo root (3 files — no create-turbo CLI)
mkdir mycscompanion && cd mycscompanion
# Create: package.json (pnpm workspaces), turbo.json (pipeline), tsconfig.base.json
pnpm init

# Step 2: React + Vite webapp (SWC for fast builds)
pnpm create vite apps/webapp --template react-swc-ts

# Step 3: Astro website (minimal starter + Tailwind integration)
pnpm create astro apps/website -- --template minimal
cd apps/website && npx astro add tailwind && cd ../..

# Step 4: Fastify backend (manual TypeScript scaffold — not fastify-cli)
mkdir -p apps/backend/src
# Hand-scaffold: src/server.ts, tsconfig.json, package.json
# Manual setup gives control over domain boundary structure (plugins for AI tutor,
# execution, curriculum, auth) without fastify-cli's opinionated layout

# Step 5: Create shared packages (internal packages — TypeScript source, no build step)
mkdir -p packages/ui/src packages/shared/src packages/config

# Step 6: Initialize shadcn/ui in packages/ui (after Tailwind configured)
cd packages/ui && npx shadcn@latest init && cd ../..
```

### Architectural Decisions Provided by Starter

**Language & Runtime:**
- TypeScript across all three apps and all shared packages
- SWC compiler for React webapp (faster HMR than Babel)
- Node.js runtime for Fastify backend and build tools

**Package Manager:** pnpm with workspaces

**Styling Solution:**
- Tailwind CSS v4 (theme preset owned by `packages/ui`)
- shadcn/ui components in `packages/ui` (shared across webapp and website)
- Astro website uses `@astrojs/react` for React island components (Button, Card for landing page) and imports Tailwind preset from `@mycscompanion/ui` for token consistency
- **Font loading strategy is per-app:** `font-display: swap` for Astro (prioritize LCP), `font-display: optional` for React webapp (prevent FOUT for daily users)

**Build Tooling:**
- Turborepo for monorepo orchestration (parallel builds, caching)
- Vite for webapp dev server and production builds
- Astro for website static builds
- TypeScript project references for cross-package type checking

**Testing Framework:**
- Vitest (Vite-native) — base config in `packages/config`, extended per-app
- Playwright for E2E — to be configured post-scaffold
- Base Vitest config must properly resolve workspace package imports (`@mycscompanion/shared`, `@mycscompanion/ui`)

**Code Organization:**
```
mycscompanion/
├── apps/
│   ├── backend/     # Fastify API server (manual scaffold, plugin-based domains)
│   ├── webapp/      # React + Vite SPA (consumes @mycscompanion/ui)
│   └── website/     # Astro static site (React islands from @mycscompanion/ui)
├── packages/
│   ├── ui/          # shadcn/ui components + Tailwind theme preset (design tokens)
│   ├── shared/      # Shared types, constants, utilities
│   └── config/      # Shared ESLint, TypeScript base, Vitest base configs
├── turbo.json
├── package.json     # pnpm workspaces
└── tsconfig.base.json
```

**Shared Packages Pattern:** All packages under `packages/` are **internal packages** — consumed as TypeScript source directly by each app. No build step, no compiled output. Each consuming app (Vite, Astro, Fastify) handles its own TypeScript transpilation. This is Turborepo's recommended pattern and avoids the subtle type resolution bugs that built packages can introduce when different apps handle transpilation differently.

**Development Experience:**
- Vite HMR for webapp (~instant refresh)
- Astro HMR for website
- Fastify `--watch` for backend
- Turborepo `dev` pipeline runs all three concurrently

**Reference Pattern:** The [fastify-starter-turbo-monorepo](https://github.com/theogravity/fastify-starter-turbo-monorepo) should be referenced during Fastify + Kysely + migration setup as a proven pattern for database integration, even though it's not used as a starter.

**Note:** Project initialization using this sequence should be the first implementation story.

## Core Architectural Decisions

### Decision Priority Analysis

**Critical Decisions (Block Implementation):**
- Hybrid Railway + Fly.io deployment topology
- Fly.io Machines API for code execution (Railway cannot do Docker-in-Docker)
- Firebase Auth confined to `app.mycscompanion.dev` (no cross-subdomain auth)
- Kysely migrations with `kysely-codegen` for type generation
- Fastify plugin architecture (6 domain plugins)
- SSE via `fastify-sse-v2` with Redis pub/sub for worker↔API streaming
- Anthropic SDK with tiered model routing (Haiku default, Sonnet for code analysis)

**Important Decisions (Shape Architecture):**
- TanStack Query + Zustand (2 stores) for frontend state
- `packages/execution` shared package for execution domain
- Redis event log for SSE reconnect replay
- Client-side stuck detection with server-side threshold config

**Deferred Decisions (Post-MVP):**
- PgBouncer connection pooling (add when connection count becomes an issue)
- Application-level query caching (PostgreSQL handles read patterns at 100 users)
- Warm container pool on Fly (pre-cached images sufficient for MVP)
- Multi-provider AI fallback (if Anthropic is down, tutor is down — acceptable for MVP)

### Authentication & Security

**Auth Boundary:** All authentication lives on `app.mycscompanion.dev`. The landing page at `mycscompanion.dev` is a pure Astro static site with CTA buttons that redirect to `app.mycscompanion.dev/sign-in`. This eliminates cross-subdomain auth entirely — no session cookies scoped to `*.mycscompanion.dev`, no token relay. Firebase Auth SDK runs only in the React SPA.

**API Authorization:** Every Fastify API route (except health check) requires a Firebase Bearer token. A global `onRequest` hook:
1. Extracts `Authorization: Bearer <token>` from the request header
2. Verifies the token via Firebase Admin SDK (`auth.verifyIdToken()`)
3. Decorates `request.uid` with the verified user ID
4. Returns 401 if token is missing, expired, or invalid

Token refresh: Firebase tokens expire after 1 hour. The frontend `apiFetch` utility calls `getIdToken(true)` (force refresh) on 401, retries once, then redirects to `/sign-in` if the refresh also fails. Auth retry is separated from TanStack Query's network retry.

**Rate Limiting:** Redis sliding window per `uid`:
- Code submissions: 10/min/user
- AI tutor messages: 30/min/user
- Rate limiter is injectable for testability (accepts a Redis client interface, not a hardcoded connection)

### API & Communication Patterns

**Fastify Plugin Architecture:** 6 domain plugins, each registered as a Fastify plugin with its own route prefix:

| Plugin | Prefix | Responsibility |
|---|---|---|
| `auth` | `/api/auth` | Firebase token verification, rate limiting middleware |
| `execution` | `/api/execution` | Code submission, execution SSE streaming, benchmark results |
| `tutor` | `/api/tutor` | AI tutor SSE, stuck detection events, conversation history |
| `curriculum` | `/api/curriculum` | Milestone content, track data, acceptance criteria |
| `progress` | `/api/progress` | Session management, auto-save, code snapshots, summaries |
| `account` | `/api/account` | Profile, background questionnaire, data export, deletion |

**Route Organization:** Single-fetch screen endpoints that return all data needed to render a screen:
- `GET /api/overview` — track progress, milestone grid, trajectory data
- `GET /api/workspace/:milestoneId` — milestone brief, criteria, latest code, stuck thresholds, session context
- `GET /api/completion/:milestoneId` — completion data, benchmark summary, next milestone

Documented split strategy: if any single-fetch endpoint exceeds 200ms p95, split into parallel fetches. Architecture is ready for this but doesn't add complexity until needed.

**SSE Streaming:** `fastify-sse-v2` (v4.2.1) with manual 30-second heartbeat. Fastify `connectionTimeout` override on SSE routes to prevent premature connection closing.

**Railway SSE Constraint:** Railway has a non-configurable 5-minute hard timeout on SSE connections. Solution: `EventSource` auto-reconnect (built into the browser API) + `Last-Event-ID` for resumability. The 30-second heartbeat keeps the connection alive within the 5-minute window. Reconnection is transparent to the user.

**Worker↔API Communication (Redis Pub/Sub + Event Log):**
- Worker publishes execution events to Redis channel `execution:{submissionId}`
- API subscribes to that channel when client opens SSE connection at `/api/execution/:submissionId/stream`
- **Reconnect replay:** Worker also writes every event to a Redis list `execution:{submissionId}:log` (TTL: 5 minutes after job completion). On SSE reconnect with `Last-Event-ID`, the API replays events from the list starting after that ID, then subscribes to the live channel. Single implementation handles both API restart and Railway 5-minute timeout.
- If client disconnects mid-execution, API unsubscribes. Worker continues to completion and updates the database. Client can reconnect and get final state.

**Typed Event Schema:** Defined in `packages/execution` as a TypeScript discriminated union. Both worker and API import from the same source.

```typescript
type ExecutionEvent = {
  type: 'compile_output' | 'compile_error' | 'test_output' | 'test_result' | 'benchmark_progress' | 'benchmark_result' | 'complete' | 'error' | 'timeout';
  phase: 'preparing' | 'compiling' | 'testing' | 'benchmarking';
  data: string | object;
  sequenceId: number;
}
```

**Error Classification (Two-Path):**
- **User-code errors** (compilation failures, runtime panics, test failures): SSE events with `type: 'compile_error'` or `type: 'error'`. HTTP response is always 200 OK — the error is in the event payload. Displayed in the terminal panel as diagnostic output.
- **Platform errors** (API failures, queue errors, infrastructure issues): HTTP status codes (500, 503). Sent to Sentry. Client shows generic error state.
- Boundary tests validate that user-code errors never trigger Sentry and platform errors never appear as terminal output.

**Railway Service Topology:**

| Service | Railway Type | Notes |
|---|---|---|
| api | Web service | Fastify on port 3000. Health check at `/health`. |
| worker | Worker service | BullMQ processor. Calls Fly.io Machines API for code execution. |
| postgres | Managed PostgreSQL | Automatic backups, point-in-time recovery. |
| redis | Managed Redis | BullMQ, rate limiting, session cache, pub/sub. |
| webapp | Static site | Vite build. SPA fallback for browser history routing. `app.mycscompanion.dev`. |
| website | Static site | Astro build. `mycscompanion.dev`. |

### Data Architecture

**Database:** PostgreSQL (Railway managed) with Kysely query builder.

**Schema Management:** Kysely migrations via `kysely-ctl`. Each migration is a TypeScript file with `up()` and `down()` using Kysely's schema builder API. For edge cases, Kysely's `sql` template tag allows raw SQL within migration files.

**Type Generation:** `kysely-codegen` introspects the database and generates TypeScript interfaces. Run as a post-migration script. Eliminates drift between schema and types.

**Core Schema Entities:**

```
users              — Firebase UID (string PK), profile, background questionnaire
tracks             — Learning tracks (e.g., "Build Your Own Database")
milestones         — Ordered within tracks (5 for MVP), content references
sessions           — User work sessions with start/end, milestone FK
code_snapshots     — Auto-saved code state (30-60s interval), session FK, append-only
submissions        — Code submissions with compilation/benchmark results
benchmark_results  — Normalized ratios per submission, user + reference timings
tutor_messages     — AI conversation history per session
session_summaries  — Pre-computed plain text summaries at session end
```

**Key Modeling Decisions:**
- `users.id` = Firebase UID (string PK, not auto-increment) — avoids a mapping table
- `code_snapshots` is append-only; latest snapshot retrieved by timestamp
- `benchmark_results` stores both user and reference timings for the normalized ratio calculation
- `session_summaries` stored as plain text — injected verbatim into AI tutor system prompt on return

**Migration Strategy:**
- Development: `kysely-ctl` CLI — `migrate:latest`, `migrate:down`, `migrate:make`
- Production: Railway release command (`pnpm --filter backend migrate:latest`) runs before API server starts. If migration fails, deploy is aborted.
- CI: Migrations tested against a throwaway PostgreSQL container in GitHub Actions
- Down migrations are manual only — never auto-rollback in production

**Caching Strategy (Redis):**

| Purpose | Usage | TTL |
|---|---|---|
| Rate limiting | Sliding window counters per uid | Rolling window |
| BullMQ | Job queue backing store | Managed by BullMQ |
| Session cache | Active workspace state (current milestone, code snapshot) | 30 min after last activity |
| Milestone config | Cached milestone briefs, acceptance criteria, stuck thresholds | Until content deploy invalidates |
| Execution event log | SSE reconnect replay buffer per submission | 5 min after job completion |

No application-level query caching for MVP. PostgreSQL handles read patterns at 100 users. PgBouncer connection pooling added if connection count becomes an issue.

### Frontend Architecture

**State Management:**

| Layer | Tool | Scope |
|---|---|---|
| Server state | TanStack Query (React Query v5) | Workspace data, milestone content, progress, submissions, benchmark results. Caching, background refetch, optimistic updates. |
| UI state | Zustand (2 stores) | `useWorkspaceUIStore`: panel open/close, tutor expanded/collapsed, stuck detection timer. `useEditorStore`: cursor position, unsaved indicator, auto-save timer. |

Zustand's selector-based subscriptions prevent unnecessary re-renders across workspace panels.

**Routing:** React Router v7, browser history mode. SPA fallback configured in Railway (`_redirects` or Nixpacks config).

Routes:
```
/sign-in, /sign-up       — Firebase Auth
/onboarding               — Background questionnaire (post-signup)
/overview                  — Track overview (milestone grid + trajectory)
/workspace/:milestoneId    — Workspace (editor + terminal + tutor)
/completion/:milestoneId   — Milestone completion
```

Route-level code splitting via `React.lazy()`. Auth guard: `ProtectedRoute` wrapper checks Firebase Auth state, redirects to `/sign-in` if unauthenticated, redirects to `/onboarding` if questionnaire incomplete.

**Monaco Editor:**
- `@monaco-editor/react` — loaded lazily only on workspace route
- Go language support only (don't bundle all Monaco languages)
- Custom dark theme matching UX spec color system
- Wrapped in a `<CodeEditor>` boundary component — unit tests mock this wrapper, Playwright tests exercise real Monaco
- Controlled component: value from TanStack Query cache, auto-save via debounced mutation (30-60s)
- **Workspace reveal staging:** Criteria panel and milestone brief render immediately from single-fetch response. Monaco shows skeleton placeholder while loading. User reads brief while editor bootstraps.

**SSE Client Pattern:**

```typescript
useSSE(url, options) → { data, status, error, reconnectCount }
```

- Accepts injectable `EventSource` constructor for test dependency injection
- Built on native `EventSource` — handles Railway 5-min timeout and network drops via auto-reconnect
- `Last-Event-ID` sent on reconnect for replay from Redis event log
- Consumers: tutor panel (persistent), execution results (short-lived), stuck detection (reads from tutor connection)

**API Client:** `apiFetch` utility in `apps/webapp/src/lib/api-fetch.ts` — thin wrapper around `fetch()`:
- Attaches Firebase Bearer token via `getIdToken()`
- Sets JSON headers
- Handles 401 → force token refresh → retry once → redirect to `/sign-in`
- No Axios, no fetch wrapper library. TanStack Query handles retries, caching, error states.

**Bundle Optimization:**
- Route-level code splitting via `React.lazy()` + dynamic imports
- Monaco loaded separately via `@monaco-editor/react` web workers
- shadcn/ui components individually imported (no barrel exports)
- No SSR — pure SPA. Astro website handles SEO.

**Shared Test Utilities:** `packages/config` exports `createTestQueryClient()` (no retries, no cache) and `TestProviders` wrapper component for consistent component test setup.

### Infrastructure & Deployment

**Hybrid Topology:**

```
Railway (web infrastructure)        Fly.io (code execution)
├── api (Fastify web service)       └── Fly Machines (ephemeral)
├── worker (BullMQ processor)           ├── golang:1.23-alpine OCI image
├── postgres (managed)                  ├── Firecracker VM isolation
├── redis (managed)                     ├── spawned per submission via REST API
├── webapp (static, app.mycscompanion.dev)       └── destroyed after completion
└── website (static, mycscompanion.dev)
```

Railway handles the "boring" infrastructure (managed database, managed Redis, static hosting, git-push deploys). Fly.io handles the specialized workload (ephemeral isolated code execution via Firecracker VMs). The worker on Railway calls Fly's REST API to spawn/manage execution VMs.

**CI/CD Pipeline (GitHub Actions):**

```
on push to main:
  1. pnpm install --frozen-lockfile
  2. turbo lint
  3. turbo typecheck
  4. turbo test (Vitest unit/integration)
  5. turbo build (all apps)
  6. Railway auto-deploys from main
```

Turborepo remote caching via Vercel (free tier) for CI build artifact reuse.

**Content CI (FR44):** Separate GitHub Actions workflow on milestone content changes. Runs starter code and reference implementations through the same Fly.io execution environment as production. Validates compilation, test passing, and benchmark baselines.

**Environment Configuration:**
- Production: Railway environment variables per service + Fly.io secrets for Machines API
- Local: `.env.local` per app (gitignored), `.env.example` documents required variables
- Shared secrets: `DATABASE_URL` (api + worker), `REDIS_URL` (api + worker), `FIREBASE_SERVICE_ACCOUNT` (api), `ANTHROPIC_API_KEY` (api), `FLY_API_TOKEN` (worker), `FIREBASE_CONFIG` (webapp, client-side)

**Monitoring & Observability:**

| Concern | Tool |
|---|---|
| Error tracking | Sentry (API + worker + webapp, source maps uploaded during build) |
| Logs | Railway built-in (Fastify `pino` structured JSON) |
| Metrics/Analytics | Metabase (connected to PostgreSQL, dashboards for onboarding canary, benchmarks, sessions) |
| Queue monitoring | Bull Board (route on API at `/admin/queues`, basic auth) |
| Uptime | Railway health checks (`/health`) + BullMQ worker heartbeat |

No custom APM for MVP. Sentry performance monitoring tier available if needed later.

**Database Migrations in Production:**
- Railway release command: `pnpm --filter backend migrate:latest` (runs before API starts)
- Migration failure aborts deploy — previous version stays running
- Down migrations are manual only

### Code Execution Pipeline

**Execution Flow:**

```
User clicks "Submit"
  → POST /api/execution/submit { milestoneId, code }
  → API validates, rate-checks, creates submission row (status: queued)
  → API enqueues BullMQ job { submissionId, milestoneId, code }
  → API returns { submissionId }
  → Client opens SSE at /api/execution/:submissionId/stream
  → Worker picks up job
  → Worker calls Fly Machines API to spawn Firecracker VM (golang:1.23-alpine)
  → Worker streams compilation output via Redis pub/sub → API → SSE
  → If compilation succeeds → run user tests → stream results
  → If tests pass + milestone has benchmarks:
    → Run user benchmark (N iterations, 2 warm-up discarded)
    → Run reference benchmark (same VM, same N)
    → Compute normalized ratio (user_median / reference_median)
    → Stream benchmark results
  → Worker updates submission row (status: completed/failed)
  → Worker sends final SSE event (type: "complete" or "error")
  → Worker destroys Fly Machine
  → SSE connection closes
```

**Fly Machine Specification:**

| Constraint | Configuration |
|---|---|
| Image | `golang:1.23-alpine` (pinned, pre-pushed to Fly registry) |
| Isolation | Firecracker microVM (kernel-level) |
| CPU | 1 shared CPU |
| Memory | 256 MB |
| Network | Disabled (no internet access from user code) |
| Timeout | 60s hard kill (worker destroys Machine) |
| Filesystem | Ephemeral (destroyed with Machine) |
| Lifecycle | Created per submission, destroyed after completion |

**Benchmark Architecture:**
- Sequential execution: user implementation first, then reference implementation, on the **same Fly Machine**. Eliminates host-level variance.
- Warm-up: 2 iterations discarded, then N measured (N configurable per milestone, default 10)
- Normalized ratio: `user_median / reference_median`, stored as decimal (e.g., 1.15 = 15% slower)
- Reference implementations pinned in content repository, validated by Content CI
- Benchmark consistency (±5%) cannot be validated in GitHub Actions. Dedicated Fly environment for benchmark regression testing on content changes.

**`packages/execution` Shared Package:**
- Fly Machine configuration (API calls, resource limits)
- Execution event type definitions (discriminated union)
- Benchmark runner logic (warm-up, iterations, normalization)
- Timeout management
- Imported by: worker (full package), API (event types only), content CI (full package)

Monorepo shared packages: `ui`, `shared`, `config`, `execution` (4 total).

**Cost at 100 Users:** ~$1.32/month for Fly Machines (20s average VM time × 10 submissions/day × 100 users × ~$0.0000022/s).

### AI Tutor Architecture

**Integration:** Direct Anthropic TypeScript SDK — no LangChain, no abstraction layer. Tutor requests go through the API server (tutor plugin), not the worker. API holds the SSE connection to the client and streams Anthropic responses through it.

**Context Assembly:** Every tutor interaction assembles a system prompt from multiple sources:

```
System prompt = [
  Base persona (Socratic tutor instructions, tone, constraints)
  + Milestone brief (what the user is building)
  + Acceptance criteria (what "done" looks like)
  + Current code snapshot (latest auto-saved code)
  + Background questionnaire (role, experience, language)
  + Session summary (if returning user — pre-computed plain text)
  + Stuck detection state (if triggered — stage info)
]
```

The system prompt is stable per session (changes only on auto-save). Anthropic's prompt caching activates automatically — the stable prefix is cached, only the new user message incurs full token cost.

**Message History:** Stored in PostgreSQL (`tutor_messages`). Last N messages loaded per interaction. If conversation exceeds context window, oldest messages dropped (no summarization for MVP — adds latency and complexity).

**Tiered Model Routing:**

| Interaction | Model | Rationale |
|---|---|---|
| Socratic dialogue (default) | Claude Haiku 4.5 | Fast, cheap. Socratic questions don't need deep reasoning. |
| Code analysis (submission has errors) | Claude Sonnet 4.6 | Needs code structure understanding for precise hints. |
| Conceptual explanation (user asks "explain") | Claude Sonnet 4.6 | Deeper explanations benefit from stronger model. |

Routing logic: API inspects interaction context — compilation errors → Sonnet, explanation patterns → Sonnet, default → Haiku.

**Cost at 100 Users:** ~$0.12/user/month (80% Haiku at $0.001/interaction, 20% Sonnet at $0.005/interaction, 5 interactions/session, 2 sessions/week).

**Stuck Detection:**

Client side (`useWorkspaceUIStore`):
- Timer tracks editor inactivity (no keystrokes, no submissions)
- Thresholds loaded from milestone config on workspace mount
- Stage 1 (threshold hit): subtle visual signal on tutor panel
- Stage 2 (threshold × 1.5): auto-expand tutor panel, send stuck event to server

Server side (tutor plugin):
- Receives stuck event via tutor SSE connection
- Injects stuck context into next system prompt: "User inactive for X minutes on [criteria]. Proactively offer a reframing question."
- Tutor responds with targeted Socratic prompt

**Graceful Degradation:**
- Core loop (edit → submit → compile → benchmark) has zero dependency on AI tutor
- Tutor panel shows "AI tutor temporarily unavailable" with retry button
- SSE connection stays open (heartbeat continues), auto-retries Anthropic on next message
- No fallback model provider — if Anthropic is down, tutor is down
- **Testable pattern:** Integration tests kill the Anthropic connection and verify workspace still functions. Tutor panel has an explicit `unavailable` state.

**Abuse Prevention:**
- 30 messages/min per user (Redis sliding window)
- Maximum message length: 2,000 characters
- System prompts are entirely server-assembled — no user-modifiable prompts
- Conversation history is append-only

### Decision Impact Analysis

**Implementation Sequence:**
1. Project scaffold (Turborepo + pnpm + apps + packages)
2. Firebase Auth + Fastify auth plugin + `apiFetch` utility
3. Database schema + Kysely migrations + codegen
4. Curriculum plugin (milestone content serving)
5. Execution pipeline (Fly Machines + worker + SSE streaming)
6. Progress plugin (auto-save, snapshots, session management)
7. AI tutor (Anthropic SDK + context assembly + SSE)
8. Frontend workspace (Monaco + terminal + tutor panel + stuck detection)
9. Landing page (Astro)

**Cross-Component Dependencies:**
- Auth plugin must exist before any other API route (global `onRequest` hook)
- `packages/execution` event types must be defined before worker or API SSE implementation
- `packages/shared` `apiFetch` must exist before any frontend data fetching
- Database schema must exist before progress or tutor message persistence
- Execution pipeline must work before benchmarks can be tested
- Content CI depends on `packages/execution` and Fly Machine configuration

## Implementation Patterns & Consistency Rules

These patterns prevent conflicts when multiple AI agents implement different parts of the system. Every pattern addresses a specific scenario where two agents could make incompatible choices.

### Naming Patterns

**Database (Kysely + PostgreSQL):**

| Concern | Convention | Example |
|---|---|---|
| Table names | `snake_case`, plural | `users`, `code_snapshots`, `benchmark_results` |
| Column names | `snake_case` | `user_id`, `created_at`, `milestone_id` |
| Foreign keys | `{referenced_table_singular}_id` | `user_id`, `session_id`, `milestone_id` |
| Indexes | `idx_{table}_{columns}` | `idx_users_email`, `idx_submissions_user_id_milestone_id` |
| Enums | `snake_case` type, `snake_case` values | `submission_status`: `queued`, `running`, `completed`, `failed` |
| Timestamps | `_at` suffix, always `timestamptz` | `created_at`, `updated_at`, `completed_at` |
| Entity IDs | `cuid2` (24-char, URL-safe, sortable) | Exception: `users.id` = Firebase UID |

**API (Fastify REST):**

| Concern | Convention | Example |
|---|---|---|
| Route paths | `kebab-case`, plural nouns | `/api/execution/submissions`, `/api/tutor/messages` |
| Route params | `camelCase` | `:milestoneId`, `:submissionId` |
| Query params | `camelCase` | `?pageSize=10&afterCursor=abc` |
| JSON response fields | `camelCase` | `{ milestoneId, createdAt, benchmarkResult }` |
| DB→API conversion | `toCamelCase()` from `packages/shared` | Called in every route handler on Kysely results |
| Pagination | Cursor-based, never offset | `?afterCursor={lastId}&pageSize=20` |

**Code (TypeScript):**

| Concern | Convention | Example |
|---|---|---|
| Utility/plugin files | `kebab-case.ts` | `api-fetch.ts`, `execution-plugin.ts` |
| React components | `PascalCase.tsx` | `BenchmarkHeroDisplay.tsx`, `TutorPanel.tsx` |
| Functions | `camelCase` | `createSubmission()`, `getWorkspaceData()` |
| Variables | `camelCase` | `userId`, `milestoneId` |
| Constants | `SCREAMING_SNAKE_CASE` | `MAX_MESSAGE_LENGTH`, `HEARTBEAT_INTERVAL_MS` |
| Types/interfaces | `PascalCase`, no `I` prefix | `Submission`, `WorkspaceData`, `ExecutionEvent` |
| Fastify plugins | `camelCase` function | `executionPlugin` in `execution-plugin.ts` |
| Zustand stores | `use{Name}Store` | `useWorkspaceUIStore`, `useEditorStore` |
| TanStack Query keys | `[domain, action, params]` | `['workspace', 'get', milestoneId]` |
| Environment variables | `MCC_` prefix for app vars | `MCC_FLY_API_TOKEN`. Third-party vars keep standard names (`ANTHROPIC_API_KEY`). |

**Import Path Conventions:**
- Internal packages: `import { ... } from '@mycscompanion/shared'`, `'@mycscompanion/ui'`, `'@mycscompanion/execution'`, `'@mycscompanion/config'`
- Within an app: relative paths only — no `@/` aliases (Vite and Fastify resolve aliases differently)
- `tsconfig.json` `paths` configured for `@mycscompanion/*` packages only

### Structure Patterns

**Fastify Backend:**

```
apps/backend/src/
├── server.ts                    # Fastify instance + ordered plugin registration
├── plugins/
│   ├── auth/
│   │   ├── index.ts             # Public API (plugin registration, onRequest hook)
│   │   ├── auth-plugin.ts
│   │   ├── auth-plugin.test.ts
│   │   ├── firebase.ts
│   │   └── rate-limiter.ts
│   ├── execution/
│   │   ├── index.ts             # Public API
│   │   ├── execution-plugin.ts
│   │   ├── routes/
│   │   │   ├── submit.ts
│   │   │   ├── submit.test.ts
│   │   │   ├── stream.ts
│   │   │   └── stream.test.ts
│   │   └── services/
│   │       ├── fly-machines.ts
│   │       └── job-publisher.ts
│   ├── tutor/                   # Same pattern
│   ├── curriculum/
│   ├── progress/
│   └── account/
├── shared/
│   ├── db.ts                    # Kysely instance
│   └── redis.ts                 # Redis client
└── worker/
    ├── worker.ts                # BullMQ worker entry point
    └── processors/
        ├── execution-processor.ts
        └── benchmark-runner.ts
```

**Plugin isolation rule:** Plugins only import from `shared/` and `packages/*` — never from other plugins. Each plugin's `index.ts` defines its public API.

**Plugin registration order in `server.ts`:** Documented with comments explaining position:
```typescript
// 1. Auth plugin (global onRequest hook — must be first)
// 2. Rate limiter (depends on auth for uid)
// 3. Domain plugins (depend on auth + rate limiter)
```
New plugins must document their position in this ordered list.

**React Frontend:**

```
apps/webapp/src/
├── main.tsx                     # Entry, router, providers
├── routes/
│   ├── SignIn.tsx
│   ├── Overview.tsx
│   ├── Workspace.tsx            # Lazy-loaded
│   └── Completion.tsx
├── components/
│   ├── workspace/               # Feature-grouped
│   │   ├── CodeEditor.tsx       # Monaco wrapper boundary
│   │   ├── TerminalPanel.tsx
│   │   ├── TutorPanel.tsx
│   │   └── CriteriaPanel.tsx
│   ├── overview/
│   │   ├── MilestoneGrid.tsx
│   │   └── TrajectoryChart.tsx
│   └── common/                  # Shared across routes
│       ├── ProtectedRoute.tsx
│       └── LoadingSkeleton.tsx
├── hooks/
│   ├── use-sse.ts
│   └── use-auto-save.ts
├── stores/
│   ├── workspace-ui-store.ts
│   └── editor-store.ts
├── api/
│   └── queries.ts               # TanStack Query definitions
└── lib/
    └── firebase.ts
```

Components organized **by feature/route**, not by type. Common components in `common/`.

**Test Location:** Co-located. `{source-file}.test.ts` next to the file it tests. Never `.spec.ts`, never `__tests__/` directories. Exception: Playwright E2E tests in `apps/webapp/e2e/`.

**Barrel Files (`index.ts`):** Every module exports via `index.ts`. Not exported = private to that module. Exception: `packages/ui` uses individual component imports (no barrel) for tree-shaking.

### Format Patterns

**API Responses:**

```typescript
// Success — direct response, no wrapper
GET /api/workspace/:milestoneId
→ 200 { milestoneId, brief, criteria, code, stuckThresholds, ... }

// Platform error
→ 500 { error: { code: "INTERNAL_ERROR", message: "..." } }

// Validation error
→ 400 { error: { code: "VALIDATION_ERROR", message: "...", fields: { ... } } }

// Auth error
→ 401 { error: { code: "UNAUTHORIZED", message: "..." } }

// Rate limited
→ 429 { error: { code: "RATE_LIMITED", message: "...", retryAfter: 30 } }
```

No success wrapper. Direct response for success. Structured `{ error: { code, message } }` for errors.

**Date/Time:** ISO 8601 strings in API responses (`2026-02-25T16:30:00Z`). Stored as `timestamptz` in PostgreSQL. Display formatting in frontend only.

**Null Handling:** Explicitly typed as `T | null`. Never `undefined` in API responses. `null` = "explicitly absent."

### Communication Patterns

**SSE Events:** Match `ExecutionEvent.type` discriminated union in `packages/execution`. Events are `snake_case`: `compile_output`, `test_result`, `benchmark_progress`.

**BullMQ Jobs:** `{domain}:{action}` format — `execution:run`, `progress:auto-save`, `progress:session-summary`.

**Logging (Fastify `pino`):**
- `error` — platform errors (→ Sentry)
- `warn` — degraded state (Anthropic timeout, slow query)
- `info` — business events (submission created, session started, milestone completed)
- `debug` — development only

**Privacy rule:** Never log user code content or AI conversation content at `info` level or above.

### Process Patterns

**Error Handling:**
```typescript
// Plugin-level error handler in server.ts
fastify.setErrorHandler((error, request, reply) => {
  if (error.statusCode >= 500) sentry.captureException(error);
  reply.status(error.statusCode ?? 500).send({
    error: { code: error.code ?? 'INTERNAL_ERROR', message: error.message }
  });
});
```
User-code errors never throw — they're SSE event payloads. Only platform errors use Fastify's error handler.

**Loading States (React):**
```typescript
const { data, isLoading, error } = useWorkspaceQuery(milestoneId);
if (isLoading) return <WorkspaceSkeleton />;
if (error) return <ErrorState error={error} />;
return <Workspace data={data} />;
```
Purpose-built skeleton per screen. No generic spinners.

**Validation:** Fastify JSON Schema validation at the API boundary. No runtime validation inside services — trust internal data.

### Test Patterns

**Test Structure:**
```typescript
describe('{ModuleName}', () => {
  describe('{functionName}', () => {
    it('should {expected behavior} when {condition}', () => {});
  });
});
```
Always `it()`, never `test()`. `describe` mirrors module structure.

**Mock Patterns (canonical implementations in `packages/config/test-utils/`):**

| What | Mock Strategy |
|---|---|
| Fastify routes | `fastify.inject()` — never supertest or real HTTP |
| Database | Test transaction per test (Kysely), rolls back after each. Real PostgreSQL — never SQLite. |
| Fly Machines API | `msw` (Mock Service Worker) at HTTP level |
| Firebase Auth | Mock `verifyIdToken()` to return test uid |
| Anthropic SDK | Mock streaming response with scripted chunks |
| SSE (`useSSE` hook) | Injectable `EventSource` constructor with scripted events |
| TanStack Query | `createTestQueryClient()` (no retries, no cache) + `TestProviders` wrapper |

**Test Database:** Real PostgreSQL in all environments. Docker container in CI (GitHub Actions). Local PostgreSQL in dev. No in-memory substitution.

### Enforcement Guidelines

**All AI agents MUST:**
1. Check `index.ts` barrel files before importing from any module
2. Run `toCamelCase()` on all Kysely results before `reply.send()`
3. Use `cuid2` for new entity IDs (never auto-increment, never UUID)
4. Co-locate test files as `{source}.test.ts`
5. Follow cursor pagination for any list endpoint
6. Add new Fastify plugins to the ordered registration list in `server.ts` with a position comment
7. Use `@mycscompanion/*` for package imports, relative paths within apps
8. Never log user code or AI conversations at `info` level or above

**Anti-Patterns (never do these):**
- `import { ... } from '../../plugins/tutor/internal-service'` — cross-plugin import
- `{ data: result, success: true, error: null }` — wrapper response format
- `?page=2&limit=20` — offset pagination
- `UserCard.spec.tsx` or `__tests__/UserCard.test.tsx` — wrong test location/naming
- `const userId: number = 1` — integer IDs
- `import * from '@mycscompanion/ui'` — barrel import from UI package

## Project Structure & Boundaries

### Complete Project Directory Structure

```
mycscompanion/
├── .github/
│   └── workflows/
│       ├── ci.yml                        # Lint, typecheck, test, build (all apps)
│       └── content-ci.yml                # Milestone content validation
├── .env.example                          # Documents all env vars across services
├── .nvmrc                                # Node.js version (>=20)
├── docker-compose.yml                    # Local dev: PostgreSQL 16 + Redis 7
├── turbo.json                            # Pipeline: build, dev, test, lint, typecheck
├── package.json                          # pnpm workspaces root
├── pnpm-workspace.yaml                   # Workspace definitions (excludes content/)
├── tsconfig.base.json                    # Shared TypeScript base config
│
├── apps/
│   ├── backend/
│   │   ├── README.md                     # Agent orientation: entry points, plugin pattern
│   │   ├── package.json                  # start:api, start:worker, db:migrate, db:types
│   │   ├── tsconfig.json
│   │   ├── Dockerfile                    # Production API image (Railway)
│   │   ├── .dockerignore                 # Excludes node_modules, tests, .env*
│   │   ├── .env.example                  # DATABASE_URL, REDIS_URL, FIREBASE_SERVICE_ACCOUNT,
│   │   │                                 # ANTHROPIC_API_KEY, MCC_FLY_API_TOKEN
│   │   ├── migrations/                   # Kysely migration files (kysely-ctl)
│   │   │   └── *.ts
│   │   └── src/
│   │       ├── server.ts                 # Fastify instance + ordered plugin registration
│   │       ├── plugins/
│   │       │   ├── auth/
│   │       │   │   ├── index.ts          # Public API
│   │       │   │   ├── auth-plugin.ts
│   │       │   │   ├── auth-plugin.test.ts
│   │       │   │   ├── firebase.ts       # Firebase Admin SDK init
│   │       │   │   └── rate-limiter.ts   # Redis sliding window
│   │       │   ├── execution/
│   │       │   │   ├── index.ts
│   │       │   │   ├── execution-plugin.ts
│   │       │   │   ├── routes/
│   │       │   │   │   ├── submit.ts             # POST /api/execution/submit
│   │       │   │   │   ├── submit.test.ts
│   │       │   │   │   ├── stream.ts             # GET /api/execution/:submissionId/stream
│   │       │   │   │   └── stream.test.ts
│   │       │   │   └── services/
│   │       │   │       ├── fly-machines.ts        # Fly Machines API client
│   │       │   │       ├── fly-machines.test.ts
│   │       │   │       └── job-publisher.ts       # BullMQ job enqueue
│   │       │   ├── tutor/
│   │       │   │   ├── index.ts
│   │       │   │   ├── tutor-plugin.ts
│   │       │   │   ├── routes/
│   │       │   │   │   ├── stream.ts             # GET /api/tutor/:sessionId/stream (SSE)
│   │       │   │   │   ├── message.ts            # POST /api/tutor/:sessionId/message
│   │       │   │   │   └── history.ts            # GET /api/tutor/:sessionId/messages
│   │       │   │   └── services/
│   │       │   │       ├── anthropic.ts           # Anthropic SDK, model routing
│   │       │   │       ├── context-assembler.ts   # System prompt assembly
│   │       │   │       └── context-assembler.test.ts
│   │       │   ├── curriculum/
│   │       │   │   ├── index.ts
│   │       │   │   ├── curriculum-plugin.ts
│   │       │   │   └── routes/
│   │       │   │       ├── tracks.ts             # GET /api/curriculum/tracks
│   │       │   │       └── milestones.ts         # GET /api/curriculum/milestones/:id
│   │       │   ├── progress/
│   │       │   │   ├── index.ts
│   │       │   │   ├── progress-plugin.ts
│   │       │   │   └── routes/
│   │       │   │       ├── workspace.ts          # GET /api/workspace/:milestoneId
│   │       │   │       ├── overview.ts           # GET /api/overview
│   │       │   │       ├── completion.ts         # GET /api/completion/:milestoneId
│   │       │   │       ├── auto-save.ts          # POST /api/progress/save
│   │       │   │       └── sessions.ts           # POST /api/progress/sessions
│   │       │   └── account/
│   │       │       ├── index.ts
│   │       │       ├── account-plugin.ts
│   │       │       └── routes/
│   │       │           ├── profile.ts            # GET/PUT /api/account/profile
│   │       │           ├── onboarding.ts         # POST /api/account/onboarding
│   │       │           ├── export.ts             # GET /api/account/export
│   │       │           └── delete.ts             # DELETE /api/account
│   │       ├── shared/
│   │       │   ├── db.ts                 # Kysely instance + connection
│   │       │   └── redis.ts              # Redis client (ioredis)
│   │       └── worker/
│   │           ├── worker.ts             # BullMQ worker entry point (separate Railway service)
│   │           └── processors/
│   │               ├── execution-processor.ts     # Orchestrates Fly Machine lifecycle
│   │               ├── execution-processor.test.ts
│   │               ├── benchmark-runner.ts        # Warm-up, iterations, normalization
│   │               ├── benchmark-runner.test.ts
│   │               ├── auto-save-processor.ts
│   │               └── session-summary-processor.ts
│   │
│   ├── webapp/
│   │   ├── README.md                     # Agent orientation: routes, component patterns
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── vite.config.ts
│   │   ├── index.html
│   │   ├── .env.example                  # VITE_FIREBASE_CONFIG, VITE_API_URL
│   │   ├── playwright.config.ts          # Playwright config at app root
│   │   ├── e2e/                          # Playwright E2E tests
│   │   │   ├── fixtures/                 # Auth state, test data
│   │   │   ├── workspace.spec.ts
│   │   │   └── onboarding.spec.ts
│   │   └── src/
│   │       ├── main.tsx                  # Entry, router, providers
│   │       ├── routes/
│   │       │   ├── SignIn.tsx
│   │       │   ├── SignUp.tsx
│   │       │   ├── Onboarding.tsx
│   │       │   ├── Overview.tsx
│   │       │   ├── Workspace.tsx         # React.lazy() loaded
│   │       │   └── Completion.tsx
│   │       ├── components/
│   │       │   ├── workspace/
│   │       │   │   ├── CodeEditor.tsx            # Monaco wrapper boundary
│   │       │   │   ├── CodeEditor.test.tsx
│   │       │   │   ├── TerminalPanel.tsx
│   │       │   │   ├── TerminalPanel.test.tsx
│   │       │   │   ├── TutorPanel.tsx
│   │       │   │   ├── TutorPanel.test.tsx
│   │       │   │   ├── CriteriaPanel.tsx
│   │       │   │   └── WorkspaceSkeleton.tsx
│   │       │   ├── overview/
│   │       │   │   ├── MilestoneGrid.tsx
│   │       │   │   ├── TrajectoryChart.tsx
│   │       │   │   └── OverviewSkeleton.tsx
│   │       │   ├── onboarding/
│   │       │   │   ├── BackgroundQuestionnaire.tsx
│   │       │   │   └── SkillFloorCheck.tsx
│   │       │   └── common/
│   │       │       ├── ProtectedRoute.tsx
│   │       │       ├── LoadingSkeleton.tsx
│   │       │       └── ErrorState.tsx
│   │       ├── hooks/
│   │       │   ├── use-sse.ts
│   │       │   ├── use-sse.test.ts
│   │       │   ├── use-auto-save.ts
│   │       │   └── use-stuck-detection.ts
│   │       ├── stores/
│   │       │   ├── workspace-ui-store.ts
│   │       │   ├── workspace-ui-store.test.ts
│   │       │   ├── editor-store.ts
│   │       │   └── editor-store.test.ts
│   │       ├── api/
│   │       │   └── queries.ts            # TanStack Query definitions
│   │       └── lib/
│   │           ├── firebase.ts           # Firebase client SDK init
│   │           └── api-fetch.ts          # apiFetch utility (Firebase token, 401 handling)
│   │
│   └── website/
│       ├── README.md                     # Agent orientation: Astro patterns, React islands
│       ├── package.json
│       ├── tsconfig.json
│       ├── astro.config.mjs
│       └── src/
│           ├── pages/
│           │   └── index.astro           # Landing page
│           ├── layouts/
│           │   └── Base.astro
│           └── components/               # React islands (from @mycscompanion/ui)
│
├── packages/
│   ├── ui/
│   │   ├── README.md                     # No barrel file — import components individually
│   │   ├── package.json                  # name: @mycscompanion/ui
│   │   ├── tailwind.preset.ts            # Shared design tokens
│   │   └── src/
│   │       ├── components/               # shadcn/ui components
│   │       │   ├── Button.tsx
│   │       │   ├── Card.tsx
│   │       │   ├── Input.tsx
│   │       │   └── ...
│   │       └── benchmark/
│   │           └── BenchmarkHeroDisplay.tsx
│   │
│   ├── shared/
│   │   ├── README.md                     # Agent orientation: public API via index.ts
│   │   ├── package.json                  # name: @mycscompanion/shared, scripts: { db:types }
│   │   └── src/
│   │       ├── index.ts                  # Barrel file — public API
│   │       ├── to-camel-case.ts          # DB→API key transformer
│   │       ├── to-camel-case.test.ts
│   │       ├── types/
│   │       │   ├── api.ts                # API response/request types
│   │       │   ├── domain.ts             # Shared domain types
│   │       │   └── db.ts                 # Generated by kysely-codegen (gitignored)
│   │       └── constants.ts
│   │
│   ├── execution/
│   │   ├── README.md                     # Agent orientation: execution domain contract
│   │   ├── package.json                  # name: @mycscompanion/execution
│   │   └── src/
│   │       ├── index.ts                  # Barrel file — public API
│   │       ├── events.ts                 # ExecutionEvent discriminated union
│   │       ├── events.test.ts
│   │       ├── fly-config.ts             # Fly Machine resource limits, image config
│   │       ├── benchmark.ts              # Benchmark runner logic
│   │       ├── benchmark.test.ts
│   │       └── timeout.ts                # Timeout management
│   │
│   └── config/
│       ├── README.md                     # Agent orientation: shared configs + test utils
│       ├── package.json                  # name: @mycscompanion/config
│       ├── eslint.config.js
│       ├── tsconfig.base.json
│       ├── vitest.config.ts              # Base Vitest (resolves @mycscompanion/* imports)
│       └── test-utils/
│           ├── index.ts
│           ├── test-query-client.ts      # createTestQueryClient() + TestProviders
│           ├── mock-firebase.ts          # Mock verifyIdToken()
│           ├── mock-anthropic.ts         # Mock streaming responses
│           ├── mock-event-source.ts      # Injectable EventSource for SSE tests
│           ├── mock-fly-machines.ts      # MSW handlers for Fly Machines API
│           └── test-db.ts               # Kysely test transaction (rollback per test)
│
├── infra/
│   └── fly-execution/
│       ├── Dockerfile                    # golang:1.23-alpine + workspace setup
│       └── fly.toml                      # Fly registry config for execution image
│
└── content/                              # NOT a pnpm workspace — read directly
    ├── schema/
    │   ├── acceptance-criteria.schema.json
    │   └── benchmark-config.schema.json
    ├── prompts/
    │   ├── tutor-base.md                 # Socratic tutor system prompt template
    │   └── stuck-intervention.md         # Stuck detection intervention prompt
    └── milestones/
        ├── 01-kv-store/
        │   ├── brief.md
        │   ├── starter-code/
        │   ├── reference-impl/
        │   ├── acceptance-criteria.yaml
        │   ├── benchmark-config.yaml
        │   └── assets/                   # Visual concept explainer SVGs
        │       └── *.svg
        ├── 02-storage-engine/
        ├── 03-btree-indexing/
        ├── 04-query-parser/
        └── 05-transactions/
```

### Architectural Boundaries

**Plugin Isolation:** Each Fastify plugin is a bounded context. Plugins import only from `shared/` and `packages/*` — never cross-plugin. Communication between domains happens through the database or Redis, not direct function calls.

**Frontend↔Backend:** All communication via REST + SSE through `apiFetch`. Frontend never accesses the database.

**Worker↔API:** Communicate exclusively through BullMQ (job dispatch) and Redis pub/sub (event streaming). Worker and API share one codebase (`apps/backend`) but run as separate Railway services with separate entry points (`start:api` vs `start:worker`).

**Execution Boundary:** `packages/execution` defines the contract. Worker and content CI import the full package. API imports event types only. Fly Machine details are encapsulated — if execution infrastructure changes, only `packages/execution` and the worker processor change.

**Content Boundary:** `content/` is not a TypeScript package. Backend reads milestone data at runtime (or at deploy via a content-loading script). Content CI validates against JSON schemas in `content/schema/`. Content changes trigger `content-ci.yml`, not the main CI.

### FR Category → Structure Mapping

| FR Category | Primary Location | Supporting |
|---|---|---|
| Learning Experience (FR1-8) | `webapp/routes/Workspace.tsx`, `components/workspace/` | `plugins/curriculum/`, `plugins/progress/` |
| Onboarding (FR9-13) | `webapp/routes/Onboarding.tsx`, `components/onboarding/` | `plugins/account/routes/onboarding.ts` |
| AI Tutoring (FR14-19) | `webapp/components/workspace/TutorPanel.tsx` | `plugins/tutor/`, `hooks/use-sse.ts` |
| Code Execution (FR20-25) | `plugins/execution/`, `worker/processors/` | `packages/execution/`, Fly Machines |
| Progress & Sessions (FR33-39) | `plugins/progress/`, `hooks/use-auto-save.ts` | `stores/`, `packages/shared/types/` |
| Account (FR40-43) | `plugins/account/` | `webapp/routes/SignIn.tsx` |
| Content Pipeline (FR44) | `content/milestones/`, `.github/workflows/content-ci.yml` | `packages/execution/`, `content/schema/` |
| Marketing (FR45-48) | `apps/website/` | `packages/ui/` |
| Admin (FR49-56) | External tools (Bull Board, Metabase, Sentry) | Bull Board route in API |

### External Integration Points

| Service | Integration Point | Auth |
|---|---|---|
| Firebase Auth | `plugins/auth/firebase.ts` (server), `lib/firebase.ts` (client) | Service account / client config |
| Anthropic API | `plugins/tutor/services/anthropic.ts` | `ANTHROPIC_API_KEY` |
| Fly.io Machines | `plugins/execution/services/fly-machines.ts` | `MCC_FLY_API_TOKEN` |
| Redis | `shared/redis.ts` | `REDIS_URL` |
| PostgreSQL | `shared/db.ts` (Kysely) | `DATABASE_URL` |
| Sentry | Fastify error handler + webapp error boundary | `MCC_SENTRY_DSN` |

### Data Flow: Code Submission

```
User (browser) → POST /api/execution/submit → auth hook → rate limiter
  → execution plugin → creates submission row (DB) → enqueues BullMQ job (Redis)
  → returns { submissionId } → client opens SSE

Worker picks up job → calls Fly Machines API → creates Firecracker VM
  → sends user code to VM → VM compiles Go code
  → worker reads output → publishes to Redis channel + writes to Redis list
  → API subscribes to channel → forwards events to client SSE
  → phases: preparing → compiling → testing → benchmarking
  → worker stores results in DB → destroys Fly Machine → sends "complete" event
```

### Development Workflow

**Local development:**
```bash
docker compose up -d          # PostgreSQL + Redis
pnpm install                  # Install all dependencies
pnpm dev                      # Turborepo runs all 3 apps concurrently
```

**After schema changes:**
```bash
pnpm --filter backend db:migrate    # Run migrations
pnpm --filter shared db:types       # Regenerate Kysely types
```

**Railway deployment:**
- API service: `start:api` command, release command runs migrations first
- Worker service: `start:worker` command, same codebase different entry point
- Static sites: Turborepo build output auto-deployed

## Architecture Validation Results

### Coherence Validation

**Decision Compatibility:** All technology choices work together without conflicts. The hybrid Railway + Fly.io topology is reflected consistently — execution uses Fly Machines, everything else uses Railway. Kysely is used throughout (Drizzle never referenced). SSE patterns use `fastify-sse-v2` + `EventSource` + `Last-Event-ID` uniformly across tutor and execution streaming. The `packages/execution` discriminated union is the single source of truth for event types consumed by both worker and API.

**Pattern Consistency:** Naming conventions (snake_case DB → camelCase API via `toCamelCase()`, co-located `.test.ts` files, `cuid2` IDs) are applied uniformly. Plugin isolation rule is respected in the directory structure — no cross-plugin imports exist. Barrel files (`index.ts`) define public APIs for all packages and plugins.

**Structure Alignment:** Project structure supports all architectural decisions. Worker and API share one codebase with separate entry points (`start:api`, `start:worker`). Content is excluded from pnpm workspaces. `packages/execution` is imported by worker (full) and API (types only).

### Requirements Coverage

**All 56 FRs architecturally supported:**

| FR Range | Status | Architectural Support |
|---|---|---|
| FR1-FR11 (Learning) | Covered | Workspace route, curriculum plugin, execution pipeline, terminal/criteria panels, trajectory chart |
| FR12 (Pro Comparison) | Soft MVP — deferred | When implemented: `components/workspace/ProComparison.tsx` + `content/milestones/*/pro-comparison/` |
| FR13 (Visual Explainers) | Covered | SVG assets in `content/milestones/*/assets/`, served via curriculum plugin |
| FR14-FR19 (AI Tutor) | Covered | Tutor plugin, context assembler, SSE streaming, stuck detection |
| FR20-FR25 (Execution) | Covered | Fly Machines, BullMQ, benchmark runner, error classification, rate limiting |
| FR26-FR31 (Onboarding) | Covered | Firebase Auth, questionnaire, skill floor check, graceful redirect |
| FR32 (Email capture) | Growth — deferred | Explicitly not MVP |
| FR33-FR39 (Progress) | Covered | Auto-save, code snapshots, session summaries, single-action resume |
| FR40-FR43 (Account) | Covered | Delete, export, privacy policy, session auto-refresh |
| FR44-FR45 (Content) | Covered | Content CI, JSON schemas, schema validation tests, curriculum plugin |
| FR46-FR50 (Marketing) | Covered | Astro website, Milestone 1 static preview (build-time from content/), OG cards, SEO |
| FR51-FR56 (Admin) | Covered | Railway dashboard, Bull Board, Sentry, Metabase. FR56: prompts in `content/prompts/`, loaded at startup, hot-reloadable via `POST /admin/reload-prompts` |

**NFR Coverage:**

| NFR | Status | Notes |
|---|---|---|
| Performance | Covered | Fly Machine ~300ms boot, SSE streaming, Haiku for <1s TTFT, Monaco lazy-loaded |
| Security | Covered | Firecracker VM isolation (stronger than original Docker spec), Firebase Auth, Redis rate limiting |
| Reliability | Covered | Sequential same-VM benchmarks for ±5% consistency, auto-save with durability, graceful degradation |
| Scalability | Covered | ~$0.26/user/month at 100 users (well under $0.65 ceiling) |
| Accessibility | Covered | Monaco screen reader mode, ARIA live regions, axe-core in CI pipeline |

### Gap Resolutions Applied

| Gap | Resolution |
|---|---|
| Visual explainer assets | Added `content/milestones/*/assets/*.svg` to content structure |
| FR56 tutor prompt config | Added `content/prompts/` with `tutor-base.md` and `stuck-intervention.md`. Loaded at startup via `fs.readFile()`, memory-cached, hot-reloadable via `POST /admin/reload-prompts` (basic auth) |
| Axe-core in CI | Added to `ci.yml` (webapp accessibility check step) |
| Stale cross-subdomain auth text | Updated Context Analysis to reflect elimination decision |
| `apiFetch` location | Moved from `packages/shared` to `apps/webapp/src/lib/api-fetch.ts` (depends on Firebase client SDK). `packages/shared` keeps types and constants only. |
| Node.js version | Added `.nvmrc` and `engines: { node: ">=20.0.0" }` in root `package.json` |
| Milestone 1 preview (FR47) | Astro reads `content/milestones/01-kv-store/` at build time. Static preview on landing page, no API call, no auth. |
| Fly API outage | SSE emits `{ type: 'error', phase: 'preparing', data: 'Execution environment temporarily unavailable. Submission queued.' }`. BullMQ retries automatically. Client shows queued state with retry indicator. |
| Content schema validation | Content CI validates YAML against JSON schemas AND verifies schemas cover all fields the curriculum plugin expects |
| Prompt loading pattern | `fs.readFile()` at startup, memory-cached, hot-reloadable via admin endpoint. No database table for prompts. |

### Architecture Completeness Checklist

**Requirements Analysis**
- [x] Project context thoroughly analyzed (9 cross-cutting concerns)
- [x] Scale and complexity assessed (medium-high, 7 subsystems)
- [x] Technical constraints identified (stack locked, hybrid deployment, solo founder)
- [x] All 56 FRs mapped to architectural components
- [x] All NFRs addressed with measurable targets

**Architectural Decisions**
- [x] Critical decisions documented with rationale
- [x] Technology stack fully specified
- [x] Integration patterns defined (REST, SSE, BullMQ, Redis pub/sub)
- [x] Performance considerations addressed (Fly Machine boot, SSE streaming, lazy loading)
- [x] Cost projections validated (~$0.26/user/month)

**Implementation Patterns**
- [x] Naming conventions established (DB, API, code, files, env vars)
- [x] Structure patterns defined (plugin isolation, co-located tests, barrel files)
- [x] Communication patterns specified (typed events, BullMQ job naming, logging levels)
- [x] Process patterns documented (error handling, loading states, validation)
- [x] Test patterns specified (mock strategies, real PostgreSQL, co-located files)
- [x] Anti-patterns documented

**Project Structure**
- [x] Complete directory structure with all files
- [x] Component boundaries established
- [x] Integration points mapped (6 external services)
- [x] Requirements to structure mapping complete
- [x] Development workflow documented (docker-compose, migrations, type generation)

### Architecture Readiness Assessment

**Overall Status:** READY FOR IMPLEMENTATION

**Confidence Level:** High

**Key Strengths:**
- Hybrid Railway + Fly topology gives best-in-class tool for each concern
- Firecracker VM isolation exceeds original Docker security spec
- Cost well under budget ($0.26 vs $0.65 ceiling)
- Comprehensive test patterns with real PostgreSQL and canonical mocks
- Plugin architecture enables parallel story development with no cross-plugin conflicts
- Typed event schema prevents worker↔API drift

**Areas for Future Enhancement:**
- PgBouncer connection pooling (when connection count grows)
- Warm Fly Machine pool (if cold start latency becomes an issue at scale)
- Multi-provider AI fallback (post-MVP, if Anthropic reliability is a concern)
- RAG with pgvector for cross-milestone tutor context (Growth feature)

### Implementation Handoff

**AI Agent Guidelines:**
- Read `project-context.md` (concise rule sheet) before every story
- Reference this architecture document for detailed decisions
- Follow all naming, structure, and test patterns exactly
- Respect plugin isolation — never import across plugin boundaries
- Use `@mycscompanion/*` for package imports, relative paths within apps

**First Implementation Priority:** Project scaffold — Turborepo + pnpm + apps + packages, `docker-compose.yml`, base configs. Then Day 1 de-risk: Firebase Auth + Fly Machines "hello world" Go compilation to validate the entire execution path.

## Architecture Completion Summary

**Architecture Decision Workflow:** COMPLETED
**Total Steps Completed:** 8
**Date Completed:** 2026-02-25
**Document Location:** `_bmad-output/planning-artifacts/architecture.md`

### Final Deliverables

- **30+ architectural decisions** documented with rationale across 7 categories (Auth, API, Data, Frontend, Infrastructure, Execution, AI Tutor)
- **25+ implementation patterns** for naming, structure, format, communication, process, and testing
- **Complete project structure** — 3 apps, 4 shared packages, infrastructure config, content pipeline
- **56 functional requirements** mapped to specific architectural components
- **All NFRs** addressed with measurable targets and validation strategies
- **4 Party Mode reviews** with enhancements from cross-functional team (Dev, UX, Test Architect, Scrum Master, Quick Flow Dev)

### Key Architectural Decisions Summary

| Decision | Choice |
|---|---|
| Deployment | Hybrid Railway (web infra) + Fly.io (code execution) |
| Code execution | Fly Machines API — ephemeral Firecracker VMs |
| Auth | Firebase Auth on `app.mycscompanion.dev` only, Bearer token + Fastify hook |
| Database | PostgreSQL (Railway managed) + Kysely + `kysely-codegen` |
| API | Fastify with 6 plugin domains, REST, `fastify-sse-v2` for streaming |
| Frontend state | TanStack Query (server) + Zustand (2 UI stores) |
| AI Tutor | Direct Anthropic SDK, tiered routing (Haiku default / Sonnet for code) |
| Worker↔API | BullMQ dispatch + Redis pub/sub streaming + event log replay |
| Testing | Vitest + Playwright, co-located tests, real PostgreSQL, canonical mocks |
| IDs | `cuid2` for all entities (except Firebase UID for users) |
| Pagination | Cursor-based everywhere |
| Monorepo | Turborepo + pnpm, internal packages (no build step) |

---

**Architecture Status:** READY FOR IMPLEMENTATION

**Next Phase:** Create epics and stories, then begin implementation following the architectural decisions and patterns documented herein.

**Document Maintenance:** Update this architecture document when major technical decisions change during implementation.
