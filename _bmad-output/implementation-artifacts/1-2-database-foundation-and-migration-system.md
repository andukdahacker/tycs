# Story 1.2: Database Foundation & Migration System

Status: done

<!-- When this story contradicts project-context.md, project-context.md is authoritative. -->

## Story

As a **developer**,
I want a type-safe database layer with versioned migrations,
So that I can build features against a consistent schema with a proven migration workflow.

## Acceptance Criteria

1. **Given** PostgreSQL is running via docker-compose, **When** I run the Kysely migration command, **Then** the initial migration creates foundational tables: `users`, `tracks`, `milestones`.
2. All tables use `snake_case` plural names and `snake_case` columns per ARCH-20.
3. All timestamp columns use `timestamptz` type.
4. All entity IDs use `cuid2` generation except `users.id` which stores the Firebase UID as text (ARCH-12).
5. Running migrations is idempotent (re-running does not error or duplicate data).
6. The migration pattern is established for subsequent epics to add their own tables (each domain story creates only the tables it needs).

## Tasks / Subtasks

- [x] Task 1: Install database dependencies (AC: #1, #6)
  - [x] 1.1 Install production deps in `apps/backend`: `kysely`, `pg` (PostgreSQL driver for Kysely's `PostgresDialect`)
  - [x] 1.2 Install dev deps in `apps/backend`: `kysely-ctl` (migration CLI)
  - [x] 1.3 Install production dep in `apps/backend`: `@paralleldrive/cuid2` (ID generation)
  - [x] 1.4 Use scoped install commands: `pnpm --filter backend add kysely pg @paralleldrive/cuid2` and `pnpm --filter backend add -D kysely-ctl`

- [x] Task 2: Configure Kysely instance in `apps/backend/src/shared/db.ts` (AC: #1)
  - [x] 2.1 Replace the placeholder export in `apps/backend/src/shared/db.ts`
  - [x] 2.2 Create a Kysely instance using `PostgresDialect` with `pg.Pool`
  - [x] 2.3 Read `DATABASE_URL` from `process.env` — fail fast with a clear error if not set
  - [x] 2.4 Export the `db` instance (named export, not default)
  - [x] 2.5 Export a `destroyDb` function for graceful shutdown
  - [x] 2.6 Do NOT define table interfaces in this file — `kysely-codegen` generates them in Story 1.3. Use `Kysely<any>` for now (replaced by generated types in 1.3). Add `// eslint-disable-next-line @typescript-eslint/no-explicit-any` above the line — ESLint enforces `no-explicit-any: 'error'`

- [x] Task 3: Configure `kysely-ctl` for migration management (AC: #5, #6)
  - [x] 3.1 Create `kysely.config.ts` (NO leading dot) in `apps/backend/` root — this is the `kysely-ctl` configuration file
  - [x] 3.2 Configure the migration folder path: `./migrations`
  - [x] 3.3 Configure the dialect to use `PostgresDialect` with `pg.Pool` reading `DATABASE_URL`
  - [x] 3.4 Add scripts to `apps/backend/package.json`:
    - `"db:migrate"`: `"kysely migrate:latest"` — runs all pending migrations
    - `"db:migrate:down"`: `"kysely migrate:down"` — rolls back last migration
    - `"db:migrate:make"`: `"kysely migrate:make"` — creates a new migration file
  - [x] 3.5 Add ESLint override for migration files — add `migrations/` to ignores in `apps/backend/eslint.config.js` (migration files require `Kysely<any>` in function signatures, which conflicts with `no-explicit-any` rule)

- [x] Task 4: Create initial migration file (AC: #1, #2, #3, #4)
  - [x] 4.1 Create `apps/backend/migrations/` directory
  - [x] 4.2 Create migration file (timestamp-prefixed, e.g., `001_initial_schema.ts`)
  - [x] 4.3 `up()` — Create `users` table:
    - `id` — `text`, primary key (stores Firebase UID — NOT cuid2)
    - `email` — `text`, not null
    - `display_name` — `text`, nullable
    - `created_at` — `timestamptz`, not null, default `now()`
    - `updated_at` — `timestamptz`, not null, default `now()`
    - Index: `idx_users_email` on `email` (unique)
  - [x] 4.4 `up()` — Create `tracks` table:
    - `id` — `text`, primary key (cuid2-generated at app layer)
    - `name` — `text`, not null
    - `slug` — `text`, not null
    - `description` — `text`, nullable
    - `created_at` — `timestamptz`, not null, default `now()`
    - `updated_at` — `timestamptz`, not null, default `now()`
    - Index: `idx_tracks_slug` on `slug` (unique)
  - [x] 4.5 `up()` — Create `milestones` table:
    - `id` — `text`, primary key (cuid2-generated at app layer)
    - `track_id` — `text`, not null, FK to `tracks.id` (on delete cascade)
    - `title` — `text`, not null
    - `slug` — `text`, not null
    - `position` — `integer`, not null (ordering within track)
    - `description` — `text`, nullable
    - `created_at` — `timestamptz`, not null, default `now()`
    - `updated_at` — `timestamptz`, not null, default `now()`
    - Index: `idx_milestones_track_id` on `track_id`
    - Unique index: `idx_milestones_track_id_position` on `(track_id, position)` — use `.createIndex().unique()` so the index follows the naming convention
    - Unique index: `idx_milestones_track_id_slug` on `(track_id, slug)` — use `.createIndex().unique()` so the index follows the naming convention
  - [x] 4.6 `down()` — Drop tables in reverse order: `milestones`, `tracks`, `users`
  - [x] 4.7 Use Kysely's schema builder API (`db.schema.createTable(...)`) — NOT raw SQL

- [x] Task 5: Create cuid2 ID generation utility (AC: #4)
  - [x] 5.1 Create `apps/backend/src/shared/id.ts`
  - [x] 5.2 Export a `generateId` function using `@paralleldrive/cuid2`'s `createId()`
  - [x] 5.3 Named export, explicit return type `string`

- [x] Task 6: Verify and validate (AC: #1, #5)
  - [x] 6.1 Run `docker compose up -d` to ensure PostgreSQL is running
  - [x] 6.2 Ensure `DATABASE_URL` is set — copy `.env.example` to `.env` if not already done (value: `postgresql://tycs:tycs@localhost:5433/tycs`)
  - [x] 6.3 Run `pnpm --filter backend db:migrate` — verify tables created
  - [x] 6.4 Run the same command again — verify idempotent (no error, no changes)
  - [x] 6.5 Run `pnpm --filter backend db:migrate:down` — verify rollback works
  - [x] 6.6 Run `pnpm --filter backend db:migrate` again — verify re-apply works
  - [x] 6.7 Run `pnpm typecheck` — verify no type errors across entire monorepo (note: `migrations/` and `kysely.config.ts` are outside `src/` and intentionally not covered by tsconfig `include` — this is expected since kysely-ctl uses its own compilation)
  - [x] 6.8 Run `pnpm lint` — verify no lint errors (migrations should be excluded per Task 3.5)

## Dev Notes

### Rules (MUST Follow)

**Database Conventions (ARCH-4, ARCH-12, ARCH-19, ARCH-20):**
- Table names: `snake_case`, plural (`users`, `tracks`, `milestones`)
- Column names: `snake_case` (`user_id`, `created_at`, `track_id`)
- Foreign keys: `{referenced_table_singular}_id` pattern (`track_id`)
- Indexes: `idx_{table}_{columns}` pattern (`idx_milestones_track_id`)
- Timestamps: always `timestamptz` with `_at` suffix, default `now()`
- IDs: `text` type everywhere — `cuid2` generated at app layer. Exception: `users.id` = Firebase UID (text, but not cuid2)
- No auto-increment IDs. No UUID. No integer IDs.
- No TS `enum` for DB enums — use union types and store as text

**Kysely Specifics:**
- Use `PostgresDialect` with `pg.Pool` — NOT `pg.Client`
- Migration files use Kysely's schema builder API: `db.schema.createTable(...)`, `.addColumn(...)`, `.execute()`
- For raw SQL edge cases, use Kysely's `sql` template tag — do not import `pg` directly
- `kysely-ctl` config file: `kysely.config.ts` (NO leading dot) in the `apps/backend/` root
- Migrations path: `apps/backend/migrations/`
- Migration files are TypeScript with `up()` and `down()` exports

**Package Installation:**
- Always scope to backend: `pnpm --filter backend add <pkg>`
- Never install to root unless it's tooling: `pnpm add -w <pkg>`

**Code Style:**
- Named exports only — no default exports. Exception: `kysely.config.ts` requires `export default defineConfig(...)` — ESLint already excludes `**/*.config.ts` from the no-default-export rule (confirmed in `packages/config/eslint.config.js` line 45)
- No `any` type — ESLint enforces `no-explicit-any: 'error'`. The temporary `Kysely<any>` in `db.ts` needs an `eslint-disable-next-line` comment. Migration files should be excluded from linting entirely (see Task 3.5)
- Explicit return types on exported functions
- No `console.log` — use Fastify's pino logger when logging is needed
- `async/await` only — no `.then()` chains
- `pg` is a CJS package — `import pg from 'pg'` works because `esModuleInterop: true` is set in tsconfig.base.json. Do NOT use `import { Pool } from 'pg'` — use `pg.Pool` after the default import

**Anti-Patterns:**
- Do NOT use Drizzle — Kysely is authoritative
- Do NOT use `redis` npm package — `ioredis` (but Redis is NOT wired in this story)
- Do NOT hand-write database type interfaces — `kysely-codegen` handles this in Story 1.3
- Do NOT create seed data in this story — that's Story 1.3
- Do NOT wire up the Kysely instance in `server.ts` plugin registration — that's Story 1.4
- Do NOT add `updated_at` trigger in PostgreSQL — handle at app layer or add in a later story if needed

### Previous Story Intelligence (Story 1.1)

**What was established:**
- `apps/backend/src/shared/db.ts` exists as empty placeholder — replace its contents
- `apps/backend/package.json` has fastify, ioredis, pino as deps; tsx, pino-pretty as devDeps
- Backend runs with `tsx --watch src/server.ts` on port 3001
- `docker-compose.yml` has PostgreSQL 16 on port 5432 (user: `tycs`, password: `tycs`, db: `tycs`)
- `.env.example` already documents `DATABASE_URL=postgresql://tycs:tycs@localhost:5432/tycs`
- TypeScript config extends `@tycs/config/tsconfig.base.json` with strict mode
- ESLint enforces `no-console: 'error'` and no-default-export

**Learnings from Story 1.1 dev agent:**
- `pino-pretty` was needed as devDependency for readable dev logs
- ESLint shared config had import resolution issues — was solved by using relative paths in per-workspace `eslint.config.js` files
- `Readonly<T>` on generic params can cause inference issues — use `readonly` on individual params or document via JSDoc

### Project Structure Notes

**Files to create:**
```
apps/backend/
├── kysely.config.ts               # NEW — kysely-ctl configuration (NO leading dot)
├── migrations/
│   └── 001_initial_schema.ts      # NEW — initial migration
└── src/
    └── shared/
        ├── db.ts                  # MODIFY — replace placeholder with Kysely instance
        └── id.ts                  # NEW — cuid2 ID generation utility
```

**Files to modify:**
```
apps/backend/package.json          # ADD dependencies and db:* scripts
apps/backend/eslint.config.js      # ADD migrations/ to ignores
```

Note: `migrations/` and `kysely.config.ts` are outside `apps/backend/src/` and therefore outside the backend tsconfig `include: ["src/**/*.ts"]`. This is intentional — kysely-ctl compiles these files itself using tsx. They will not appear in `pnpm typecheck` output.

**Files NOT to touch:**
- `apps/backend/src/server.ts` — plugin wiring is Story 1.4
- `apps/backend/src/shared/redis.ts` — Redis wiring is Story 1.4
- `packages/shared/src/types/index.ts` — DB types are Story 1.3
- `packages/shared/src/to-camel-case.ts` — already complete from Story 1.1
- Any files outside `apps/backend/`

### Reference Implementation Patterns

**db.ts pattern:**
```typescript
import { Kysely, PostgresDialect } from 'kysely'
import pg from 'pg' // CJS package — default import works via esModuleInterop

if (!process.env['DATABASE_URL']) {
  throw new Error('DATABASE_URL environment variable is required')
}

const dialect = new PostgresDialect({
  pool: new pg.Pool({
    connectionString: process.env['DATABASE_URL'],
  }),
})

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- replaced by kysely-codegen types in Story 1.3
export const db = new Kysely<any>({ dialect })

export async function destroyDb(): Promise<void> {
  await db.destroy()
}
```

**Migration file pattern (complete — all 3 tables):**
```typescript
import type { Kysely } from 'kysely'
import { sql } from 'kysely'

export async function up(db: Kysely<any>): Promise<void> {
  // --- users ---
  await db.schema
    .createTable('users')
    .addColumn('id', 'text', (col) => col.primaryKey())
    .addColumn('email', 'text', (col) => col.notNull())
    .addColumn('display_name', 'text')
    .addColumn('created_at', sql`timestamptz`, (col) =>
      col.notNull().defaultTo(sql`now()`)
    )
    .addColumn('updated_at', sql`timestamptz`, (col) =>
      col.notNull().defaultTo(sql`now()`)
    )
    .execute()

  await db.schema
    .createIndex('idx_users_email')
    .on('users')
    .column('email')
    .unique()
    .execute()

  // --- tracks ---
  await db.schema
    .createTable('tracks')
    .addColumn('id', 'text', (col) => col.primaryKey())
    .addColumn('name', 'text', (col) => col.notNull())
    .addColumn('slug', 'text', (col) => col.notNull())
    .addColumn('description', 'text')
    .addColumn('created_at', sql`timestamptz`, (col) =>
      col.notNull().defaultTo(sql`now()`)
    )
    .addColumn('updated_at', sql`timestamptz`, (col) =>
      col.notNull().defaultTo(sql`now()`)
    )
    .execute()

  await db.schema
    .createIndex('idx_tracks_slug')
    .on('tracks')
    .column('slug')
    .unique()
    .execute()

  // --- milestones ---
  await db.schema
    .createTable('milestones')
    .addColumn('id', 'text', (col) => col.primaryKey())
    .addColumn('track_id', 'text', (col) =>
      col.notNull().references('tracks.id').onDelete('cascade')
    )
    .addColumn('title', 'text', (col) => col.notNull())
    .addColumn('slug', 'text', (col) => col.notNull())
    .addColumn('position', 'integer', (col) => col.notNull())
    .addColumn('description', 'text')
    .addColumn('created_at', sql`timestamptz`, (col) =>
      col.notNull().defaultTo(sql`now()`)
    )
    .addColumn('updated_at', sql`timestamptz`, (col) =>
      col.notNull().defaultTo(sql`now()`)
    )
    .execute()

  await db.schema
    .createIndex('idx_milestones_track_id')
    .on('milestones')
    .column('track_id')
    .execute()

  await db.schema
    .createIndex('idx_milestones_track_id_position')
    .on('milestones')
    .columns(['track_id', 'position'])
    .unique()
    .execute()

  await db.schema
    .createIndex('idx_milestones_track_id_slug')
    .on('milestones')
    .columns(['track_id', 'slug'])
    .unique()
    .execute()
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('milestones').execute()
  await db.schema.dropTable('tracks').execute()
  await db.schema.dropTable('users').execute()
}
```

**kysely.config.ts pattern (default export is allowed — ESLint excludes `*.config.ts`):**
```typescript
import { defineConfig } from 'kysely-ctl'
import { PostgresDialect } from 'kysely'
import pg from 'pg'

export default defineConfig({
  dialect: new PostgresDialect({
    pool: new pg.Pool({
      connectionString: process.env['DATABASE_URL'],
    }),
  }),
  migrations: {
    migrationFolder: './migrations',
  },
})
```

**cuid2 utility pattern:**
```typescript
import { createId } from '@paralleldrive/cuid2'

export function generateId(): string {
  return createId()
}
```

### Downstream Dependencies

| Story | What It Needs From 1.2 |
|---|---|
| 1.3 DB Codegen | Migration tables exist so `kysely-codegen` can introspect schema |
| 1.3 DB Codegen | `db.ts` exports Kysely instance for codegen connection |
| 1.4 Fastify Bootstrap | `db.ts` exports instance for plugin injection |
| 1.5 Test Infrastructure | `db.ts` for test transaction wrapper (`Kysely.transaction()`) |
| 2.3 User Profile | `users` table exists for storing background questionnaire data |
| 4.x Curriculum | `tracks` and `milestones` tables exist for content serving |

### References

- [Source: _bmad-output/planning-artifacts/architecture.md#Data-Architecture — Schema management, Kysely config, naming conventions]
- [Source: _bmad-output/planning-artifacts/architecture.md#Naming-Conventions — Table/column/index naming rules]
- [Source: _bmad-output/planning-artifacts/epics.md#Story-1.2 — Acceptance criteria and story definition]
- [Source: _bmad-output/project-context.md#Technology-Stack — Kysely 0.28.x, PostgreSQL 16, cuid2]
- [Source: _bmad-output/project-context.md#Language-Specific-Rules — DB-to-API conversion, type conventions]
- [Source: _bmad-output/implementation-artifacts/1-1-monorepo-scaffold-and-local-dev-environment.md — Previous story context]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

- `pg` v8.19 does not ship bundled TypeScript types — added `@types/pg` as devDependency (not listed in story but required for `pnpm typecheck` to pass on `db.ts`)
- Docker-compose PostgreSQL port changed from 5432 to 5433 to avoid conflict with user's existing PostgreSQL instance. `.env.example` and `.env` updated accordingly.

### Completion Notes List

- Task 1: Installed `kysely@0.28.11`, `pg@8.19.0`, `@paralleldrive/cuid2@3.3.0` (prod) and `kysely-ctl@0.20.0`, `@types/pg@8.16.0` (dev) via scoped pnpm commands
- Task 2: Replaced `db.ts` placeholder with Kysely instance using `PostgresDialect` + `pg.Pool`, fail-fast on missing `DATABASE_URL`, exports `db` and `destroyDb`
- Task 3: Created `kysely.config.ts` with migration folder config, added `db:migrate`, `db:migrate:down`, `db:migrate:make` scripts, added `migrations/**` to ESLint ignores
- Task 4: Created `001_initial_schema.ts` migration with `users`, `tracks`, `milestones` tables — all snake_case naming, timestamptz columns, text IDs, proper indexes and FK constraints
- Task 5: Created `id.ts` exporting `generateId()` wrapping `@paralleldrive/cuid2`'s `createId()`
- Task 6: Verified migrate up (tables created), idempotent re-run (skipped), rollback (down), re-apply (up again), `pnpm typecheck` 7/7 pass, `pnpm lint` 7/7 pass

### Change Log

- 2026-02-26: Story 1.2 implemented — database foundation with Kysely, initial migration (users/tracks/milestones), cuid2 ID utility
- 2026-02-26: Code review fixes — added dotenv loading to kysely.config.ts (migration command was broken without manual DATABASE_URL), added id.test.ts unit tests, created .env from .env.example

### File List

- `apps/backend/package.json` — MODIFIED (added dependencies: kysely, pg, @paralleldrive/cuid2, @types/pg, kysely-ctl, dotenv; added db:* scripts)
- `apps/backend/src/shared/db.ts` — MODIFIED (replaced placeholder with Kysely instance)
- `apps/backend/src/shared/id.ts` — NEW (cuid2 generateId utility)
- `apps/backend/src/shared/id.test.ts` — NEW (unit tests for generateId)
- `apps/backend/kysely.config.ts` — NEW (kysely-ctl configuration with dotenv .env loading)
- `apps/backend/migrations/001_initial_schema.ts` — NEW (initial schema: users, tracks, milestones)
- `apps/backend/eslint.config.js` — MODIFIED (added migrations/ to ignores)
- `docker-compose.yml` — MODIFIED (PostgreSQL port 5432→5433)
- `.env.example` — MODIFIED (DATABASE_URL port 5432→5433)
- `.env` — NOT TRACKED (gitignored, created from .env.example)
- `pnpm-lock.yaml` — MODIFIED (lockfile updated with new dependencies)
