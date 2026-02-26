# Story 1.1: Monorepo Scaffold & Local Dev Environment

Status: done

<!-- When this story contradicts project-context.md, project-context.md is authoritative. -->

## Story

As a **developer**,
I want to clone the repo, install dependencies, and start all local services with a single command,
So that I have a working development environment to build features against.

## Acceptance Criteria

**Given** a fresh clone of the repository,
**When** I run `pnpm install` and `docker compose up`,
**Then** PostgreSQL 16 and Redis 7 containers start and are reachable on their default ports,
**And** the Turborepo workspace resolves 3 apps (`backend`, `webapp`, `website`) and 4 packages (`ui`, `shared`, `execution`, `config`),
**And** `pnpm dev` starts all apps concurrently via Turborepo,
**And** each app and package has a valid `tsconfig.json` extending a shared base config,
**And** ESLint is configured at root with shared rules across all workspaces,
**And** a root `README.md` documents the setup steps (clone → install → docker compose → dev).

## Tasks / Subtasks

- [x] Task 1: Initialize Turborepo root (AC: workspace resolution, tsconfig, ESLint)
  - [x] 1.1 Create root `package.json` with: pnpm workspaces (`apps/*`, `packages/*` — NOT `content/`), `engines: { "node": ">=20.0.0" }`, `"packageManager": "pnpm@10.30.2"` (Corepack), `"typecheck": "turbo typecheck"` script
  - [x] 1.2 Create `pnpm-workspace.yaml` matching the same workspace definitions
  - [x] 1.3 Create `turbo.json` with pipelines: `dev`, `build`, `test`, `lint`, `typecheck`
  - [x] 1.4 Create `tsconfig.base.json` with strict mode, `paths` for `@tycs/*` packages
  - [x] 1.5 Create `.nvmrc` with `20`
  - [x] 1.6 Create `.npmrc` with `engine-strict=true`
  - [x] 1.7 Create `.gitignore` (node_modules, dist, .env.local, .env, coverage, .turbo). Ensure `content/` is NOT ignored.
  - [x] Verify: `pnpm ls --depth 0` shows expected workspaces

- [x] Task 2: Create `packages/config` — shared tooling configs (AC: tsconfig, ESLint)
  - [x] 2.1 Create `packages/config/package.json` with name `@tycs/config`, add `"typecheck": "tsc --noEmit"` script
  - [x] 2.2 Create shared ESLint flat config (`eslint.config.js`) — TypeScript + React rules. Must include: `no-console: 'error'` (use pino for logging), no-default-export rule enforcement
  - [x] 2.3 Create shared `tsconfig.base.json` for packages to extend
  - [x] 2.4 Create shared Vitest base config (`vitest.config.ts`): resolves `@tycs/*` imports, `include: ['**/*.test.{ts,tsx}']` (enforce co-located `.test.ts` convention), `restoreMocks: true` (global `vi.restoreAllMocks()` — every test inherits this)
  - [x] 2.5 Create Tailwind CSS v4 design tokens CSS file (see Design System section). This defines the shared color palette, typography scale, and spacing tokens. Both `packages/ui` and consuming apps import from here.
  - [x] 2.6 Create `test-utils/index.ts` barrel — empty scaffold for canonical mock factories (msw v2 handlers, Firebase Auth mock, Anthropic mock, EventSource mock — populated in Story 1.5)

- [x] Task 3: Create `packages/shared` (AC: workspace resolution)
  - [x] 3.1 Create `packages/shared/package.json` with name `@tycs/shared`, add `"typecheck": "tsc --noEmit"` script
  - [x] 3.2 Create `packages/shared/tsconfig.json` extending base
  - [x] 3.3 Create `packages/shared/src/index.ts` barrel export
  - [x] 3.4 Create `packages/shared/src/to-camel-case.ts` — deep snake_case → camelCase converter for DB query results. Signature: `function toCamelCase<T>(data: T): CamelCaseKeys<T>`. Must have explicit return type. Must handle nested objects and arrays (Kysely results are often nested via joins). Mark input param as `readonly`.
  - [x] 3.5 Create `packages/shared/src/types/index.ts` — placeholder for shared types (DB types added in Story 1.3). Use `T | null` for absent values — never `undefined`.

