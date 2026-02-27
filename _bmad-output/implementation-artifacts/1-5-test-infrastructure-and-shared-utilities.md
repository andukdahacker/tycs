# Story 1.5: Test Infrastructure & Shared Utilities

Status: done

<!-- When this story contradicts project-context.md, project-context.md is authoritative. -->

## Story

As a **developer**,
I want a working test framework with database isolation, mock utilities, and E2E scaffolding,
So that I can write reliable unit, integration, and end-to-end tests for any feature.

## Acceptance Criteria

1. **Given** the test command is run (`pnpm test`), **When** Vitest executes test files, **Then** it discovers co-located test files using the `{source}.test.ts` convention (ARCH-14).
2. **And** a test database setup utility creates an isolated test database (`tycs_test`).
3. **And** a per-test transaction rollback wrapper ensures tests do not leak state.
4. **And** a Fastify inject helper enables HTTP-level integration tests without a running server.
5. **And** a Redis mock utility is available for tests that interact with Redis.
6. **And** a canary test validates the full test infrastructure (DB connection, transaction rollback, Fastify inject) works end-to-end.
7. **And** test utilities are exported from `@tycs/config/test-utils`.
8. **And** Playwright is installed and configured for E2E testing with a base config targeting Chromium (ARCH-14).
9. **And** a Playwright test helper sets up authenticated browser context using Firebase Auth test tokens.
10. **And** a sample E2E canary test validates that the Playwright infrastructure works (navigates to health endpoint).
11. **And** E2E tests are in `apps/webapp/e2e/`, separate from co-located unit tests.

## Tasks / Subtasks

