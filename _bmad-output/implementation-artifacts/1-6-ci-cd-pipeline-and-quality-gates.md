# Story 1.6: CI/CD Pipeline & Quality Gates

Status: done

<!-- When this story contradicts project-context.md, project-context.md is authoritative. -->

## Story

As a **developer**,
I want automated quality gates on every push,
So that broken code cannot merge to main.

## Acceptance Criteria

1. **Given** a commit is pushed to the `main` branch or a pull request is opened, **When** GitHub Actions triggers the CI workflow, **Then** the pipeline runs in order: lint → typecheck → test → build (ARCH-23).
2. **And** Turborepo remote caching is enabled to skip unchanged packages.
3. **And** Dependabot is configured for automated dependency vulnerability scanning (NFR-S8).
4. **And** a separate Content CI workflow file exists (scaffold only — runs validation when milestone content files are present, no-ops otherwise) for FR44.
5. **And** axe-core accessibility checks are integrated into the CI pipeline, running against Playwright-rendered pages (NFR-A2).
6. **And** accessibility failures block merge — WCAG 2.1 AA violations are treated as CI failures.
7. **And** the pipeline fails if any step fails, blocking merge.

## Tasks / Subtasks

- [x] Task 1: Create GitHub Actions CI workflow (AC: #1, #2, #7)
  - [x] 1.1 Create `.github/workflows/ci.yml`:
    - **Workflow name**: `name: CI` (displayed in GitHub Actions UI and status checks)
    - Trigger on: `push` to `main`, `pull_request` targeting `main`
    - **Concurrency** — cancel in-progress runs on the same branch/PR to avoid redundant CI:
      ```yaml
      concurrency:
        group: ${{ github.workflow }}-${{ github.ref }}
        cancel-in-progress: true
      ```
    - Use `ubuntu-latest` runner
    - **Service containers:**
      - PostgreSQL 16: `postgres:16` image with `POSTGRES_USER=mycscompanion`, `POSTGRES_PASSWORD=mycscompanion`, `POSTGRES_DB=mycscompanion`, health check, exposed on default port 5432
      - Redis 7: `redis:7` image with health check, exposed on default port 6379
    - **CRITICAL**: In GitHub Actions, service containers are accessible on `localhost` directly (not port-mapped like docker-compose). The DATABASE_URL must use port `5432` (not `5433` like local dev).
    - Environment variables for the job:
      ```yaml
      env:
        DATABASE_URL: postgresql://mycscompanion:mycscompanion@localhost:5432/mycscompanion
        REDIS_URL: redis://localhost:6379
        NODE_ENV: test
        LOG_LEVEL: silent
      ```
    - **CRITICAL**: The backend test global-setup creates `mycscompanion_test` from the service container's `mycscompanion` DB (connecting to `localhost:5432/mycscompanion` to issue `CREATE DATABASE mycscompanion_test`). The test workers then use `DATABASE_URL` overridden to `mycscompanion_test` in vitest config's `test.env`. Since the global-setup hardcodes `localhost:5433` for dev, we need to handle CI differently — see Task 2.

  - [x] 1.2 Pipeline steps (in exact order):
    ```yaml
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4

      - uses: actions/setup-node@v4
        with:
          node-version-file: '.nvmrc'
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Lint
        run: pnpm lint

      - name: Type check
        run: pnpm typecheck

      - name: Test
        run: pnpm test

      - name: Build
        run: pnpm build
    ```
    - `pnpm/action-setup@v4` — reads `packageManager` field from `package.json` to determine pnpm version (10.30.2). No `version` input needed.
    - `actions/setup-node@v4` with `node-version-file: '.nvmrc'` — reads `20` from `.nvmrc`. `cache: 'pnpm'` enables pnpm store caching.
    - `pnpm install --frozen-lockfile` — enforces exact lock file match (project-context requirement: never plain `pnpm install` in CI).
    - Steps run sequentially — each depends on the previous. A failure at any step stops the pipeline (AC #7).

  - [x] 1.3 Add Turborepo remote caching (AC #2):
    - Add `TURBO_TOKEN` and `TURBO_TEAM` as environment variables reading from GitHub secrets:
      ```yaml
      env:
        TURBO_TOKEN: ${{ secrets.TURBO_TOKEN }}
        TURBO_TEAM: ${{ vars.TURBO_TEAM }}
      ```
    - These are optional — CI works without them (local caching fallback). Remote caching is a performance optimization.
    - **Setup instructions** (document in workflow comments):
      1. Create a Vercel account (free tier)
      2. Generate a Turborepo token at https://vercel.com/account/tokens
      3. Add `TURBO_TOKEN` as a GitHub repository secret
      4. Add `TURBO_TEAM` as a GitHub repository variable (the Vercel team slug)
    - Turborepo automatically detects these env vars and enables remote caching — no turbo CLI flags needed.

- [x] Task 2: Fix test database setup for CI compatibility (AC: #1)
  - [x] 2.1 Update `apps/backend/src/test/global-setup.ts`:
    - Current code hardcodes port `5433` (local docker-compose). In CI, PostgreSQL service container runs on port `5432`. Fix by detecting `CI` env var (automatically set by GitHub Actions):
      ```typescript
      const isCI = process.env['CI'] === 'true'
      const PG_PORT = isCI ? '5432' : '5433'
      const DEV_DB_URL = `postgresql://mycscompanion:mycscompanion@localhost:${PG_PORT}/mycscompanion`
      const TEST_DB_URL = `postgresql://mycscompanion:mycscompanion@localhost:${PG_PORT}/mycscompanion_test`
      ```
    - Replace both hardcoded `DEV_DB_URL` and `TEST_DB_URL` constants with the dynamic versions above. Keep ALL other code (pool creation, CREATE DATABASE, migration runner) unchanged.
    - **Why `CI` env var, not `DATABASE_URL` parsing**: The `globalSetup` function runs outside Vitest worker processes, so `test.env` values from vitest config are NOT available in `process.env` during global setup. The `CI` env var is the simplest reliable signal.

  - [x] 2.2 Update `apps/backend/vitest.config.ts` test.env:
    - Make DATABASE_URL port dynamic for CI:
      ```typescript
      const pgPort = process.env['CI'] === 'true' ? '5432' : '5433'
      // ...
      test: {
        env: {
          DATABASE_URL: `postgresql://mycscompanion:mycscompanion@localhost:${pgPort}/mycscompanion_test`,
          REDIS_URL: 'redis://localhost:6379',
          NODE_ENV: 'test',
          LOG_LEVEL: 'silent',
        },
      }
      ```
    - This ensures test worker processes (which DO get `test.env`) also use the correct port.

- [x] Task 3: Create Dependabot configuration (AC: #3)
  - [x] 3.1 Create `.github/dependabot.yml`:
    ```yaml
    version: 2
    updates:
      - package-ecosystem: "npm"
        directory: "/"
        schedule:
          interval: "weekly"
          day: "monday"
        open-pull-requests-limit: 10
        groups:
          minor-and-patch:
            update-types:
              - "minor"
              - "patch"
        labels:
          - "dependencies"
        reviewers: []
      - package-ecosystem: "github-actions"
        directory: "/"
        schedule:
          interval: "weekly"
          day: "monday"
        labels:
          - "dependencies"
          - "github-actions"
    ```
    - Two ecosystems: `npm` (pnpm uses npm ecosystem) and `github-actions` (keep action versions updated)
    - Weekly schedule to avoid PR noise
    - Group minor/patch updates to reduce PR count
    - pnpm workspaces: Dependabot's `directory: "/"` with npm ecosystem works with pnpm monorepos — it reads the root `package.json` and discovers workspaces via `pnpm-workspace.yaml`
    - **Security updates**: Dependabot security alerts are separate from version updates and are always enabled at the repository level (GitHub setting, not dependabot.yml)

- [x] Task 4: Create Content CI workflow scaffold (AC: #4)
  - [x] 4.1 Create `.github/workflows/content-ci.yml`:
    ```yaml
    name: Content CI

    on:
      push:
        paths:
          - 'content/**'
        branches: [main]
      pull_request:
        paths:
          - 'content/**'
        branches: [main]

    jobs:
      validate-content:
        runs-on: ubuntu-latest
        steps:
          - uses: actions/checkout@v4

          - uses: pnpm/action-setup@v4

          - uses: actions/setup-node@v4
            with:
              node-version-file: '.nvmrc'
              cache: 'pnpm'

          - name: Install dependencies
            run: pnpm install --frozen-lockfile

          # Scaffold: Add validation steps when content schemas and
          # execution pipeline are implemented
          - name: Validate milestone content structure
            run: |
              echo "Content CI scaffold - validation steps pending"
              echo "Will validate: YAML schemas, starter code compilation,"
              echo "reference implementations, benchmark baselines"
              # TODO(story-4.1): Add JSON schema validation for milestone YAML
              # TODO(story-3.2): Add Go compilation check via Fly execution
              # TODO(story-7.1): Add benchmark baseline validation
              ls content/milestones/ || echo "No milestone content found"
    ```
    - Triggers only on changes to `content/` directory — no-ops if no content files present
    - The `content/` directory already exists with `milestones/`, `prompts/`, `schema/` subdirectories
    - Actual validation logic will be added incrementally as content pipeline stories (Epic 4, Epic 7) are implemented
    - The workflow structure is ready for real validation steps to be plugged in

- [x] Task 5: Install axe-core and create accessibility test infrastructure (AC: #5, #6)
  - [x] 5.1 Install `@axe-core/playwright` in webapp:
    ```bash
    pnpm --filter webapp add -D @axe-core/playwright
    ```
    - This is the official Deque Systems package for Playwright + axe-core integration
    - It provides `AxeBuilder` class that chains with Playwright's `Page` object

  - [x] 5.2 Create `apps/webapp/e2e/helpers/a11y.ts` — accessibility test helper:
    ```typescript
    import type { Page } from '@playwright/test'
    import AxeBuilder from '@axe-core/playwright'

    export interface A11yResult {
      readonly violations: ReadonlyArray<{
        readonly id: string
        readonly impact: string | undefined
        readonly description: string
        readonly nodes: ReadonlyArray<{ readonly html: string }>
      }>
    }

    /**
     * Run axe-core accessibility scan on a page.
     * Configured for WCAG 2.1 AA compliance.
     *
     * Usage:
     *   const results = await scanPage(page)
     *   expect(results.violations).toEqual([])
     */
    export async function scanPage(page: Page): Promise<A11yResult> {
      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze()

      return {
        violations: results.violations.map((v) => ({
          id: v.id,
          impact: v.impact ?? undefined,
          description: v.description,
          nodes: v.nodes.map((n) => ({ html: n.html })),
        })),
      }
    }

    /**
     * Format axe violations into a readable string for test output.
     */
    export function formatViolations(violations: A11yResult['violations']): string {
      if (violations.length === 0) return 'No accessibility violations found'
      return violations
        .map(
          (v) =>
            `[${v.impact ?? 'unknown'}] ${v.id}: ${v.description}\n` +
            v.nodes.map((n) => `  - ${n.html}`).join('\n')
        )
        .join('\n\n')
    }
    ```
    - Scans for WCAG 2.1 AA compliance (tags: `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`)
    - Returns a typed, readonly result object
    - `formatViolations` provides readable test failure output
    - The helper is generic — every future E2E test can import and use it

  - [x] 5.3 Create `apps/webapp/e2e/a11y.test.ts` — scaffold accessibility test:
    ```typescript
    import { test, expect } from '@playwright/test'
    import { scanPage, formatViolations } from './helpers/a11y'

    test.describe('Accessibility (WCAG 2.1 AA)', () => {
      // TODO(story-2.2): Add login page accessibility test
      // TODO(story-3.5): Add workspace page accessibility test

      test.skip('should have no WCAG 2.1 AA violations on login page', async ({ page }) => {
        // TODO(story-2.2): Implement when login UI exists
        await page.goto('/')
        const results = await scanPage(page)
        expect(results.violations, formatViolations(results.violations)).toEqual([])
      })
    })
    ```
    - Tests are `test.skip` until UI pages exist — each skip has a `TODO(story-id)` per project-context rules
    - When Story 2.2 (Signup/Login UI) is implemented, the skip is removed and real page navigation is added
    - The pattern is established: every new page gets an a11y test in this file
    - **IMPORTANT**: These skipped tests do NOT block CI — `test.skip` tests are reported but don't fail

  - [x] 5.4 Add E2E job to CI workflow (AC #5, #6):
    - **Separate job** in `ci.yml` for E2E + accessibility tests:
      ```yaml
      e2e:
        runs-on: ubuntu-latest
        needs: [ci]  # Only run after main CI passes
        services:
          postgres:
            image: postgres:16
            env:
              POSTGRES_USER: mycscompanion
              POSTGRES_PASSWORD: mycscompanion
              POSTGRES_DB: mycscompanion
            options: >-
              --health-cmd pg_isready
              --health-interval 10s
              --health-timeout 5s
              --health-retries 5
            ports:
              - 5432:5432
          redis:
            image: redis:7
            options: >-
              --health-cmd "redis-cli ping"
              --health-interval 10s
              --health-timeout 5s
              --health-retries 5
            ports:
              - 6379:6379
        env:
          DATABASE_URL: postgresql://mycscompanion:mycscompanion@localhost:5432/mycscompanion
          REDIS_URL: redis://localhost:6379
          NODE_ENV: test
          LOG_LEVEL: silent
        steps:
          - uses: actions/checkout@v4
          - uses: pnpm/action-setup@v4
          - uses: actions/setup-node@v4
            with:
              node-version-file: '.nvmrc'
              cache: 'pnpm'
          - run: pnpm install --frozen-lockfile
          - name: Install Playwright browsers
            run: pnpm --filter webapp exec playwright install chromium --with-deps
          - name: Run database migrations
            run: pnpm --filter backend db:migrate
          - name: Start backend server
            run: |
              cd apps/backend
              npx tsx src/server.ts &
          - name: Wait for backend
            run: |
              for i in $(seq 1 30); do
                curl -sf http://localhost:3001/health && break
                sleep 1
              done
          - name: Run E2E tests
            run: pnpm --filter webapp test:e2e
          - name: Upload Playwright report
            uses: actions/upload-artifact@v4
            if: ${{ !cancelled() }}
            with:
              name: playwright-report
              path: apps/webapp/playwright-report/
              retention-days: 7
      ```
    - **`db:migrate` in CI**: The `db:migrate` script runs `kysely migrate:latest` which reads `kysely.config.ts`. That file calls `dotenv.config()` (the `dotenv` npm package) — this does NOT throw when `.env` is missing, it silently returns an error object. The job-level `DATABASE_URL` env var is already set, so `process.env['DATABASE_URL']` resolves correctly. No fix needed.
    - **Backend start in CI**: Do NOT use `pnpm --filter backend dev` — it runs `dotenv -e ../../.env -- tsx --watch` which WILL fail because `dotenv-cli` (the CLI tool, distinct from the `dotenv` npm package) exits with error when `.env` is missing. Instead, run `npx tsx src/server.ts` directly — env vars come from the GitHub Actions job environment.

- [x] Task 6: Add branch protection documentation (AC: #7)
  - [x] 6.1 Add a comment block at the top of `ci.yml` documenting required GitHub repository settings:
    ```yaml
    # REQUIRED REPOSITORY SETTINGS:
    # ==============================
    # 1. Branch protection rule on 'main':
    #    - Require status checks to pass: "ci" job
    #    - Require branches to be up to date before merging
    #    - Require pull request reviews (optional but recommended)
    # 2. GitHub Secrets:
    #    - TURBO_TOKEN (optional): Vercel Turborepo remote cache token
    # 3. GitHub Variables:
    #    - TURBO_TEAM (optional): Vercel team slug for remote caching
    ```
    - Branch protection rules must be configured manually in GitHub repository settings
    - The `ci` job name is the required status check

- [x] Task 7: Validate complete CI pipeline (AC: #1-#7)
  - [x] 7.1 **CRITICAL — Fix pre-existing build/lint failures before CI can work:**
    - Story 1.5 debug log noted these pre-existing issues:
      - `@mycscompanion/webapp` build failure due to Tailwind CSS v4/Vite resolution in `@mycscompanion/ui`
      - `@mycscompanion/website` lint errors in `.astro/` generated files
    - **Run `pnpm build` and `pnpm lint` FIRST** to check if these still fail.
    - If webapp build fails: investigate Tailwind CSS v4 + `@mycscompanion/ui` resolution. Fix the root cause (likely a missing Vite plugin config or package export). CI CANNOT ship with a broken build step.
    - If website lint fails on `.astro/` generated files: add `.astro/` to the website's ESLint ignore pattern (generated code should not be linted). This is a one-line fix in `apps/website/eslint.config.js` or `.eslintignore`.
    - These fixes are required scope for this story — CI is useless if lint/build fail on pre-existing issues.
  - [x] 7.2 Verify all new files are syntactically valid:
    - `.github/workflows/ci.yml` — valid GitHub Actions YAML
    - `.github/workflows/content-ci.yml` — valid GitHub Actions YAML
    - `.github/dependabot.yml` — valid Dependabot v2 config
  - [x] 7.3 Verify local test suite still passes:
    - `pnpm test` — all existing tests pass (no regression from global-setup changes)
    - `pnpm lint` — zero lint errors across ALL workspaces
    - `pnpm typecheck` — zero type errors
    - `pnpm build` — builds succeed across ALL workspaces
  - [x] 7.4 Verify E2E infrastructure:
    - Start backend: `pnpm --filter backend dev`
    - Run E2E: `pnpm --filter webapp test:e2e`
    - Canary test passes, a11y test skips gracefully
  - [x] 7.5 Verify CI workflow would work:
    - Push to a branch, open PR → CI triggers
    - If secrets not configured, remote caching falls back gracefully
    - All steps execute in order: lint → typecheck → test → build
    - E2E job runs after main CI completes

## Dev Notes

### Rules (MUST Follow)

**CI Pipeline Order (ARCH-23, project-context):**
- Exact order: `pnpm install --frozen-lockfile` → `turbo lint` → `turbo typecheck` → `turbo test` → `turbo build`
- NEVER use `pnpm install` in CI — always `--frozen-lockfile`
- NEVER skip steps or reorder — lint catches issues cheapest, build is most expensive

**GitHub Actions Conventions:**
- Use `actions/checkout@v4`, `pnpm/action-setup@v4`, `actions/setup-node@v4` — pin major versions
- pnpm version auto-detected from `package.json` `packageManager` field
- Node version from `.nvmrc` (currently `20`)
- Service containers for PostgreSQL and Redis — NOT docker-compose

**Port Differences (CRITICAL):**
| Environment | PostgreSQL Port | Redis Port |
|---|---|---|
| Local (docker-compose) | 5433 | 6379 |
| CI (GHA service container) | 5432 | 6379 |

**Turborepo in CI:**
- `TURBO_TOKEN` + `TURBO_TEAM` from GitHub secrets/variables — optional
- Without these, Turborepo uses local caching within the CI run (still caches between tasks in same job)
- `--affected` flag NOT used for now — all packages are tested on every push

**Turbo Task Coverage by Workspace:**

| Workspace | lint | typecheck | test | build |
|---|---|---|---|---|
| apps/backend | eslint | tsc --noEmit | vitest run | tsc |
| apps/webapp | eslint | tsc --noEmit | vitest run (passWithNoTests) | tsc -b && vite build |
| apps/website | eslint | tsc --noEmit | -- | astro build |
| packages/shared | eslint | tsc --noEmit | vitest run | -- |
| packages/config | eslint | tsc --noEmit | -- | -- |
| packages/ui | eslint | tsc --noEmit | -- | -- |
| packages/execution | eslint | tsc --noEmit | -- | -- |

Workspaces without a script are silently skipped by Turborepo.

**Testing in CI:**
- `turbo test` runs Vitest in: backend (10 tests), shared (13 tests), webapp (passWithNoTests)
- Backend tests need PostgreSQL + Redis service containers
- Webapp Vitest tests use jsdom (no external services needed)
- E2E (Playwright) is a **separate job** — requires backend running
- E2E is NOT part of `turbo test` pipeline

**Content CI (FR44):**
- Scaffold only — no real validation yet
- Triggers on `content/**` path changes
- Real validation added incrementally by future stories (4.1, 3.2, 7.1)

**Accessibility (NFR-A2):**
- `@axe-core/playwright` for WCAG 2.1 AA compliance testing
- Tests are skipped (with `TODO` comments) until UI pages exist
- Every new page MUST get an accessibility test added to `a11y.test.ts`
- Violations are CI failures — zero tolerance for WCAG 2.1 AA violations

### Anti-Patterns (MUST AVOID)

- Do NOT use `docker-compose` in CI — use GitHub Actions service containers
- Do NOT hardcode PostgreSQL port in test infrastructure — use CI-aware detection
- Do NOT add E2E tests to `turbo test` — they need running services (separate job)
- Do NOT use `actions/cache` manually for pnpm — `actions/setup-node` with `cache: 'pnpm'` handles this
- Do NOT use `npm` commands — this is a pnpm project
- Do NOT install all Playwright browsers — only Chromium (`playwright install chromium`)
- Do NOT use `pnpm install` without `--frozen-lockfile` in CI
- Do NOT use interactive flags (`-i`) in any CI commands
- Do NOT store secrets in workflow files — use GitHub Secrets
- Do NOT use `test.only` or `describe.only` — `forbidOnly: !!process.env['CI']` in Playwright config catches this

### Previous Story Intelligence (Story 1.5)

**What was established:**
- `apps/backend/vitest.config.ts` — backend Vitest config with `test.env` overrides for `DATABASE_URL` (port 5433) and `REDIS_URL`
- `apps/backend/src/test/global-setup.ts` — creates `mycscompanion_test` database and runs Kysely migrations. **Currently hardcodes port 5433** — this story MUST make it CI-aware.
- `apps/backend/src/test/test-db.ts` — per-test transaction utilities (reads `DATABASE_URL` from `process.env` — already dynamic)
- `apps/backend/src/test/test-app.ts` — Fastify inject helper via `buildApp()`
- `apps/backend/src/test/canary.test.ts` — infrastructure canary (DB, transaction, inject, Redis mock)
- `apps/webapp/vitest.config.ts` — webapp Vitest config (jsdom, passWithNoTests)
- `apps/webapp/playwright.config.ts` — Playwright config (Chromium only, `baseURL: http://localhost:3001`)
- `apps/webapp/e2e/canary.test.ts` — E2E canary (hits backend `/health`)
- `apps/webapp/e2e/helpers/auth.ts` — Firebase Auth scaffold for E2E
- `packages/config/test-utils/` — `createMockRedis`, `createTestQueryClient`, `TestProviders`
- 23 tests passing across 2 workspaces (shared: 13, backend: 10)

**Critical fix needed from Story 1.5:**
> global-setup.ts hardcodes `DEV_DB_URL = 'postgresql://mycscompanion:mycscompanion@localhost:5433/mycscompanion'` and `TEST_DB_URL = 'postgresql://mycscompanion:mycscompanion@localhost:5433/mycscompanion_test'`
> In CI, PostgreSQL service container exposes on port 5432. This MUST be made dynamic.

**Story 1.5 downstream notes:**
> "1.6 CI/CD Pipeline needs: Vitest test step (`turbo test`), Playwright E2E step (separate), test DB setup in CI (PostgreSQL service container in GitHub Actions)"

**Story 1.4 patterns:**
- Backend `dev` script uses `dotenv -e ../../.env -- tsx --watch src/server.ts` — requires `.env` file
- In CI, either bypass dotenv or create `.env` from env vars
- `buildApp()` factory function enables testing via `fastify.inject()`

**Code patterns from all prior stories:**
- Named exports only (no default)
- `.js` extensions on relative imports (backend, NodeNext)
- `dotenv-cli` for loading `.env` in npm scripts (local dev only)
- ESLint: `no-explicit-any: 'error'`, `no-console: 'error'`
- Commit messages: `Implement Story X.Y: Brief description`

### Git Intelligence (Recent Commits)

```
3ff8d7e Implement Story 1.5: Test infrastructure and shared utilities
b33073c Implement Story 1.4: Fastify server bootstrap and plugin architecture
1e383ed Implement Story 1.3: Database codegen and shared utilities
a7576ea Implement Story 1.2: Database foundation and migration system
a1829bf Implement Story 1.1: Monorepo scaffold and local dev environment
```

**Patterns from commits:**
- Single commit per story: `Implement Story X.Y: Brief description`
- All validation (typecheck, lint, test, build) passes before commit
- Stories build on each other sequentially within the epic

### Project Structure Notes

**Files to CREATE:**
```
.github/
├── workflows/
│   ├── ci.yml                               # NEW — Main CI pipeline
│   └── content-ci.yml                       # NEW — Content validation scaffold
├── dependabot.yml                           # NEW — Dependency update config
apps/webapp/
├── e2e/
│   ├── a11y.test.ts                         # NEW — Accessibility test scaffold
│   └── helpers/
│       └── a11y.ts                          # NEW — axe-core helper utility
```

**Files to MODIFY:**
```
apps/backend/src/test/global-setup.ts        # FIX — CI-aware port detection (CI env var)
apps/backend/vitest.config.ts                # FIX — CI-aware DATABASE_URL port
apps/webapp/package.json                     # ADD @axe-core/playwright devDep
```

**Files to POTENTIALLY FIX (pre-existing issues from Story 1.5):**
```
apps/website/eslint.config.js (or similar)   # FIX — exclude .astro/ generated files from lint
apps/webapp/ (Tailwind/Vite config)          # FIX — resolve @mycscompanion/ui build failure if still present
```

**Files NOT to touch:**
- `turbo.json` — already configured with lint, typecheck, test, build tasks
- `package.json` (root) — scripts already correct
- `docker-compose.yml` — local dev only, not used in CI
- `apps/backend/src/app.ts` — no changes needed
- `apps/backend/src/test/test-db.ts` — reads from `process.env['DATABASE_URL']`, already dynamic
- `apps/backend/src/test/test-app.ts` — no changes needed
- `apps/backend/src/test/canary.test.ts` — no changes needed
- `apps/webapp/playwright.config.ts` — already configured for Chromium
- `pnpm-workspace.yaml` — no changes needed

### Library Version Notes

| Library | Version | Notes |
|---|---|---|
| `@axe-core/playwright` | latest | Official Deque Systems axe-core Playwright integration |
| `pnpm/action-setup` | v4 | GitHub Action for pnpm setup — reads packageManager from package.json |
| `actions/setup-node` | v4 | GitHub Action for Node.js setup — reads .nvmrc for version |
| `actions/checkout` | v4 | Standard checkout action |
| `actions/upload-artifact` | v4 | For uploading Playwright reports on failure |

### Downstream Dependencies

| Story | What It Gets From 1.6 |
|---|---|
| 1.7 Error Tracking & Deployment | Railway deployment config builds on CI. Sentry source map upload added as CI build step. |
| 2.x Auth stories | CI automatically validates auth routes via `turbo test`. Login page gets a11y test. |
| 3.x Execution stories | CI validates execution plugin tests. New migrations auto-run in CI via global-setup. |
| All future stories | Every PR automatically validated. Dependabot keeps dependencies secure. |
| Epic 4+ content | Content CI workflow ready for validation steps to be plugged in. |

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story-1.6 — Acceptance criteria and story definition]
- [Source: _bmad-output/planning-artifacts/architecture.md#CI-CD-Pipeline — Pipeline order, remote caching, Content CI]
- [Source: _bmad-output/planning-artifacts/architecture.md#Monitoring — Sentry, error tracking context]
- [Source: _bmad-output/project-context.md#Development-Workflow — CI pipeline steps, frozen-lockfile]
- [Source: _bmad-output/project-context.md#Testing-Rules — Test conventions, co-located tests, Playwright E2E]
- [Source: _bmad-output/implementation-artifacts/1-5-test-infrastructure-and-shared-utilities.md — Test infra, global-setup, vitest config, Playwright setup]
- [Source: apps/backend/src/test/global-setup.ts — Hardcoded port 5433, needs CI fix]
- [Source: apps/backend/vitest.config.ts — test.env DATABASE_URL with port 5433]
- [Source: apps/webapp/playwright.config.ts — Chromium-only, baseURL localhost:3001]
- [Source: docker-compose.yml — Local PostgreSQL port 5433, Redis port 6379]
- [Source: turbo.json — lint, typecheck, test, build tasks already configured]
- [Source: .nvmrc — Node version 20]
- [Source: package.json — packageManager pnpm@10.30.2]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

- Pre-existing webapp build failure: `@mycscompanion/ui` missing `tailwindcss` devDependency — `@import 'tailwindcss'` in `globals.css` couldn't resolve. Fixed by adding `tailwindcss` as devDep of `@mycscompanion/ui`.
- Pre-existing webapp build failure: `@mycscompanion/config/tailwind-tokens.css` not exported from `@mycscompanion/config` package.json `exports` field. Fixed by adding CSS export entry. Also added `@mycscompanion/config` as dependency of `@mycscompanion/ui` and `@mycscompanion/website` for pnpm resolution.
- Pre-existing website lint failure: `.astro/` generated files failing ESLint rules (no-explicit-any, consistent-type-imports, etc). Fixed by adding `.astro/**` to ignores in website's `eslint.config.js`.

### Completion Notes List

- Created main CI workflow (`.github/workflows/ci.yml`) with two jobs: `ci` (lint→typecheck→test→build) and `e2e` (Playwright + a11y)
- Both jobs use PostgreSQL 16 and Redis 7 service containers on standard ports
- CI-aware port detection via `CI` env var in `global-setup.ts` and `vitest.config.ts` (port 5432 in CI vs 5433 local)
- Turborepo remote caching configured via optional `TURBO_TOKEN`/`TURBO_TEAM` secrets/variables
- Created Dependabot config for npm + github-actions ecosystems with weekly schedule and minor/patch grouping
- Created Content CI scaffold workflow triggered on `content/**` path changes
- Installed `@axe-core/playwright` and created WCAG 2.1 AA accessibility test infrastructure with `scanPage()` helper
- E2E job includes Playwright report upload as artifact
- Branch protection documentation added as comments in `ci.yml`
- Fixed 3 pre-existing build/lint failures (Tailwind CSS resolution, config package exports, Astro generated files)
- All quality gates pass locally: lint (7/7), typecheck (7/7), test (23 pass), build (3/3)

### Change Log

- 2026-02-27: Implemented Story 1.6 — CI/CD pipeline with GitHub Actions, Dependabot, Content CI scaffold, accessibility testing infrastructure, and pre-existing build/lint fixes
- 2026-02-27: Code review fixes — branch protection docs updated to require both "ci" and "e2e" status checks (AC #6), wait-for-backend loop now fails properly on timeout, a11y.test.ts follows `it()` convention, removed empty dependabot reviewers, content-ci defers dependency install until real validation added

### File List

**New files:**
- `.github/workflows/ci.yml` — Main CI pipeline (lint→typecheck→test→build + E2E job)
- `.github/workflows/content-ci.yml` — Content CI scaffold
- `.github/dependabot.yml` — Dependency update configuration
- `apps/webapp/e2e/helpers/a11y.ts` — axe-core accessibility scan helper
- `apps/webapp/e2e/a11y.test.ts` — WCAG 2.1 AA accessibility test scaffold

**Modified files:**
- `apps/backend/src/test/global-setup.ts` — CI-aware PostgreSQL port detection
- `apps/backend/vitest.config.ts` — CI-aware DATABASE_URL port
- `apps/website/eslint.config.js` — Exclude `.astro/` generated files from lint
- `apps/webapp/package.json` — Added `@axe-core/playwright` devDep
- `packages/ui/package.json` — Added `tailwindcss` devDep, `@mycscompanion/config` dependency
- `packages/config/package.json` — Added `tailwind-tokens.css` export
- `apps/website/package.json` — Added `@mycscompanion/config` dependency
- `pnpm-lock.yaml` — Updated lockfile