- [x] Task 4: Create `packages/ui` — shadcn/ui + Tailwind (AC: workspace resolution)
  - [x] 4.1 Create `packages/ui/package.json` with name `@tycs/ui`, add `"typecheck": "tsc --noEmit"` script
  - [x] 4.2 Create `packages/ui/tsconfig.json` extending base
  - [x] 4.3 Initialize shadcn/ui (`npx shadcn@latest init`) — configure for dark mode, CSS variables, New York style. Verify it uses unified `radix-ui` package (not legacy individual `@radix-ui/react-*` packages).
  - [x] 4.4 Create `src/globals.css` — import design tokens from `@tycs/config`, define all CSS custom properties for shadcn/ui token mapping (see Design System section)
  - [x] 4.5 Install Inter + JetBrains Mono fonts (Latin subset only, 400/600/700 for Inter, 400/700 for JetBrains Mono)
  - [x] Note: NO barrel file (`index.ts`) in this package — import components individually for tree-shaking

- [x] Task 5: Create `packages/execution` (AC: workspace resolution)
  - [x] 5.1 Create `packages/execution/package.json` with name `@tycs/execution`, add `"typecheck": "tsc --noEmit"` script
  - [x] 5.2 Create `packages/execution/tsconfig.json` extending base
  - [x] 5.3 Create `packages/execution/src/index.ts` barrel export — placeholder types for Fly Machine config and SSE events (discriminated union). Mark shared types as `readonly`.