- [x] Task 1: Install test dependencies (AC: #1, #5, #7, #8)
  - [x] 1.1 Backend test deps: `pnpm --filter backend add -D @tycs/config`
    - Backend needs `@tycs/config` as workspace dependency to import `test-utils` and `vitest.config`
    - vitest is already in root devDeps and accessible to all workspaces via hoisting
  - [x] 1.2 Webapp test deps: `pnpm --filter webapp add -D @testing-library/react @testing-library/dom @testing-library/jest-dom jsdom`
    - Required for component testing infrastructure (AC #7 — `createTestQueryClient`, `TestProviders`)
    - jsdom needed as Vitest environment for React component tests
  - [x] 1.3 Playwright: `pnpm --filter webapp add -D @playwright/test`
    - After install, run `pnpm --filter webapp exec playwright install chromium` to download browser binary
    - Only Chromium — do not install Firefox or WebKit (saves CI time)
  - [x] 1.4 TanStack Query (webapp): `pnpm --filter webapp add @tanstack/react-query`
    - Required for `createTestQueryClient()` and `TestProviders` (AC #7)
    - This is a runtime dependency — not devDep (webapp will use it in Story 3+)
  - [x] 1.5 Config package deps: `pnpm --filter config add -D @testing-library/react @testing-library/jest-dom @tanstack/react-query react react-dom`
    - The `test-utils/` in `@tycs/config` needs these as devDeps to compile `TestProviders` and `createTestQueryClient`
    - React is a peerDep-like requirement for `@testing-library/react`

- [x] Task 2: Create Vitest config for `apps/backend` (AC: #1, #2)
  - [x] 2.1 Create `apps/backend/vitest.config.ts`:
    - Import and merge `baseVitestConfig` from `@tycs/config/vitest.config` (same pattern as `packages/shared/vitest.config.ts`)
    - Set `test.env` to override environment variables for test workers:
      ```typescript
      test: {
        env: {
          DATABASE_URL: 'postgresql://tycs:tycs@localhost:5433/tycs_test',
          REDIS_URL: 'redis://localhost:6379',
          NODE_ENV: 'test',
          LOG_LEVEL: 'silent',
        },
        globalSetup: './src/test/global-setup.ts',
        setupFiles: ['./src/test/setup.ts'],
      }
      ```
    - **CRITICAL**: `test.env` sets env vars BEFORE test modules are imported. This ensures `db.ts` and `redis.ts` don't throw when evaluated. The `DATABASE_URL` points to `tycs_test` (not the dev `tycs` database).
    - **CRITICAL**: The `baseVitestConfig` resolves `@tycs/shared` and `@tycs/config` aliases via `resolve.alias`. Backend uses `moduleResolution: NodeNext` with `.js` extensions in source code — but Vitest resolves via Vite's bundler pipeline, which strips `.js` extensions automatically. No additional config needed.
    - Exclude `e2e/` from Vitest discovery (E2E uses Playwright runner, not Vitest)
  - [x] 2.2 Add test script to `apps/backend/package.json`:
    - `"test": "vitest run"`
    - This runs tests once (CI mode). Use `vitest` (no `run`) for watch mode during dev.
    - The `id.test.ts` test that currently runs via `packages/shared` will now also run under the backend workspace. This is correct — `id.test.ts` is co-located in `apps/backend/src/shared/`.

- [x] Task 3: Create test database global setup (AC: #2)
  - [x] 3.1 Create `apps/backend/src/test/global-setup.ts`:
    - This runs ONCE before all test files (in the main Vitest process, not workers)
    - Connect to PostgreSQL using the **dev** `DATABASE_URL` (`postgresql://tycs:tycs@localhost:5433/tycs`) — NOT `tycs_test`
    - Why dev URL? Because `tycs_test` might not exist yet. We connect to the default `tycs` database to issue `CREATE DATABASE` commands.
    - Steps:
      1. Create a `pg.Pool` connection to `tycs` database
      2. Check if `tycs_test` exists: `SELECT 1 FROM pg_database WHERE datname = 'tycs_test'`
      3. If not exists: `CREATE DATABASE tycs_test`
      4. Close the pool
      5. Run Kysely migrations against `tycs_test`:
         - Create a Kysely instance with `DATABASE_URL` pointing to `tycs_test`
         - Use Kysely's `Migrator` with `FileMigrationProvider` pointing to `apps/backend/migrations/`
         - Call `migrator.migrateToLatest()`
         - Destroy the Kysely instance
    - Return a teardown function that drops `tycs_test` — **NO, do NOT drop**. Dropping and recreating on every test run is slow. Keep the DB between runs; transaction rollback handles isolation.
    - Import paths: Use absolute `path.resolve` for migration folder, NOT relative imports (globalSetup runs from the Vitest process root)
    - The `Migrator` + `FileMigrationProvider` approach avoids shelling out to `kysely-ctl` (which loads its own `kysely.config.ts` that reads the dev `.env` file — wrong DATABASE_URL)
  - [x] 3.2 Implementation pattern:
    ```typescript
    import { Kysely, Migrator, FileMigrationProvider, PostgresDialect } from 'kysely'
    import pg from 'pg'
    import path from 'node:path'
    import { promises as fs } from 'node:fs'
    import { fileURLToPath } from 'node:url'

    const __dirname = path.dirname(fileURLToPath(import.meta.url))
    const TEST_DB_URL = 'postgresql://tycs:tycs@localhost:5433/tycs_test'
    const DEV_DB_URL = 'postgresql://tycs:tycs@localhost:5433/tycs'

    export async function setup(): Promise<void> {
      // 1. Ensure tycs_test database exists
      const adminPool = new pg.Pool({ connectionString: DEV_DB_URL })
      const result = await adminPool.query(
        "SELECT 1 FROM pg_database WHERE datname = 'tycs_test'"
      )
      if (result.rows.length === 0) {
        await adminPool.query('CREATE DATABASE tycs_test')
      }
      await adminPool.end()

      // 2. Run migrations against tycs_test
      const db = new Kysely<Record<string, never>>({
        dialect: new PostgresDialect({
          pool: new pg.Pool({ connectionString: TEST_DB_URL }),
        }),
      })
      const migrator = new Migrator({
        db,
        provider: new FileMigrationProvider({
          fs,
          path,
          migrationFolder: path.resolve(__dirname, '../../migrations'),
        }),
      })
      const { error } = await migrator.migrateToLatest()
      await db.destroy()
      if (error) throw error
    }
    ```
  - [x] 3.3 **IMPORTANT**: The `Kysely<Record<string, never>>` generic is intentional — the `DB` type from `@tycs/shared` requires `kysely-codegen` to have been run, which generates `packages/shared/src/types/db.ts`. In CI, this file may not exist yet. Using `Record<string, never>` avoids the type dependency while still running migrations correctly (migrations don't need typed queries).

- [x] Task 4: Create per-test setup and transaction utilities (AC: #3)
  - [x] 4.1 Create `apps/backend/src/test/setup.ts`:
    - This runs before EACH test file (in the worker process, after env vars are set)
    - Import `afterEach` from `vitest`
    - Call `vi.restoreAllMocks()` in `afterEach` (project-context requirement)
    - Note: `restoreMocks: true` is already in `baseVitestConfig`, but the explicit `afterEach` is a safety net and matches project-context's explicit requirement
  - [x] 4.2 Create `apps/backend/src/test/test-db.ts` — per-test transaction rollback:
    - Export `createTestDb()`: Creates a Kysely instance with `pool.max = 1` pointing to `tycs_test`
      - `max: 1` is **CRITICAL** — ensures all queries go through the same connection, so transaction state (BEGIN/ROLLBACK) is shared across all queries in the test
    - Export `withTestTransaction(db, fn)`: Higher-order wrapper that runs `fn` inside a transaction and rolls back
    - Export `createTestTransaction(db)` / `rollbackTestTransaction(db)`: Imperative BEGIN/ROLLBACK for use in `beforeEach`/`afterEach`
    - Pattern:
      ```typescript
      import type { DB } from '@tycs/shared'
      import { Kysely, PostgresDialect, sql } from 'kysely'
      import pg from 'pg'

      export function createTestDb(): Kysely<DB> {
        return new Kysely<DB>({
          dialect: new PostgresDialect({
            pool: new pg.Pool({
              connectionString: process.env['DATABASE_URL'],
              max: 1,
            }),
          }),
        })
      }

      export async function beginTransaction(db: Kysely<DB>): Promise<void> {
        await sql`BEGIN`.execute(db)
      }

      export async function rollbackTransaction(db: Kysely<DB>): Promise<void> {
        await sql`ROLLBACK`.execute(db)
      }
      ```
    - **Usage pattern in tests:**
      ```typescript
      let testDb: Kysely<DB>
      beforeEach(async () => {
        testDb = createTestDb()
        await beginTransaction(testDb)
      })
      afterEach(async () => {
        await rollbackTransaction(testDb)
        await testDb.destroy()
      })
      ```
    - **IMPORTANT**: Tests use `testDb` (their own Kysely instance with max=1 pool), NOT the global `db` singleton from `shared/db.ts`. The global `db` uses a default pool size and doesn't share transaction state. For Fastify integration tests that go through route handlers using the global `db`, see Task 5 notes about the `buildTestApp` approach.

- [x] Task 5: Create Fastify inject helper (AC: #4)
  - [x]5.1 Create `apps/backend/src/test/test-app.ts`:
    - Export `createTestApp()`: Builds a Fastify instance ready for `inject()` testing
    - Pattern:
      ```typescript
      import type { FastifyInstance } from 'fastify'
      import { buildApp } from '../app.js'

      export async function createTestApp(): Promise<FastifyInstance> {
        const app = await buildApp()
        await app.ready()
        return app
      }
      ```
    - `buildApp()` imports all plugins and configures the Fastify instance. Since `test.env` already sets `DATABASE_URL` to `tycs_test`, any plugins that import `db.ts` (future stories) will connect to the test database.
    - Call `await app.ready()` to finalize plugin registration before inject
    - Callers must call `app.close()` in `afterAll` or `afterEach` to clean up
    - **Logging**: `buildApp()` configures pino. In tests, `LOG_LEVEL=silent` (set in vitest env) suppresses log output. If `pino-pretty` is not available in test context, the transport may fail. Handle this by checking: the `NODE_ENV=test` won't match `!== 'production'`, so pino-pretty transport WILL load. If this causes issues, override in `buildApp` or set `NODE_ENV=production` in test env to disable pretty-printing.
    - **Alternative**: If pino-pretty transport causes issues in tests, set `LOG_LEVEL: 'silent'` in test env AND add `NODE_ENV: 'production'` to skip the pino-pretty transport entirely. The `LOG_LEVEL: 'silent'` already suppresses output, but the transport still gets loaded. Setting production mode avoids loading pino-pretty.
    - **Decision**: Use `NODE_ENV: 'test'` (not `'production'`). If pino-pretty transport fails in tests, the fix is to add pino-pretty as a devDep in backend (it's already there: `"pino-pretty": "^13.1.3"`), so the transport will resolve fine.
  - [x]5.2 Usage pattern:
    ```typescript
    import { createTestApp } from '../test/test-app.js'

    describe('GET /health', () => {
      let app: FastifyInstance
      beforeAll(async () => { app = await createTestApp() })
      afterAll(async () => { await app.close() })

      it('should return 200 with status ok', async () => {
        const response = await app.inject({ method: 'GET', url: '/health' })
        expect(response.statusCode).toBe(200)
        expect(response.json()).toEqual({ status: 'ok' })
      })
    })
    ```
  - [x]5.3 `beforeAll` is acceptable for Fastify instance setup (project-context explicitly allows this exception). Use `beforeAll` for app creation, `beforeEach` for test data.

- [x] Task 6: Create Redis mock utility (AC: #5, #7)
  - [x]6.1 Create `packages/config/test-utils/mock-redis.ts`:
    - Export `createMockRedis()`: Returns a mock object implementing the subset of ioredis API used by the project
    - The mock should support common commands: `get`, `set`, `del`, `expire`, `ttl`, `keys`, `quit`, `on`, `ping`
    - Use an in-memory `Map<string, string>` as backing store
    - Pattern:
      ```typescript
      import { vi } from 'vitest'

      export interface MockRedis {
        get: ReturnType<typeof vi.fn>
        set: ReturnType<typeof vi.fn>
        del: ReturnType<typeof vi.fn>
        expire: ReturnType<typeof vi.fn>
        ttl: ReturnType<typeof vi.fn>
        keys: ReturnType<typeof vi.fn>
        quit: ReturnType<typeof vi.fn>
        on: ReturnType<typeof vi.fn>
        ping: ReturnType<typeof vi.fn>
      }

      export function createMockRedis(): MockRedis {
        const store = new Map<string, string>()
        return {
          get: vi.fn(async (key: string) => store.get(key) ?? null),
          set: vi.fn(async (key: string, value: string) => { store.set(key, value); return 'OK' }),
          del: vi.fn(async (key: string) => { store.delete(key); return 1 }),
          expire: vi.fn(async () => 1),
          ttl: vi.fn(async () => -1),
          keys: vi.fn(async (pattern: string) => [...store.keys()].filter(k => k.includes(pattern.replace('*', '')))),
          quit: vi.fn(async () => 'OK'),
          on: vi.fn(),
          ping: vi.fn(async () => 'PONG'),
        }
      }
      ```
    - Tests that need Redis mocking use `vi.mock('ioredis')` + inject `createMockRedis()` via plugin options (when DI is wired in future stories)
    - For Story 1.5, this utility is provided but not yet consumed by any test (no features use Redis yet). The canary test (Task 7) validates that the mock factory works.
  - [x]6.2 **Real Redis option**: Since docker-compose runs Redis on port 6379, integration tests CAN use real Redis if needed. The `REDIS_URL` env var is set in vitest config. However, for unit tests, the mock is preferred (faster, no external dependency).

- [x] Task 7: Create canary integration test (AC: #6)
  - [x]7.1 Create `apps/backend/src/test/canary.test.ts`:
    - This test validates the complete test infrastructure works
    - Test groups:
      1. **Database connectivity**: Connect to `tycs_test`, run a simple query (`SELECT 1`)
      2. **Transaction rollback**: Insert a row, rollback, verify row is gone
      3. **Fastify inject**: Create test app, inject `GET /health`, verify 200 response
      4. **Redis mock**: Create mock, verify get/set operations
    - Pattern:
      ```typescript
      import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest'
      import type { Kysely } from 'kysely'
      import type { DB } from '@tycs/shared'
      import type { FastifyInstance } from 'fastify'
      import { createTestDb, beginTransaction, rollbackTransaction } from './test-db.js'
      import { createTestApp } from './test-app.js'
      import { createMockRedis } from '@tycs/config/test-utils'

      describe('Test Infrastructure Canary', () => {
        describe('Database', () => {
          let testDb: Kysely<DB>

          beforeEach(async () => {
            testDb = createTestDb()
          })

          afterEach(async () => {
            await testDb.destroy()
          })

          it('should connect to tycs_test database', async () => {
            const result = await sql`SELECT 1 as value`.execute(testDb)
            expect(result.rows[0]).toEqual({ value: 1 })
          })

          it('should rollback transactions to prevent state leakage', async () => {
            await beginTransaction(testDb)
            // Insert into a known table (users exists from migration)
            await testDb.insertInto('users')
              .values({ id: 'test-canary-user', email: 'canary@test.com', display_name: 'Canary', created_at: new Date(), updated_at: new Date() })
              .execute()
            // Verify insert succeeded within transaction
            const inserted = await testDb.selectFrom('users').where('id', '=', 'test-canary-user').executeTakeFirst()
            expect(inserted).toBeDefined()
            // Rollback
            await rollbackTransaction(testDb)
            // Verify row is gone after rollback
            const afterRollback = await testDb.selectFrom('users').where('id', '=', 'test-canary-user').executeTakeFirst()
            expect(afterRollback).toBeUndefined()
          })
        })

        describe('Fastify Inject', () => {
          let app: FastifyInstance

          beforeAll(async () => {
            app = await createTestApp()
          })

          afterAll(async () => {
            await app.close()
          })

          it('should inject GET /health and receive 200', async () => {
            const response = await app.inject({ method: 'GET', url: '/health' })
            expect(response.statusCode).toBe(200)
            expect(response.json()).toEqual({ status: 'ok' })
          })
        })

        describe('Redis Mock', () => {
          it('should support get/set operations', async () => {
            const redis = createMockRedis()
            await redis.set('key', 'value')
            const result = await redis.get('key')
            expect(result).toBe('value')
          })
        })
      })
      ```
    - **Users table schema** (from `001_initial_schema.ts`): `id` (text PK), `email` (text NOT NULL UNIQUE), `display_name` (text, nullable), `created_at` (timestamptz, DEFAULT now()), `updated_at` (timestamptz, DEFAULT now()). Only `id` and `email` are required — `display_name` is nullable and timestamps have defaults. Simplify the insert to: `await testDb.insertInto('users').values({ id: 'test-canary-user', email: 'canary@test.com' }).execute()`

- [x] Task 8: Populate `@tycs/config/test-utils` (AC: #7)
  - [x]8.1 Update `packages/config/test-utils/index.ts`:
    - Re-export everything from `./mock-redis` (created in Task 6)
    - Export `createTestQueryClient` function
    - Export `TestProviders` React component wrapper
    - Keep the module as the canonical import location for ALL test utilities
  - [x]8.2 Create `packages/config/test-utils/query-client.ts`:
    - Export `createTestQueryClient()`:
      ```typescript
      import { QueryClient } from '@tanstack/react-query'

      export function createTestQueryClient(): QueryClient {
        return new QueryClient({
          defaultOptions: {
            queries: {
              retry: false,
              gcTime: Infinity,
              staleTime: Infinity,
            },
            mutations: {
              retry: false,
            },
          },
        })
      }
      ```
    - No retries (tests should fail fast), no garbage collection (prevent timing issues), infinite stale time (prevent background refetches)
  - [x]8.3 Create `packages/config/test-utils/providers.tsx`:
    - Export `TestProviders` wrapper component:
      ```tsx
      import { QueryClientProvider } from '@tanstack/react-query'
      import type { ReactNode } from 'react'
      import { createTestQueryClient } from './query-client'

      export function TestProviders({ children }: { readonly children: ReactNode }): ReactNode {
        const queryClient = createTestQueryClient()
        return (
          <QueryClientProvider client={queryClient}>
            {children}
          </QueryClientProvider>
        )
      }
      ```
    - Creates a fresh `QueryClient` per render to prevent test contamination
    - Uses `readonly` on `children` prop per project-context convention
  - [x]8.4 Update `packages/config/test-utils/index.ts` barrel file:
    ```typescript
    export { createMockRedis } from './mock-redis'
    export type { MockRedis } from './mock-redis'
    export { createTestQueryClient } from './query-client'
    export { TestProviders } from './providers'
    ```
  - [x]8.5 Update `packages/config/tsconfig.json` to include `.tsx` files:
    - Add `"test-utils/**/*.tsx"` to the `include` array
    - Add `"jsx": "react-jsx"` to `compilerOptions` for TSX compilation
  - [x]8.6 **Deferred test utilities** — these are architecture-mandated canonical mocks but NOT needed until their respective stories. Do NOT implement them now — YAGNI:
    - Firebase Auth mock (`verifyIdToken()` → test uid) — deferred to **Story 2.1**
    - MSW v2 handlers (Fly Machines API) — deferred to **Story 3.2**
    - Anthropic SDK mock (scripted streaming chunks) — deferred to **Story 6.1**
    - EventSource mock (injectable constructor) — deferred to **Story 3.4**
    - Each story that needs a mock MUST add it to `@tycs/config/test-utils` (canonical location), not create ad-hoc mocks.

- [x] Task 9: Create Vitest config for `apps/webapp` (AC: #1)
  - [x]9.1 Create `apps/webapp/vitest.config.ts`:
    - Import and merge `baseVitestConfig` from `@tycs/config/vitest.config`
    - Set `test.environment: 'jsdom'` for React component testing
    - Set `test.setupFiles` to load jest-dom matchers — **CRITICAL**: without this, `toBeInTheDocument()` and similar DOM matchers won't be available
    - Exclude `e2e/` from Vitest test discovery
    - Pattern:
      ```typescript
      import { mergeConfig } from 'vitest/config'
      import { baseVitestConfig } from '@tycs/config/vitest.config'

      export default mergeConfig(baseVitestConfig, {
        test: {
          environment: 'jsdom',
          setupFiles: ['@testing-library/jest-dom'],
          exclude: ['**/e2e/**', '**/node_modules/**'],
        },
      })
      ```
  - [x]9.2 Add test script to `apps/webapp/package.json`:
    - `"test": "vitest run"`

- [x] Task 10: Install and configure Playwright (AC: #8, #11)
  - [x]10.1 Create `apps/webapp/playwright.config.ts`:
    ```typescript
    import { defineConfig, devices } from '@playwright/test'

    export default defineConfig({
      testDir: './e2e',
      fullyParallel: true,
      forbidOnly: !!process.env['CI'],
      retries: process.env['CI'] ? 2 : 0,
      workers: process.env['CI'] ? 1 : undefined,
      reporter: 'html',
      use: {
        baseURL: 'http://localhost:3001',
        trace: 'on-first-retry',
      },
      projects: [
        {
          name: 'chromium',
          use: { ...devices['Desktop Chrome'] },
        },
      ],
    })
    ```
    - `baseURL: 'http://localhost:3001'` — points to the backend API server (health endpoint for canary). When frontend E2E tests are added (Story 2.2+), update to `http://localhost:5173` (Vite dev server).
    - Only Chromium project (AC #8 specifies Chromium)
    - `forbidOnly` in CI prevents `.only` from being committed
    - Single worker in CI for stability
  - [x]10.2 Create `apps/webapp/e2e/` directory
  - [x]10.3 Add Playwright scripts to `apps/webapp/package.json`:
    - `"test:e2e": "playwright test"`
    - `"test:e2e:ui": "playwright test --ui"`
    - Do NOT add E2E to the turbo `test` pipeline — E2E tests require running services and should be run separately
  - [x]10.4 Add to `.gitignore` (or `apps/webapp/.gitignore`):
    - `playwright-report/`
    - `test-results/`
    - `blob-report/`

- [x] Task 11: Create Playwright auth helper (AC: #9)
  - [x]11.1 Create `apps/webapp/e2e/helpers/auth.ts`:
    - Export `authenticatedContext()`: Creates a Playwright browser context with Firebase Auth test tokens
    - Since Firebase Auth is not implemented yet (Story 2.1), this is a **scaffold only**:
      ```typescript
      import type { Browser, BrowserContext } from '@playwright/test'

      export const TEST_USER = {
        uid: 'test-user-canary',
        email: 'canary@test.tycs.dev',
        displayName: 'E2E Canary User',
      } as const

      /**
       * Creates an authenticated browser context with Firebase Auth test token.
       * Scaffold — actual token injection implemented in Story 2.1 when auth is wired.
       *
       * Usage:
       *   const context = await createAuthenticatedContext(browser)
       *   const page = await context.newPage()
       */
      export async function createAuthenticatedContext(browser: Browser): Promise<BrowserContext> {
        const context = await browser.newContext()
        // TODO(story-2.1): Set Firebase Auth token in localStorage/cookie
        // await context.addCookies([{ name: 'auth-token', value: '<test-token>', domain: 'localhost', path: '/' }])
        return context
      }
      ```
    - This provides the structure for Story 2.1 to fill in with real token injection

- [x] Task 12: Create E2E canary test (AC: #10)
  - [x]12.1 Create `apps/webapp/e2e/canary.test.ts`:
    ```typescript
    import { test, expect } from '@playwright/test'

    test.describe('E2E Infrastructure Canary', () => {
      test('should reach backend health endpoint', async ({ request }) => {
        const response = await request.get('/health')
        expect(response.status()).toBe(200)
        const body = await response.json()
        expect(body).toEqual({ status: 'ok' })
      })
    })
    ```
    - Uses Playwright's API request context (`request` fixture) instead of browser navigation
    - This validates that Playwright can reach the backend server
    - Requires the backend to be running (`pnpm --filter backend dev`) when tests execute
    - The `baseURL` from `playwright.config.ts` provides `http://localhost:3001`

- [x] Task 13: Validate (AC: #1-#11)
  - [x]13.1 `pnpm typecheck` — zero errors across all workspaces
  - [x]13.2 `pnpm lint` — zero lint errors
  - [x]13.3 Ensure docker-compose is running: `docker compose up -d`
  - [x]13.4 `pnpm test` — all tests pass:
    - `packages/shared`: 3 existing test files pass (constants, to-camel-case)
    - `apps/backend`: id.test.ts passes + canary.test.ts passes (DB, transaction, inject, Redis mock)
    - Verify `tycs_test` database was created automatically
  - [x]13.5 `pnpm --filter backend test` — backend tests in isolation
  - [x]13.6 E2E: Start backend (`pnpm --filter backend dev`), then `pnpm --filter webapp test:e2e` — canary passes
  - [x]13.7 `pnpm build` — TypeScript compiles (verify no type errors from new test-utils)
  - [x]13.8 Verify that existing tests still pass (0 regressions from id.test.ts, constants.test.ts, to-camel-case.test.ts)

## Dev Notes

### Rules (MUST Follow)

**Test File Conventions (ARCH-14, project-context):**
- Co-located `{source}.test.ts` next to source — never `.spec.ts`, never `__tests__/`
- Exception: Playwright E2E in `apps/webapp/e2e/` only
- Exception: Test infrastructure files (setup, helpers, factories) in `apps/backend/src/test/`
- Always `it()`, never `test()` (Vitest and Playwright both support `it`)
- `describe` mirrors module structure
- Test names describe behavior: `it('should return 401 when token is expired')` — good

**Test Isolation (project-context):**
- `vi.restoreAllMocks()` in `afterEach` — always (also configured via `restoreMocks: true` in base config)
- No `beforeAll` for test data — use `beforeEach` or inline factories
- Exception: `beforeAll` is OK for Fastify instance setup and DB connection setup
- No shared mutable state between tests

**Database Testing (project-context):**
- Real PostgreSQL — never SQLite, never in-memory
- Kysely test transaction per test, rolled back in `afterEach`
- Never mock `Kysely.execute()` — use real DB
- Never mock Fastify `reply` — use `fastify.inject()`

**Mock Boundary Rule (project-context):**
- Only mock what you don't own
- Mocks are for external services only (Firebase, Anthropic, Fly.io)
- Import from `@tycs/config/test-utils/` — never create ad-hoc mocks
- New patterns go into the canonical set

**Import Paths in Tests:**
- Backend test files use `.js` extensions on relative imports (NodeNext): `import { createTestApp } from './test-app.js'`
- Cross-package imports use bare specifiers: `import { createMockRedis } from '@tycs/config/test-utils'`
- Vitest resolves `.js` extensions to `.ts` source files automatically via its Vite pipeline

**Vitest (NOT Jest):**
- `vi.fn()` not `jest.fn()`, `vi.mock()` not `jest.mock()`
- `vi.restoreAllMocks()` not `jest.restoreAllMocks()`
- No `toMatchSnapshot()` — use explicit behavioral assertions
- No `describe.skip` / `it.skip` without `// TODO(story-id): reason`
- Vitest 4.x is installed at root (`^4.0.18`)

### Anti-Patterns (MUST AVOID)

- Do NOT install Jest or any Jest-related packages
- Do NOT install Cypress — use Playwright
- Do NOT use `supertest` — use `fastify.inject()`
- Do NOT use SQLite or in-memory databases for tests
- Do NOT mock Kysely `.execute()` — use real PostgreSQL
- Do NOT create `__tests__/` directories — co-locate tests
- Do NOT use `.spec.ts` extension — use `.test.ts`
- Do NOT use `test()` — use `it()`
- Do NOT use `toMatchSnapshot()` — use explicit assertions
- Do NOT use `@/` import aliases — use relative paths with `.js` extensions
- Do NOT install `ioredis-mock` npm package — use the custom `createMockRedis()` from test-utils
- Do NOT create ad-hoc mock factories outside `@tycs/config/test-utils`
- Do NOT add E2E tests to the Turbo `test` pipeline — they require running services
- Do NOT drop/recreate the test database on every run — use transaction rollback for isolation
- Do NOT use `console.log` in test files — use Vitest's built-in output or pino logger
- Do NOT implement Firebase Auth mock, Anthropic SDK mock, or msw handlers — those are for future stories

### Previous Story Intelligence (Story 1.4)

**What was established:**
- `apps/backend/src/app.ts` — `buildApp()` factory function (Fastify instance creation separated from `listen()` for testability)
- `apps/backend/src/shared/redis.ts` — ioredis connection, throws at module load if `REDIS_URL` missing
- `apps/backend/src/shared/db.ts` — Kysely connection, throws at module load if `DATABASE_URL` missing
- Auth plugin with `fastify-plugin` for global hooks, `uid` request decorator
- 5 domain plugin stubs (empty — no routes, no DB imports)
- pino-pretty for dev logging, JSON in production

**Critical warning from Story 1.4:**
> "redis.ts throws at module-evaluation time if REDIS_URL is missing. Story 1.5 test infrastructure must handle this — any test that transitively imports redis.ts will crash without REDIS_URL. Same hazard exists for db.ts / DATABASE_URL."

**Resolution**: Set `DATABASE_URL` and `REDIS_URL` in vitest config `test.env` BEFORE any test modules are evaluated. This ensures the global singletons in `db.ts` and `redis.ts` initialize without errors.

**Review follow-up from Story 1.4:**
> "[AI-Review][MEDIUM] Story 1.5 must add integration tests for buildApp() and GET /health using fastify.inject()"

**Resolution**: The canary test (Task 7) includes a Fastify inject test for `GET /health`.

**Code patterns established:**
- Named exports only (no default exports)
- `.js` extensions on ALL relative imports (backend uses `moduleResolution: NodeNext`)
- `dotenv-cli` for loading `.env` in npm scripts
- `{ Redis } from 'ioredis'` (named import for NodeNext compat)
- ESLint: `no-explicit-any: 'error'`, `no-console: 'error'`

**What was established in earlier stories (1.1-1.3):**
- Monorepo: Turborepo + pnpm workspaces (7 packages)
- Docker: PostgreSQL 16 on port 5433, Redis 7 on port 6379
- DATABASE_URL: `postgresql://tycs:tycs@localhost:5433/tycs`
- REDIS_URL: `redis://localhost:6379`
- `toCamelCase()` utility in `@tycs/shared`
- Kysely migration system with `001_initial_schema.ts`
- `packages/config/test-utils/index.ts` placeholder (empty export)
- `packages/config/vitest.config.ts` base config with workspace aliases
- `packages/shared/vitest.config.ts` extending base
- 16 existing test cases across 3 files (all passing)

### Git Intelligence (Recent Commits)

```
b33073c Implement Story 1.4: Fastify server bootstrap and plugin architecture
1e383ed Implement Story 1.3: Database codegen and shared utilities
a7576ea Implement Story 1.2: Database foundation and migration system
a1829bf Implement Story 1.1: Monorepo scaffold and local dev environment
```

**Patterns from commits:**
- Commit messages: `Implement Story X.Y: Brief description`
- Each story is a single commit
- All validation (typecheck, lint, test, build) passes before commit

### Project Structure Notes

**Files to CREATE:**
```
apps/backend/
├── vitest.config.ts                      # NEW — backend Vitest config
├── src/test/
│   ├── global-setup.ts                   # NEW — test DB creation + migrations
│   ├── setup.ts                          # NEW — per-file test setup
│   ├── test-db.ts                        # NEW — DB test utilities (transaction wrapper)
│   ├── test-app.ts                       # NEW — Fastify inject helper
│   └── canary.test.ts                    # NEW — infrastructure canary test
apps/webapp/
├── vitest.config.ts                      # NEW — webapp Vitest config (jsdom)
├── playwright.config.ts                  # NEW — Playwright E2E config
├── e2e/
│   ├── canary.test.ts                    # NEW — E2E canary test
│   └── helpers/
│       └── auth.ts                       # NEW — Playwright auth helper scaffold
packages/config/
├── test-utils/
│   ├── index.ts                          # MODIFY — barrel exports
│   ├── mock-redis.ts                     # NEW — Redis mock factory
│   ├── query-client.ts                   # NEW — TanStack Query test client
│   └── providers.tsx                     # NEW — TestProviders wrapper
```

**Files to MODIFY:**
```
apps/backend/package.json                  # ADD test script, @tycs/config dep
apps/webapp/package.json                   # ADD test script, test:e2e scripts, test deps
packages/config/package.json               # ADD devDeps for test-utils compilation
packages/config/tsconfig.json              # ADD tsx support for providers.tsx
packages/config/test-utils/index.ts        # UPDATE barrel exports
.gitignore                                 # ADD playwright artifacts
```

**Files NOT to touch:**
- `apps/backend/src/shared/db.ts` — do NOT refactor for testability (env var approach handles this)
- `apps/backend/src/shared/redis.ts` — do NOT refactor (env var approach handles this)
- `apps/backend/src/app.ts` — do NOT modify (already has correct factory pattern)
- `apps/backend/src/plugins/*` — do NOT modify (stubs, no changes needed)
- `packages/shared/vitest.config.ts` — already configured, no changes needed
- `turbo.json` — test task already configured, no changes needed
- `docker-compose.yml` — no changes needed (tycs_test DB created programmatically)
- `apps/backend/kysely.config.ts` — used by kysely-ctl for dev migrations, not by tests

### Library Version Notes

| Library | Version | Notes |
|---|---|---|
| `vitest` | ^4.0.18 | Already in root devDeps. Test runner for all unit/integration tests. |
| `@playwright/test` | latest | E2E test framework. Install in webapp. |
| `@testing-library/react` | latest | React component testing utilities. Install in webapp + config. |
| `@testing-library/dom` | latest | DOM testing utilities (peer dep of @testing-library/react). |
| `@testing-library/jest-dom` | latest | Custom matchers for DOM assertions (`toBeInTheDocument`). |
| `jsdom` | latest | Browser environment simulation for Vitest React tests. |
| `@tanstack/react-query` | latest | State management for server data. Runtime dep for webapp. |
| `kysely` | ^0.28.11 | Already installed. Used for test DB setup and migration runner. |
| `pg` | ^8.19.0 | Already installed. Used for test DB creation (CREATE DATABASE). |

### Downstream Dependencies

| Story | What It Needs From 1.5 |
|---|---|
| 1.6 CI/CD Pipeline | Vitest test step (`turbo test`), Playwright E2E step (separate), test DB setup in CI (PostgreSQL service container in GitHub Actions) |
| 2.1 Firebase Auth | `createTestApp()` for auth route testing, Firebase Auth mock (add to test-utils) |
| 2.2 Signup/Login UI | `TestProviders` + `createTestQueryClient()` for component tests |
| 3.x Execution | `createTestDb()` + transaction rollback for submission testing, boundary tests (user-code errors never trigger Sentry, platform errors never appear as terminal output — architecture mandate) |
| All API stories | `createTestApp()` + `fastify.inject()` for route testing |
| All React stories | `TestProviders` + jsdom environment for component testing |

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story-1.5 — Acceptance criteria and story definition]
- [Source: _bmad-output/planning-artifacts/architecture.md#Testing-Framework — ARCH-14: Vitest + Playwright, co-located tests]
- [Source: _bmad-output/planning-artifacts/architecture.md#CI-CD — ARCH-23: test step in pipeline]
- [Source: _bmad-output/planning-artifacts/architecture.md#Database-Testing — Real PostgreSQL, transaction rollback]
- [Source: _bmad-output/project-context.md#Testing-Rules — Complete testing rules and conventions]
- [Source: _bmad-output/project-context.md#Anti-Patterns — Banned test patterns]
- [Source: _bmad-output/project-context.md#Technology-Stack — Vitest, Playwright, msw v2, @testing-library/react]
- [Source: _bmad-output/implementation-artifacts/1-4-fastify-server-bootstrap-and-plugin-architecture.md — buildApp() factory, env var warnings, review follow-ups]
- [Source: packages/config/vitest.config.ts — Base Vitest config with workspace aliases]
- [Source: packages/config/test-utils/index.ts — Placeholder for test utilities]
- [Source: apps/backend/src/shared/db.ts — Global DB singleton, throws without DATABASE_URL]
- [Source: apps/backend/src/shared/redis.ts — Global Redis singleton, throws without REDIS_URL]
- [Source: apps/backend/src/app.ts — buildApp() factory for Fastify inject testing]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

- Fixed `@tycs/config/test-utils` module resolution for NodeNext: added `exports` field to `packages/config/package.json` and `.js` extensions to barrel imports
- Fixed `MockRedis` type — `ReturnType<typeof vi.fn>` not callable in Vitest 4.x; switched to `Mock<(...) => ...>` generics
- Added `jsx: "react-jsx"` to backend tsconfig to support transitive TSX resolution from `@tycs/config/test-utils/providers.tsx`
- Added `passWithNoTests: true` to webapp vitest config (no component tests exist yet)
- Added `@types/react` devDep to config package for TSX compilation
- Pre-existing: `@tycs/website` lint errors in `.astro/` generated files (not Story 1.5 scope)
- Pre-existing: `@tycs/webapp` build failure due to Tailwind CSS v4/Vite resolution in `@tycs/ui` (not Story 1.5 scope)

### Completion Notes List

- All 13 tasks completed with 23 tests passing across 2 workspaces (shared: 13, backend: 10); webapp configured with passWithNoTests (no component tests yet)
- Test infrastructure: Vitest + global-setup (creates `tycs_test` DB + migrations) + per-test setup (`vi.restoreAllMocks`)
- DB utilities: `createTestDb()` (pool max=1), `beginTransaction()`, `rollbackTransaction()` — verified via canary
- Fastify inject: `createTestApp()` using `buildApp()` factory — verified via canary GET /health
- Redis mock: `createMockRedis()` with in-memory Map backing — verified via canary get/set/del/ping
- Test-utils exports: `createMockRedis`, `MockRedis`, `createTestQueryClient`, `TestProviders` from `@tycs/config/test-utils`
- Playwright E2E: Chromium-only config, canary test hits backend `/health`, auth helper scaffold for Story 2.1
- Webapp vitest: jsdom environment, jest-dom matchers, e2e excluded from Vitest discovery

### Change Log

- 2026-02-27: Implemented Story 1.5 — Test Infrastructure & Shared Utilities (all 11 ACs satisfied)

### File List

**New files:**
- apps/backend/vitest.config.ts
- apps/backend/src/test/global-setup.ts
- apps/backend/src/test/setup.ts
- apps/backend/src/test/test-db.ts
- apps/backend/src/test/test-app.ts
- apps/backend/src/test/canary.test.ts
- apps/webapp/vitest.config.ts
- apps/webapp/playwright.config.ts
- apps/webapp/e2e/canary.test.ts
- apps/webapp/e2e/helpers/auth.ts
- packages/config/test-utils/mock-redis.ts
- packages/config/test-utils/query-client.ts
- packages/config/test-utils/providers.tsx

**Modified files:**
- apps/backend/package.json (added test script, @tycs/config devDep)
- apps/backend/tsconfig.json (added jsx: react-jsx for transitive TSX)
- apps/webapp/package.json (added test/test:e2e/test:e2e:ui scripts, test deps, @tycs/config devDep, @tanstack/react-query)
- packages/config/package.json (added exports field, devDeps for test-utils)
- packages/config/tsconfig.json (added jsx: react-jsx, tsx include pattern)
- packages/config/test-utils/index.ts (populated barrel exports)
- .gitignore (added playwright artifacts)
- pnpm-lock.yaml (new dependencies)
- _bmad-output/implementation-artifacts/sprint-status.yaml (story status → review)