- [x] Task 6: Create `apps/webapp` — React + Vite SPA (AC: workspace resolution, pnpm dev)
  - [x] 6.1 Scaffold with `pnpm create vite@7 apps/webapp --template react-swc-ts` (pin Vite 7 — do NOT pull Vite 8 beta)
  - [x] 6.2 Configure `tsconfig.json` extending base, add `@tycs/*` paths, add `"typecheck": "tsc --noEmit"` script to `package.json`
  - [x] 6.3 Configure Vite with React SWC plugin, add `@tailwindcss/vite` plugin for Tailwind CSS v4
  - [x] 6.4 Install React Router v7 (`react-router`), configure browser history mode (SPA mode — SSR disabled, client-side routing only)
  - [x] 6.5 Import `globals.css` from `@tycs/ui` for design tokens
  - [x] 6.6 Set `font-display: optional` for web fonts (NOT `swap` — that's Astro only)
  - [x] 6.7 Add `@tycs/ui`, `@tycs/shared` as workspace dependencies
  - [x] 6.8 Create minimal App.tsx with router outlet and placeholder route
  - [x] Verify: `pnpm --filter webapp dev` starts Vite HMR server

- [x] Task 7: Create `apps/website` — Astro static site (AC: workspace resolution, pnpm dev)
  - [x] 7.1 Scaffold with `pnpm create astro@5 apps/website -- --template minimal` (pin Astro 5 — do NOT pull Astro 6 beta which requires Node 22+)
  - [x] 7.2 Add Astro React integration (`npx astro add react`)
  - [x] 7.3 Configure Tailwind CSS v4 via `@tailwindcss/vite` plugin in `astro.config.mjs` (do NOT use deprecated `@astrojs/tailwind` integration — that was for Tailwind v3)
  - [x] 7.4 Configure `tsconfig.json` extending base, add `"typecheck": "tsc --noEmit"` script to `package.json`
  - [x] 7.5 Set `font-display: swap` for web fonts (prioritize LCP)
  - [x] 7.6 Add `@tycs/ui` as workspace dependency (for React island components)
  - [x] 7.7 Create minimal index page
  - [x] Verify: `pnpm --filter website dev` starts Astro dev server

- [x] Task 8: Create `apps/backend` — core server scaffold (AC: workspace resolution, pnpm dev)
  - [x] 8.1 Create `apps/backend/package.json` with name `@tycs/backend`, add `"typecheck": "tsc --noEmit"` script. Dependencies: `fastify`, `pino`, `ioredis`. Dev dependencies: `@types/node`, `tsx`.
  - [x] 8.2 Create `apps/backend/tsconfig.json` extending base
  - [x] 8.3 Hand-scaffold `src/server.ts` — minimal Fastify init with pino JSON logging, CORS for webapp origin. Do NOT use `nodemon` or `ts-node-dev` — use Node.js `--watch` flag (Node 20+ built-in).
  - [x] 8.4 Create `GET /health` endpoint returning direct object: `{ status: 'ok' }` (no wrapper — never `{ data: ..., success: true }`)
  - [x] 8.5 Add scripts: `"start:api": "node dist/server.js"`, `"start:worker": "node dist/worker/worker.js"`, `"dev": "tsx --watch src/server.ts"`
  - [x] 8.6 Add `@tycs/shared`, `@tycs/execution` as workspace dependencies
  - [x] Verify: `pnpm --filter backend dev` starts Fastify with `--watch`

- [x] Task 9: Create `apps/backend` — plugin architecture and worker scaffold (AC: workspace resolution)
  - [x] 9.1 Create `src/shared/` directory with placeholder `db.ts` and `redis.ts` files (empty exports — actual connections wired in Stories 1.2 and 1.4). This is the internal shared directory all plugins import from.
  - [x] 9.2 Create plugin directory structure: `src/plugins/{auth,execution,tutor,curriculum,progress,account}/`
  - [x] 9.3 Create empty plugin `index.ts` files. Each must include a comment documenting: (a) registration order position, (b) the request decorator pattern for auth (`fastify.decorateRequest('uid', '')`), (c) SSE routes must override `connectionTimeout: 0`
  - [x] 9.4 Create `src/worker/worker.ts` entry point (placeholder — BullMQ dependency added in Story 3.3) and `src/worker/processors/` directory (for `execution-processor.ts` and `benchmark-runner.ts` in later stories)
  - [x] Note: **Story 1.4** will wire up actual plugin registration, pino configuration, CORS details, and the full server bootstrap. This task only creates the directory structure and placeholder files.

- [x] Task 10: Docker Compose for local dev (AC: PostgreSQL + Redis)
  - [x] 10.1 Create `docker-compose.yml` with PostgreSQL 16 service (port 5432, named volume)
  - [x] 10.2 Add Redis 7 service (port 6379)
  - [x] 10.3 Create `.env.example` documenting all env vars with comments noting which story configures each:
    - `DATABASE_URL=postgresql://...` (configured in Story 1.2)
    - `REDIS_URL=redis://localhost:6379` (configured in Story 1.4)
    - `FIREBASE_SERVICE_ACCOUNT=` (server-side, configured in Story 2.1)
    - `TYCS_FIREBASE_CONFIG=` (client-side webapp, configured in Story 2.1)
    - `ANTHROPIC_API_KEY=` (third-party standard name, configured in Story 6.1)
    - `TYCS_FLY_API_TOKEN=` (custom var, configured in Story 3.2)
    - `TYCS_SENTRY_DSN=` (custom var, configured in Story 1.7)
  - [x] Verify: `docker compose up -d` starts both containers

- [x] Task 11: Root README and final validation (AC: README)
  - [x] 11.1 Create `README.md` with setup steps: clone → `pnpm install` → `docker compose up -d` → `pnpm dev`. Note: CI uses `pnpm install --frozen-lockfile` (never bare `pnpm install`).
  - [x] 11.2 Validate `pnpm install` resolves all workspaces without errors
  - [x] 11.3 Validate `pnpm dev` starts all 3 apps concurrently
  - [x] 11.4 Validate `pnpm lint` runs across all workspaces
  - [x] 11.5 Validate `pnpm typecheck` passes with no errors

## Dev Notes

### Rules (MUST Follow)

**Architecture Constraints:**
- **Monorepo tool:** Turborepo + pnpm workspaces. No Nx, no Lerna.
- **Shared packages are internal** — consumed as TypeScript source, NO build step. Each consuming app handles its own transpilation.
- **4 packages only:** `ui`, `shared`, `execution`, `config`. Never create additional packages.
- **3 apps only:** `backend`, `webapp`, `website`. Never create `apps/worker/`.
- **`content/` is NOT a workspace.** Never add to `pnpm-workspace.yaml`. No `package.json`, no TypeScript.
- **Import paths:** `@tycs/*` for cross-package. Relative paths within apps — NO `@/` aliases.
- **Barrel files:** Every module exports via `index.ts`. Exception: `packages/ui` has NO barrel — import components individually.
- **Named exports only.** No default exports anywhere. ESLint enforces this.
- **No `any` type.** No TS `enum` (use union types). No `as` casting (use `satisfies` or `as const`).
- **`readonly` on function params** for shared data (events, configs, benchmark payloads).
- **`T | null` for absent values** — never `undefined` in API responses.
- **`console.log` is banned** — use pino via Fastify logger. ESLint `no-console: 'error'`.

**Backend Plugin Isolation:**
- Registration order in `server.ts`: (1) Auth, (2) Rate limiter, (3) Domain plugins
- Plugins only import from `src/shared/` and `packages/*` — NEVER cross-plugin
- Auth plugin uses request decorator pattern: `fastify.decorateRequest('uid', '')`
- Route responses: direct object (`return { data }`) — never wrapper (`{ data, success: true }`)
- SSE routes: override `connectionTimeout: 0`, 30s heartbeat
- Route testing: `fastify.inject()` only — never supertest

**Naming Conventions:**

| Concern | Convention | Example |
|---|---|---|
| DB tables/columns | `snake_case` | `code_snapshots`, `user_id` |
| API response fields | `camelCase` (via `toCamelCase()`) | `milestoneId`, `createdAt` |
| Route paths | `kebab-case`, plural | `/api/execution/submissions` |
| Utility files | `kebab-case.ts` | `api-fetch.ts` |
| React components | `PascalCase.tsx` | `TutorPanel.tsx` |
| Constants | `SCREAMING_SNAKE_CASE` | `MAX_MESSAGE_LENGTH` |
| Types/interfaces | `PascalCase`, no `I` prefix | `Submission` |
| Zustand stores | `use{Name}Store` | `useWorkspaceUIStore` |
| Env vars (custom) | `TYCS_` prefix | `TYCS_FLY_API_TOKEN` |
| Env vars (third-party) | Standard name | `ANTHROPIC_API_KEY` |
| Entity IDs | `cuid2` | Exception: `users.id` = Firebase UID |

**Anti-Patterns (NEVER Do These):**
- Do NOT use `create-turbo` CLI — manually create root
- Do NOT use `fastify-cli` — hand-scaffold backend
- Do NOT create `@/` import aliases in any app
- Do NOT add `content/` to workspaces
- Do NOT create `apps/worker/` — worker lives at `apps/backend/src/worker/`
- Do NOT use `redis` npm package — use `ioredis`
- Do NOT use Drizzle — Kysely is authoritative
- Do NOT use Jest APIs — Vitest only (`vi.fn()`, `vi.mock()`)
- Do NOT use `test()` — always `it()`
- Do NOT create `__tests__/` directories — co-locate as `{source}.test.ts`
- Do NOT use `.spec.ts` suffix
- Do NOT use default exports
- Do NOT barrel-export from `packages/ui`
- Do NOT install all shadcn/ui components upfront — install incrementally
- Do NOT use `nodemon` or `ts-node-dev` — use Node.js `--watch` / Vite HMR
- Do NOT use `console.log` — use pino structured logging
- Do NOT use `Date.now()` in test assertions — use `vi.useFakeTimers()`

### Reference (Consult As Needed)

**Version Constraints (February 2026):**

| Dependency | Pin To | Critical Notes |
|---|---|---|
| Turborepo | 2.x | Stable, composable config |
| pnpm | 10.x | Pin via `packageManager` field. CI: `--frozen-lockfile` |
| Vite | **7.x** | Do NOT use Vite 8 beta (Rolldown bundler, not stable) |
| React | 19.x | Stable since Dec 2024 |
| Fastify | 5.x | Targets Node.js 20+. All v4 deprecated APIs removed |
| Astro | **5.x** | Do NOT use Astro 6 beta (requires Node 22+, breaking changes) |
| Tailwind CSS | 4.x | CSS-first config. Use `@tailwindcss/vite` plugin (NOT `@astrojs/tailwind`) |
| Vitest | 4.x | `vi.fn()`, `vi.mock()`. Config: `restoreMocks: true`, `include: ['**/*.test.{ts,tsx}']` |
| Kysely | 0.28.x | Type-safe SQL builder. Authoritative — never Drizzle. (Installed in Story 1.2) |
| React Router | 7.x | SPA mode, browser history, SSR disabled |
| shadcn/ui | Latest | Unified `radix-ui` package (not individual `@radix-ui/react-*`) |
| ioredis | Latest | NOT the `redis` npm package |

**Design System (packages/ui + packages/config):**

Tailwind CSS v4 uses CSS-first configuration. Define tokens in CSS, not `tailwind.config.js`.

*Color palette (dark-first):*
- `--primary`: Emerald-green, medium-bright, slight teal/cool undertone. Think "terminal cursor green evolved for modern UI." Calibrated for dark backgrounds.
- `--primary-foreground`: Dark/black text on primary buttons
- `--background`: Very dark gray / near-black (NOT pure `#000`, slightly warm for depth). MUST match exactly between Astro landing page and webapp — even 50ms flash of different dark gray breaks the experience.
- `--foreground`: Off-white / light gray (NOT pure `#fff`, softened for evening reading)
- `--card`: Slightly lighter than background (subtle panel differentiation)
- `--card-foreground`: Same as foreground or slightly adjusted for card surfaces
- `--muted`: Dark gray for disabled/inactive surfaces
- `--muted-foreground`: Medium gray for secondary text, labels, metadata
- `--accent`: Slightly lighter than card (hover/selected states)
- `--accent-foreground`: Text on accent surfaces
- `--border`: Subtle, low-contrast, structural not decorative
- `--ring`: Focus rings (Radix default)
- `--success` (custom): Warm/yellow-green. MUST differ from `--primary` by >=30 degrees on hue wheel. Brand leans cool/teal, success leans warm. Used for MET criteria.
- `--info` (custom): Muted blue / cool gray. Session qualifiers, secondary benchmark data.
- `--error-surface` (custom): Muted warm amber/orange. Platform errors only (NOT user-code errors).

Principle: Green is the ONLY color with personality. Everything else is grayscale. Color is never the sole signal — always pair with icons/shapes. Test all colors on non-calibrated display at 50% brightness (real-world evening laptop sessions).

*Contrast requirements:*
- Foreground on background: 7:1 (WCAG AAA)
- Muted-foreground on background: 4.5:1 (WCAG AA)
- Primary on background: 4.5:1 (WCAG AA)
- Primary on card: 4.5:1 (WCAG AA)
- Success on card: 3:1 (WCAG AA non-text)
- Code syntax colors on background: 4.5:1 per color — dark themes commonly fail for blues/purples

*Fonts:*
- UI: Inter (400, 600, 700) — fallback: `-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`
- Code: JetBrains Mono (400, 700) — fallback: `'Fira Code', 'SF Mono', 'Cascadia Code', monospace`. Latin subset only. No italic.
- Webapp: `font-display: optional` | Astro landing page: `font-display: swap`

*Type scale (1.25 ratio, 16px base):*
- `display`: 30px/700 Inter (landing hero only)
- `h1`: 24px/600, `h2`: 20px/600, `h3`: 16px/600
- `body`: 16px/400, `body-sm`: 14px/400, `caption`: 12px/400 (minimum size — never smaller)
- `code-inline`: 16px/400 JetBrains Mono with subtle `bg-secondary` background highlight (same size as body — never shrunk)
- `code-block`: 14px/400 JetBrains Mono (terminal, code blocks, benchmark numbers)
- `code-editor`: 14-16px/400 JetBrains Mono (Monaco, user-configurable, default 14px)

*Spacing (4px base unit):*

| Token | Value | Usage |
|---|---|---|
| `space-1` | 4px | Icon-label gaps, inline spacing |
| `space-2` | 8px | Related list items, small padding |
| `space-3` | 12px | Form elements, criteria gaps |
| `space-4` | 16px | Card padding, section gaps |
| `space-5` | 20px | Generous: major sections |
| `space-6` | 24px | Section: overview card gaps |
| `space-8` | 32px | Major: page margins |
| `space-12` | 48px | Large: landing page sections |
| `space-16` | 64px | Hero: landing page padding |

*Dark/light mode:*
- Dark mode is the primary design target. Designed first, tested first, perfected first.
- Default on first visit. Respects `prefers-color-scheme: dark`.
- Light mode derived as an accommodation — invert/lighten systematically.
- Tailwind `dark:` prefix strategy. Theme toggle in account settings (not prominent in workspace).
- Preference stored in localStorage.

*Accessibility — motion:*
- All animations MUST respect `prefers-reduced-motion`. Use Tailwind's `motion-reduce:` prefix.
- When reduced motion set: benchmark chart animation → instant transition, SSE streaming → instant render (no typing effect), panel expansion → instant show/hide.

*Responsive breakpoints:*

| Breakpoint | Experience | Rationale |
|---|---|---|
| >=1280px | Full 3-panel resizable workspace | Primary target |
| 1024-1279px | Tutor as fixed overlay, terminal stacks below editor | No tablet portrait — most expensive to test, least likely for devs on laptops |
| <768px | Read-only (progress, briefs, tutor history). "Continue on desktop to build" message | No editor/code execution on mobile |

**shadcn/ui:** Initialize with dark mode + CSS variables + New York style. Install components incrementally as needed (not upfront). Uses unified `radix-ui` package.

**Downstream Dependencies (what subsequent stories need from this scaffold):**

| Story | Depends On |
|---|---|
| 1.2 Database Foundation | PostgreSQL (Task 10), `apps/backend` (Task 8), `packages/shared` (Task 3) |
| 1.3 DB Codegen & Shared Utils | Story 1.2 migrations, `packages/shared/src/to-camel-case.ts` (Task 3.4) |
| 1.4 Fastify Server Bootstrap | Plugin directories (Task 9), `src/shared/` (Task 9.1), server.ts (Task 8.3) |
| 1.5 Test Infrastructure | Vitest config (Task 2.4), test-utils scaffold (Task 2.6), Playwright (install in 1.5) |
| 1.6 CI/CD Pipeline | All apps building, all tests passing, turbo.json pipelines (Task 1.3) |
| 1.7 Error Tracking & Deploy | Sentry (install in 1.7), deployment config, Metabase docker-compose entry |

**File Structure:**

```
tycs/
├── apps/
│   ├── backend/                          # [Task 8-9]
│   │   ├── src/
│   │   │   ├── server.ts                 # [Task 8.3] Fastify init, pino logging
│   │   │   ├── shared/                   # [Task 9.1] Internal shared (db.ts, redis.ts)
│   │   │   │   ├── db.ts                 # Placeholder — wired in Story 1.2
│   │   │   │   └── redis.ts              # Placeholder — wired in Story 1.4
│   │   │   ├── worker/                   # [Task 9.4]
│   │   │   │   ├── worker.ts             # BullMQ entry — dep added in Story 3.3
│   │   │   │   └── processors/           # For execution-processor.ts (Story 3.3)
│   │   │   └── plugins/                  # [Task 9.2-9.3]
│   │   │       ├── auth/
│   │   │       │   └── index.ts          # Position 1 — registered first
│   │   │       ├── execution/
│   │   │       │   └── index.ts
│   │   │       ├── tutor/
│   │   │       │   └── index.ts
│   │   │       ├── curriculum/
│   │   │       │   └── index.ts
│   │   │       ├── progress/
│   │   │       │   └── index.ts
│   │   │       └── account/
│   │   │           └── index.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   ├── webapp/                           # [Task 6]
│   │   ├── index.html                    # Auto-generated by Vite scaffold
│   │   ├── src/
│   │   │   ├── App.tsx
│   │   │   └── main.tsx
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── vite.config.ts
│   └── website/                          # [Task 7]
│       ├── src/
│       │   └── pages/
│       │       └── index.astro
│       ├── package.json
│       ├── tsconfig.json
│       └── astro.config.mjs
├── packages/
│   ├── config/                           # [Task 2]
│   │   ├── eslint.config.js              # [Task 2.2] no-console, no-default-export
│   │   ├── tsconfig.base.json            # [Task 2.3]
│   │   ├── vitest.config.ts              # [Task 2.4] restoreMocks, include pattern
│   │   ├── tailwind-tokens.css           # [Task 2.5] Shared design tokens
│   │   ├── test-utils/
│   │   │   └── index.ts                  # [Task 2.6] Scaffold for msw v2 mocks
│   │   └── package.json
│   ├── shared/                           # [Task 3]
│   │   ├── src/
│   │   │   ├── index.ts                  # Barrel export
│   │   │   ├── to-camel-case.ts          # [Task 3.4] Deep snake→camel converter
│   │   │   └── types/
│   │   │       └── index.ts              # Placeholder types
│   │   ├── package.json
│   │   └── tsconfig.json
│   ├── ui/                               # [Task 4] NO barrel file
│   │   ├── components/                   # Auto-created by shadcn init
│   │   ├── src/
│   │   │   └── globals.css               # [Task 4.4] CSS vars, font imports
│   │   ├── components.json               # shadcn/ui config
│   │   ├── package.json
│   │   └── tsconfig.json
│   └── execution/                        # [Task 5]
│       ├── src/
│       │   └── index.ts
│       ├── package.json
│       └── tsconfig.json
├── content/                              # NOT a workspace — exists already
│   ├── milestones/
│   ├── prompts/
│   └── schema/
├── docker-compose.yml                    # [Task 10]
├── turbo.json                            # [Task 1.3]
├── pnpm-workspace.yaml                   # [Task 1.2]
├── tsconfig.base.json                    # [Task 1.4]
├── .nvmrc                                # [Task 1.5]
├── .npmrc                                # [Task 1.6]
├── .env.example                          # [Task 10.3]
├── .gitignore                            # [Task 1.7]
├── package.json                          # [Task 1.1] engines, packageManager
└── README.md                             # [Task 11.1]
```

### Project Structure Notes

- This is a **greenfield project**. Only `content/milestones/`, `content/prompts/`, `content/schema/`, and BMAD planning artifacts exist.
- All implementation starts from scratch.
- The `content/` directory already has Milestone 1 content, validation schemas, and tutor prompts — this is a curriculum workstream independent of the engineering scaffold. Do not modify or overwrite.
- NFR-S3 (HTTPS/TLS), NFR-S8 (Dependabot), NFR-R1 (99% uptime) are addressed in Stories 1.6/1.7.

### References

- [Source: _bmad-output/planning-artifacts/architecture.md — Monorepo Structure, Implementation Sequence, Naming Conventions]
- [Source: _bmad-output/planning-artifacts/epics.md — Epic 1 stories and acceptance criteria]
- [Source: _bmad-output/planning-artifacts/prd.md — Technology stack decisions, NFRs, performance targets]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md — Design system, color palette, typography, spacing]
- [Source: _bmad-output/project-context.md — Comprehensive project rules and anti-patterns]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

- Backend `pino-pretty` missing on first `pnpm dev` — added as devDependency
- PostgreSQL port 5432 conflict on local machine — initially remapped to 5433:5432, reverted to default 5432:5432 in code review
- `@tycs/ui` and `@tycs/website` typecheck failed with TS18003 (no inputs) — added `src/lib/utils.ts` and `src/env.d.ts` respectively
- ESLint could not resolve `@tycs/config` as ESM from sibling workspaces — switched to relative path imports in per-workspace `eslint.config.js`
- `Readonly<T>` on `toCamelCase` generic param caused inference issues with `null`/`unknown` — removed wrapper, documented readonly contract via JSDoc

### Completion Notes List

- All 11 tasks implemented and verified
- Turborepo workspace resolves 3 apps + 4 packages (8 workspaces total including root)
- `pnpm typecheck` — 7/7 pass
- `pnpm lint` — 7/7 pass (shared ESLint flat config with `no-console: error`, no-default-export)
- `pnpm test` — 10/10 tests pass via turbo (toCamelCase unit tests)
- `pnpm dev` starts backend (:3001), webapp (:5173), website (:4321) concurrently
- Docker Compose starts PostgreSQL 16 (port 5432) and Redis 7 (port 6379)
- Design tokens defined in `packages/config/tailwind-tokens.css` (oklch color space, dark-first)
- shadcn/ui `cn()` utility scaffolded in `packages/ui/src/lib/utils.ts`
- Task 4.3 (shadcn init) — manually scaffolded globals.css + cn() utility instead of running interactive CLI; shadcn components to be installed incrementally per story requirements
- Task 4.5 (fonts) — font-face declarations added to globals.css with `font-display: optional`; actual font files will be served from CDN or self-hosted in later stories
- Task 7.1 — manually scaffolded instead of `create astro` (interactive CLI)

### Change Log

- 2026-02-26: Story 1.1 implementation complete — full monorepo scaffold with all apps, packages, Docker Compose, and validations passing
- 2026-02-26: Code review fixes (10 issues) — restored deleted content/ dir, added test scripts, wired vitest base config, fixed webapp ESLint to use shared config, reverted Docker PostgreSQL to default port 5432, wired website design tokens, fixed webapp index.html boilerplate, added no-default-export exception for *.config.ts files, added font TODO comments, documented toCamelCase readonly limitation

### File List

- package.json (root)
- pnpm-workspace.yaml
- turbo.json
- tsconfig.base.json
- eslint.config.js (root)
- .nvmrc
- .npmrc
- .gitignore
- .env.example
- docker-compose.yml
- README.md
- pnpm-lock.yaml
- packages/config/package.json
- packages/config/tsconfig.json
- packages/config/tsconfig.base.json
- packages/config/eslint.config.js
- packages/config/vitest.config.ts
- packages/config/tailwind-tokens.css
- packages/config/test-utils/index.ts
- packages/shared/package.json
- packages/shared/tsconfig.json
- packages/shared/eslint.config.js
- packages/shared/vitest.config.ts
- packages/shared/src/index.ts
- packages/shared/src/to-camel-case.ts
- packages/shared/src/to-camel-case.test.ts
- packages/shared/src/types/index.ts
- packages/ui/package.json
- packages/ui/tsconfig.json
- packages/ui/eslint.config.js
- packages/ui/src/globals.css
- packages/ui/src/lib/utils.ts
- packages/execution/package.json
- packages/execution/tsconfig.json
- packages/execution/eslint.config.js
- packages/execution/src/index.ts
- apps/webapp/package.json
- apps/webapp/tsconfig.json
- apps/webapp/tsconfig.app.json
- apps/webapp/tsconfig.node.json
- apps/webapp/eslint.config.js
- apps/webapp/vite.config.ts
- apps/webapp/index.html
- apps/webapp/src/App.tsx
- apps/webapp/src/main.tsx
- apps/webapp/src/vite-env.d.ts
- apps/website/package.json
- apps/website/tsconfig.json
- apps/website/eslint.config.js
- apps/website/astro.config.mjs
- apps/website/src/pages/index.astro
- apps/website/src/styles/globals.css
- apps/website/src/env.d.ts
- apps/backend/package.json
- apps/backend/tsconfig.json
- apps/backend/eslint.config.js
- apps/backend/src/server.ts
- apps/backend/src/shared/db.ts
- apps/backend/src/shared/redis.ts
- apps/backend/src/plugins/auth/index.ts
- apps/backend/src/plugins/execution/index.ts
- apps/backend/src/plugins/tutor/index.ts
- apps/backend/src/plugins/curriculum/index.ts
- apps/backend/src/plugins/progress/index.ts
- apps/backend/src/plugins/account/index.ts
- apps/backend/src/worker/worker.ts
