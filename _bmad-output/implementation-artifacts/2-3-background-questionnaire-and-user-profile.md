# Story 2.3: Background Questionnaire & User Profile

Status: done

<!-- When this story contradicts project-context.md, project-context.md is authoritative. -->

## Story

As a **new user**,
I want to share my background during onboarding,
So that the platform can personalize my learning experience.

## Acceptance Criteria

1. **Given** a user has just completed signup **When** they land on the onboarding page **Then** they see a 3-question questionnaire: role (e.g., backend engineer, full-stack, student), experience level (junior, mid, senior), and primary programming language (FR28).
2. **And** each question uses clear, non-intimidating language consistent with the workshop atmosphere (UX-5).
3. **And** the questionnaire is completable with keyboard only (NFR-A2).
4. **And** on completion, a `users` record is created (or updated) in the database with the background data.
5. **And** the user ID is the Firebase UID stored as text (ARCH-12).
6. **And** other entity IDs (if any created) use `cuid2` generation.
7. **And** background data is stored in a format consumable by the AI tutor for personalization (FR16).
8. **And** the time from signup completion to questionnaire completion is logged; combined with first submission timestamp (Epic 3) to produce the onboarding canary metric -- alert threshold <10 minutes from signup to first successful submission (UX Experience Instrumentation).
9. **And** the user is advanced to the skill floor assessment (Story 2.4 placeholder -- redirect to `/overview` until Story 2.4 is implemented).
10. **And** authenticated users who have NOT completed onboarding are redirected to `/onboarding` regardless of which protected route they visit.
11. **And** authenticated users who HAVE completed onboarding cannot revisit `/onboarding` -- they are redirected to `/overview`.

## Tasks / Subtasks

- [x] Task 1: Add domain types to shared package (AC: #7)
  - [x] 1.1 Add onboarding domain types to `packages/shared/src/types/domain.ts`:
    ```typescript
    export type UserRole = 'backend-engineer' | 'frontend-engineer' | 'fullstack-engineer' | 'devops-sre' | 'student' | 'other'
    export type ExperienceLevel = 'less-than-1' | '1-to-3' | '3-to-5' | '5-plus'
    export type PrimaryLanguage = 'go' | 'python' | 'javascript-typescript' | 'rust' | 'java' | 'c-cpp' | 'other'
    ```
    - Union types, NOT TS `enum` (per project convention)
    - Named exports only
    - These types are shared between frontend (form options), backend (validation), and tutor (context assembly in Epic 6)

  - [x] 1.2 Add API types to `packages/shared/src/types/api.ts`:
    ```typescript
    import type { UserRole, ExperienceLevel, PrimaryLanguage } from './domain.js'

    export interface OnboardingRequest {
      readonly email: string
      readonly displayName?: string | null
      readonly role: UserRole
      readonly experienceLevel: ExperienceLevel
      readonly primaryLanguage: PrimaryLanguage
    }

    export interface UserProfile {
      readonly id: string
      readonly email: string
      readonly displayName: string | null
      readonly role: UserRole | null
      readonly experienceLevel: ExperienceLevel | null
      readonly primaryLanguage: PrimaryLanguage | null
      readonly onboardingCompletedAt: string | null
      readonly createdAt: string
      readonly updatedAt: string
    }
    ```
    - `readonly` on all fields (shared data per project context)
    - `onboardingCompletedAt` is ISO 8601 string or `null` (timestamps as ISO 8601 in API)
    - Types already exported via `packages/shared/src/types/index.ts` re-export chain

- [x] Task 2: Create database migration (AC: #4, #5, #7, #8)
  - [x] 2.1 Create `apps/backend/migrations/002_add_user_onboarding.ts`:
    ```typescript
    import type { Kysely } from 'kysely'
    import { sql } from 'kysely'

    export async function up(db: Kysely<any>): Promise<void> {
      await db.schema
        .alterTable('users')
        .addColumn('role', 'text')
        .addColumn('experience_level', 'text')
        .addColumn('primary_language', 'text')
        .addColumn('onboarding_completed_at', sql`timestamptz`)
        .execute()
    }

    export async function down(db: Kysely<any>): Promise<void> {
      await db.schema.alterTable('users').dropColumn('onboarding_completed_at').execute()
      await db.schema.alterTable('users').dropColumn('primary_language').execute()
      await db.schema.alterTable('users').dropColumn('experience_level').execute()
      await db.schema.alterTable('users').dropColumn('role').execute()
    }
    ```
    - Kysely supports chaining multiple `addColumn` calls on a single `alterTable().execute()`
    - All new columns are nullable -- existing user records (if any) won't break
    - `onboarding_completed_at` is `timestamptz` (consistent with existing timestamp columns)
    - Column names use `snake_case` per naming convention

  - [x] 2.2 Run migration and regenerate types:
    ```bash
    pnpm --filter backend db:migrate
    pnpm --filter shared db:types
    ```
    - Verify `packages/shared/src/types/db.ts` now includes `role`, `experience_level`, `primary_language`, `onboarding_completed_at` on the `Users` interface
    - The `db.ts` file is gitignored and auto-generated -- do NOT hand-edit

- [x] Task 3: Implement backend account routes (AC: #4, #5, #7, #8)
  - [x] 3.1 Create `apps/backend/src/plugins/account/profile.ts`:
    ```typescript
    import type { FastifyInstance } from 'fastify'
    import { db } from '../../shared/db.js'
    import { toCamelCase } from '@mycscompanion/shared'

    export async function profileRoutes(fastify: FastifyInstance): Promise<void> {
      fastify.get('/profile', async (request, reply) => {
        const user = await db
          .selectFrom('users')
          .selectAll()
          .where('id', '=', request.uid)
          .executeTakeFirst()

        if (!user) {
          return reply.status(404).send({
            error: { code: 'NOT_FOUND', message: 'User profile not found' },
          })
        }

        return toCamelCase(user)
      })
    }
    ```
    - Returns 404 if user has no DB record yet (pre-onboarding state)
    - Uses `toCamelCase()` from `@mycscompanion/shared` for DB->API conversion
    - Direct response shape (no wrapper -- per architecture)

  - [x] 3.2 Create `apps/backend/src/plugins/account/onboarding.ts`:
    ```typescript
    import type { FastifyInstance } from 'fastify'
    import { sql } from 'kysely'
    import { db } from '../../shared/db.js'
    import { toCamelCase } from '@mycscompanion/shared'

    const VALID_ROLES = ['backend-engineer', 'frontend-engineer', 'fullstack-engineer', 'devops-sre', 'student', 'other'] as const
    const VALID_EXPERIENCE_LEVELS = ['less-than-1', '1-to-3', '3-to-5', '5-plus'] as const
    const VALID_PRIMARY_LANGUAGES = ['go', 'python', 'javascript-typescript', 'rust', 'java', 'c-cpp', 'other'] as const

    const onboardingSchema = {
      body: {
        type: 'object',
        required: ['email', 'role', 'experienceLevel', 'primaryLanguage'],
        properties: {
          email: { type: 'string' },
          displayName: { type: ['string', 'null'] },
          role: { type: 'string', enum: [...VALID_ROLES] },
          experienceLevel: { type: 'string', enum: [...VALID_EXPERIENCE_LEVELS] },
          primaryLanguage: { type: 'string', enum: [...VALID_PRIMARY_LANGUAGES] },
        },
        additionalProperties: false,
      },
    } as const

    interface OnboardingBody {
      readonly email: string
      readonly displayName?: string | null
      readonly role: string
      readonly experienceLevel: string
      readonly primaryLanguage: string
    }

    export async function onboardingRoutes(fastify: FastifyInstance): Promise<void> {
      fastify.post<{ Body: OnboardingBody }>('/onboarding', { schema: onboardingSchema }, async (request) => {
        const { email, displayName, role, experienceLevel, primaryLanguage } = request.body

        const result = await db
          .insertInto('users')
          .values({
            id: request.uid,
            email,
            display_name: displayName ?? null,
            role,
            experience_level: experienceLevel,
            primary_language: primaryLanguage,
            onboarding_completed_at: sql`now()`,
          })
          .onConflict((oc) =>
            oc.column('id').doUpdateSet({
              email,
              display_name: displayName ?? null,
              role,
              experience_level: experienceLevel,
              primary_language: primaryLanguage,
              onboarding_completed_at: sql`now()`,
              updated_at: sql`now()`,
            })
          )
          .returningAll()
          .executeTakeFirstOrThrow()

        return toCamelCase(result)
      })
    }
    ```
    - **No `as` cast** -- uses Fastify typed route generic `fastify.post<{ Body: OnboardingBody }>(...)` to type `request.body` without casting. This is the project-standard pattern for all routes with request bodies.
    - JSON Schema validation at API boundary (per architecture)
    - `INSERT ... ON CONFLICT DO UPDATE` handles both new users and re-submissions (e.g., if user navigates back)
    - `request.uid` from auth plugin provides Firebase UID
    - `email` and `displayName` come from request body (frontend sends `auth.currentUser.email` and `auth.currentUser.displayName`)
    - `displayName` is optional in the body (`displayName?: string | null`) -- not in JSON Schema `required` array. Use `?? null` to convert `undefined` to `null` for DB.
    - Uses `returningAll()` to return the complete record without a second query
    - `onboarding_completed_at` set to `now()` on completion

  - [x] 3.3 Update `apps/backend/src/plugins/account/index.ts` to register routes:
    ```typescript
    import type { FastifyInstance } from 'fastify'
    import { profileRoutes } from './profile.js'
    import { onboardingRoutes } from './onboarding.js'

    export async function accountPlugin(fastify: FastifyInstance): Promise<void> {
      await fastify.register(profileRoutes)
      await fastify.register(onboardingRoutes)
    }
    ```
    - Remove the eslint-disable comment and placeholder comments
    - Route prefixing is handled by `app.ts` (`{ prefix: '/api/account' }`) so routes register as `/profile` and `/onboarding` within the plugin

  - [x] 3.4 **Logging for canary metric (AC: #8):**
    - Log onboarding completion at `info` level in the POST handler:
      ```typescript
      request.log.info({ uid: request.uid, experienceLevel: body.experienceLevel }, 'onboarding_completed')
      ```
    - Do NOT log email or displayName at info level (privacy rule)
    - The canary metric (signup-to-first-submission) combines this timestamp with Epic 3's first submission timestamp -- both stored in DB, queryable via analytics

- [x] Task 4: Install shadcn Select component (AC: #1, #3)
  - [x] 4.1 Install shadcn Select:
    ```bash
    pnpm dlx shadcn@latest add select --cwd ./packages/ui
    ```
    - This installs `@radix-ui/react-select` as a peer dependency in `packages/ui/package.json`
    - Generates `packages/ui/src/components/ui/select.tsx` (kebab-case filename per shadcn convention)
    - Exports: `Select`, `SelectContent`, `SelectGroup`, `SelectItem`, `SelectLabel`, `SelectTrigger`, `SelectValue`
    - Verify internal imports use relative paths (fix `@/lib/utils` to `../../lib/utils` if needed -- same issue as Story 2.2)
  - [x] 4.2 Do NOT create a barrel file -- import components individually per project convention:
    ```typescript
    import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@mycscompanion/ui/src/components/ui/select'
    ```
  - [x] 4.3 Verify Select renders correctly with dark theme tokens. The `@source` directive from Story 2.2 already covers `packages/ui/src/components/ui/*.tsx`.

- [x] Task 5: Create Onboarding page component (AC: #1, #2, #3, #9)
  - [x] 5.1 Create `apps/webapp/src/routes/Onboarding.tsx`:
    - Full-page centered layout matching SignIn/SignUp pages (Card container, dark background)
    - Title: "Tell us about yourself" (h1, text-h2 size, weight 600)
    - Subtitle: "This helps us personalize your experience." (text-muted-foreground)

  - [x] 5.2 Three select dropdowns in vertical stack:
    - **Role:** Placeholder "Select your role"
      - Options: "Backend Engineer", "Frontend Engineer", "Full-Stack Engineer", "DevOps / SRE", "Student", "Other"
      - Values: `backend-engineer`, `frontend-engineer`, `fullstack-engineer`, `devops-sre`, `student`, `other`
    - **Experience:** Placeholder "Select your experience"
      - Options: "Less than 1 year", "1-3 years", "3-5 years", "5+ years"
      - Values: `less-than-1`, `1-to-3`, `3-to-5`, `5-plus`
    - **Primary Language:** Placeholder "Select your language"
      - Options: "Go", "Python", "JavaScript / TypeScript", "Rust", "Java", "C / C++", "Other"
      - Values: `go`, `python`, `javascript-typescript`, `rust`, `java`, `c-cpp`, `other`
    - No visible labels above selects -- placeholder text acts as label (per UX spec)
    - Add `aria-label` on each `SelectTrigger` for screen reader accessibility: `aria-label="Your role"`, `aria-label="Your experience level"`, `aria-label="Your primary programming language"`

  - [x] 5.3 Submit button:
    - "Continue" (primary/green `default` variant) -- one primary per screen
    - `min-h-11` (44px touch target)
    - Disabled until all 3 selects have a value
    - Disabled during submission with `aria-disabled="true"`

  - [x] 5.4 Form state management (React `useState` only -- NOT Zustand):
    ```typescript
    const [role, setRole] = useState('')
    const [experienceLevel, setExperienceLevel] = useState('')
    const [primaryLanguage, setPrimaryLanguage] = useState('')
    const [error, setError] = useState<string | null>(null)
    const [loading, setLoading] = useState(false)
    ```

  - [x] 5.5 Form submission:
    - On submit: set `loading: true`, clear error, call `apiFetch<UserProfile>('/api/account/onboarding', { method: 'POST', body: JSON.stringify({ email: auth.currentUser?.email, displayName: auth.currentUser?.displayName ?? null, role, experienceLevel, primaryLanguage }) })`
    - Get `email` and `displayName` from `auth.currentUser` (imported from `../../lib/firebase`)
    - On success: `navigate('/overview', { replace: true })`
      - Note: When Story 2.4 (skill floor assessment) is implemented, this will change to route based on `experienceLevel` value. For now, ALL users go to `/overview`.
    - On error: display "Couldn't save preferences, try again." below the submit button in `text-muted-foreground` (per UX retry template)
    - On finally: set `loading: false`

  - [x] 5.6 Error display:
    - Below the submit button, not above
    - `text-muted-foreground` color (no red per UX spec)
    - No form reset on failure -- preserve user's selections

  - [x] 5.7 No back button in onboarding flow (per UX spec: "No back buttons -- Signup -> questionnaire -> workspace is a one-way funnel")

  - [x] 5.8 Loading skeleton: Show purpose-built skeleton if onboarding status is being verified (while ProtectedRoute checks profile). Use same Card skeleton pattern as SignIn/SignUp pages.

- [x] Task 6: Create onboarding status hook (AC: #10, #11)
  - [x] 6.1 Create `apps/webapp/src/hooks/use-onboarding-status.ts`:
    ```typescript
    import { useState, useEffect, useCallback } from 'react'
    import { useLocation } from 'react-router'
    import { apiFetch, ApiError } from '../lib/api-fetch'
    import type { UserProfile } from '@mycscompanion/shared'

    interface OnboardingStatus {
      readonly isComplete: boolean | null // null = still loading
      readonly loading: boolean
    }

    function useOnboardingStatus(): OnboardingStatus {
      const [isComplete, setIsComplete] = useState<boolean | null>(null)
      const [loading, setLoading] = useState(true)
      const location = useLocation()

      const fetchStatus = useCallback(async () => {
        setLoading(true)
        try {
          const profile = await apiFetch<UserProfile>('/api/account/profile')
          setIsComplete(profile.onboardingCompletedAt !== null)
        } catch (err: unknown) {
          if (err instanceof ApiError && err.status === 404) {
            setIsComplete(false) // No DB record = onboarding not complete
          } else {
            // Network/server error -- treat as unknown, don't block navigation
            setIsComplete(null)
          }
        } finally {
          setLoading(false)
        }
      }, [])

      useEffect(() => {
        void fetchStatus()
      }, [fetchStatus, location.pathname])

      return { isComplete, loading }
    }

    export { useOnboardingStatus }
    ```
    - **CRITICAL: `location.pathname` is a dependency** -- ProtectedRoute uses `<Outlet />` and stays mounted during child route navigation. Without this dependency, after onboarding POST succeeds and user navigates to `/overview`, the hook would NOT re-fetch, causing an infinite redirect loop back to `/onboarding`.
    - 404 from profile endpoint = user not in DB = onboarding not complete
    - Network errors don't block the user (fail open) -- they'll see the appropriate page anyway
    - The hook refetches on every child route change within the protected route group. Since there are only 2-3 protected routes and the profile query is a single-row PK lookup, this is negligible overhead. TanStack Query (Epic 3+) will add caching later.

- [x] Task 7: Update ProtectedRoute for onboarding check (AC: #10, #11)
  - [x] 7.1 Update `apps/webapp/src/components/common/ProtectedRoute.tsx`:
    - After auth check passes, render an `<OnboardingGate />` component
    - `OnboardingGate` uses `useOnboardingStatus()` to check profile
    - Routing logic:
      - If `loading` → show `OnboardingLoadingSkeleton`
      - If `isComplete === false` AND `location.pathname !== '/onboarding'` → `<Navigate to="/onboarding" replace />`
      - If `isComplete === true` AND `location.pathname === '/onboarding'` → `<Navigate to="/overview" replace />`
      - Otherwise → `<Outlet />`
    - Use `useLocation()` from `'react-router'` to get current path

  - [x] 7.2 Create `OnboardingLoadingSkeleton` in the same file:
    - Purpose-built skeleton (no generic spinners)
    - Similar card skeleton to `AuthLoadingSkeleton` but with 3 select-shaped placeholder bars
    - Dark background, animated pulse

  - [x] 7.3 **Post-onboarding navigation flow** (relies on location-dependent hook from Task 6):
    1. Onboarding page calls `navigate('/overview', { replace: true })` after successful POST
    2. ProtectedRoute stays mounted (uses `<Outlet />`), but `useOnboardingStatus` refetches because `location.pathname` changed from `/onboarding` to `/overview`
    3. Re-fetch returns `isComplete: true` (profile now has `onboardingCompletedAt`)
    4. OnboardingGate renders `/overview` normally
    - Brief skeleton flash between onboarding and overview during refetch -- acceptable for a one-time flow
    - No React context or refetch callback needed -- the location dependency handles it automatically

- [x] Task 8: Update App.tsx routing (AC: #9, #10)
  - [x] 8.1 Replace `OnboardingPlaceholder` with real component:
    ```typescript
    import { Onboarding } from './routes/Onboarding'
    ```
  - [x] 8.2 Remove the `OnboardingPlaceholder` function
  - [x] 8.3 Update the route:
    ```tsx
    <Route path="/onboarding" element={<Onboarding />} />
    ```
  - [x] 8.4 Keep `OverviewPlaceholder` -- implemented in later stories
  - [x] 8.5 Keep all other routes unchanged

- [x] Task 9: Write backend tests (AC: all)
  - [x] 9.1 Create `apps/backend/src/plugins/account/account.test.ts`:
    - Test setup: Build Fastify app with auth plugin + account plugin using `fastify.inject()`
    - Mock Firebase auth using canonical utility:
      ```typescript
      import { createMockFirebaseAuth } from '@mycscompanion/config/test-utils'

      const mockAuth = createMockFirebaseAuth('test-user-uid')
      // Returns { verifyIdToken: vi.fn() } that resolves to { uid: 'test-user-uid', email: 'test-user-uid@test.com', name: 'Test User' }
      ```
    - Pass mock to auth plugin: `await app.register(authPlugin, { firebaseAuth: mockAuth })`
    - Use real PostgreSQL (per testing rules -- never SQLite, never in-memory)
    - DB test data cleanup pattern (this is the FIRST story with DB interaction in tests):
      ```typescript
      import { db } from '../../shared/db.js'

      afterEach(async () => {
        // Clean up test data -- use a test-specific prefix to avoid collisions
        await db.deleteFrom('users').where('id', 'like', 'test-%').execute()
        vi.restoreAllMocks()
      })

      afterAll(async () => {
        await app.close()
      })
      ```
    - Insert test data directly with `db.insertInto('users').values({...}).execute()` in individual tests
    - Use `test-` prefix for all test user IDs to enable reliable cleanup

  - [x] 9.2 `GET /api/account/profile` tests:
    - `it('should return 404 when user has no profile')` -- fresh UID with no DB record
    - `it('should return user profile with camelCase keys when user exists')` -- insert user, verify response has `displayName`, `experienceLevel`, etc.
    - `it('should return onboardingCompletedAt as null when onboarding not finished')` -- user exists but onboarding columns null
    - `it('should return 401 when no auth token provided')`

  - [x] 9.3 `POST /api/account/onboarding` tests:
    - `it('should create user record with onboarding data')` -- verify DB record created with correct columns
    - `it('should set onboarding_completed_at to current timestamp')` -- verify non-null after POST
    - `it('should return user profile in camelCase')` -- verify response shape
    - `it('should upsert when user record already exists')` -- insert user first, then POST, verify updated
    - `it('should return 400 for invalid role value')` -- JSON Schema validation
    - `it('should return 400 for missing required fields')` -- email, role, etc.
    - `it('should return 400 for invalid experienceLevel value')`
    - `it('should return 401 when no auth token provided')`

  - [x] 9.4 Testing patterns:
    - Use `fastify.inject()` only -- never supertest, never real HTTP
    - Use `vi.fn()`, `vi.mock()` -- never `jest.fn()`
    - `afterEach(() => vi.restoreAllMocks())`
    - `it()` not `test()`, names describe behavior not implementation
    - No snapshot tests
    - Import from `@mycscompanion/config/test-utils/` for shared mock utilities

- [x] Task 10: Write frontend tests (AC: all)
  - [x] 10.1 Create `apps/webapp/src/routes/Onboarding.test.tsx`:
    - `it('should render three select dropdowns for role, experience, and language')` -- verify placeholders visible
    - `it('should disable Continue button until all selects have values')`
    - `it('should submit onboarding data and navigate to overview on success')` -- mock `apiFetch`, verify called with correct payload
    - `it('should display error message on submission failure')` -- verify "Couldn't save preferences, try again."
    - `it('should preserve selections on submission failure')` -- verify selects retain values
    - `it('should disable form during submission')` -- verify button disabled and aria-disabled
    - `it('should send current user email and displayName in request body')` -- mock `auth.currentUser`
    - Mock `apiFetch` with `vi.mock('../../lib/api-fetch', ...)`
    - Mock `firebase` with `vi.mock('../../lib/firebase', ...)`
    - Use `MemoryRouter` from `'react-router'` for routing (not `react-router-dom`)
    - Use `@testing-library/user-event` for interactions (not `fireEvent`)
    - `afterEach(() => vi.restoreAllMocks())`
    - **Testing Radix UI Select** (NOT a native `<select>` -- uses portals and ARIA roles):
      ```typescript
      const user = userEvent.setup()
      // Open the select dropdown
      const roleTrigger = screen.getByRole('combobox', { name: 'Your role' })
      await user.click(roleTrigger)
      // Select an option from the portal-rendered listbox
      await user.click(screen.getByRole('option', { name: 'Backend Engineer' }))
      ```
      - Query triggers with `getByRole('combobox')` -- `aria-label` on `SelectTrigger` provides the accessible name
      - Query options with `getByRole('option')` after opening the dropdown
      - Radix portals content to `document.body` -- do NOT use `container.querySelector`
      - If options are not found after click, Radix may need a `pointerdown` event -- try `await user.pointer({ keys: '[MouseLeft]', target: trigger })` as fallback

  - [x] 10.2 Create `apps/webapp/src/hooks/use-onboarding-status.test.ts`:
    - `it('should return isComplete true when profile has onboardingCompletedAt')` -- mock `apiFetch` to return profile
    - `it('should return isComplete false when profile endpoint returns 404')` -- mock `apiFetch` to throw ApiError(404)
    - `it('should return loading true while fetching')`
    - `it('should return isComplete false when profile has null onboardingCompletedAt')`
    - `it('should refetch when location pathname changes')` -- verify `apiFetch` called again after pathname update (critical for post-onboarding navigation)
    - Use `@testing-library/react` `renderHook` for hook testing
    - Wrap hook in `MemoryRouter` since it uses `useLocation()`:
      ```typescript
      renderHook(() => useOnboardingStatus(), {
        wrapper: ({ children }) => <MemoryRouter initialEntries={['/overview']}>{children}</MemoryRouter>,
      })
      ```

  - [x] 10.3 Update `apps/webapp/src/components/common/ProtectedRoute.test.tsx`:
    - Add test: `it('should redirect to /onboarding when user has not completed onboarding')` -- mock `useOnboardingStatus` returning `isComplete: false`
    - Add test: `it('should redirect to /overview when completed user visits /onboarding')` -- mock `useOnboardingStatus` returning `isComplete: true`, current path `/onboarding`
    - Add test: `it('should render outlet when onboarding is complete')` -- mock `useOnboardingStatus` returning `isComplete: true`
    - Add test: `it('should show skeleton while checking onboarding status')`
    - Keep existing auth tests -- only add new ones for onboarding gate
    - Mock the `useOnboardingStatus` hook with `vi.mock('../../hooks/use-onboarding-status', ...)`

## Dev Notes

### Critical Architecture Patterns

- **Full-stack story** -- touches backend (migration + API routes) and frontend (component + routing enhancement).
- **Plugin isolation:** The account plugin (`apps/backend/src/plugins/account/`) imports ONLY from `../../shared/` and `@mycscompanion/shared`. It does NOT import from the auth plugin. The auth plugin's `request.uid` decorator is available via the Fastify type augmentation in `plugins/auth/index.ts`.
- **DB->API conversion:** EVERY route handler must call `toCamelCase()` on Kysely results before returning. The function is imported from `@mycscompanion/shared`.
- **JSON Schema validation** at API boundary (Fastify `schema` option). Trust internal data after validation.
- **API response shape:** Direct object for success (no wrapper). `{ error: { code, message } }` for errors.
- **State management:** Form state uses React `useState` only. NOT Zustand (only 2 Zustand stores allowed: `useWorkspaceUIStore`, `useEditorStore`). NOT TanStack Query (not yet set up in the codebase -- Epic 3+ stories will introduce it for data-heavy features).
- **No `@/` import aliases** -- relative paths within apps.
- **Named exports only** -- no default exports.
- **No `any` type** -- including test files.
- **`readonly` on function params** for shared data.

### Database Schema Changes

**New columns on `users` table (migration 002):**

| Column | Type | Nullable | Notes |
|---|---|---|---|
| `role` | `text` | Yes | One of: `backend-engineer`, `frontend-engineer`, `fullstack-engineer`, `devops-sre`, `student`, `other` |
| `experience_level` | `text` | Yes | One of: `less-than-1`, `1-to-3`, `3-to-5`, `5-plus` |
| `primary_language` | `text` | Yes | One of: `go`, `python`, `javascript-typescript`, `rust`, `java`, `c-cpp`, `other` |
| `onboarding_completed_at` | `timestamptz` | Yes | Set to `now()` when questionnaire submitted. `NULL` = onboarding not complete. |

- Column names are `snake_case` per naming convention
- All nullable to allow existing records (if any) to remain valid
- No foreign keys needed -- values are validated by JSON Schema at API boundary
- `onboarding_completed_at` acts as the "onboarding complete" flag -- `NULL` means incomplete
- User ID (`id` column) remains Firebase UID (text PK, not auto-increment, not cuid2)

### API Endpoints

| Method | Path | Request Body | Response | Notes |
|---|---|---|---|---|
| `GET` | `/api/account/profile` | -- | `UserProfile` (200) or `{ error }` (404) | Returns user record in camelCase |
| `POST` | `/api/account/onboarding` | `OnboardingRequest` | `UserProfile` (200) | Upserts user record with questionnaire data |

### UX Specifications

- **Form layout:** 3 select dropdowns in vertical stack inside a centered Card. No visible labels -- placeholder text acts as label.
- **Placeholders:** "Select your role", "Select your experience", "Select your language" -- consistent grammatical structure.
- **Submit button:** "Continue" (primary green, `default` variant). ONE primary per screen.
- **Error display:** Below submit button, `text-muted-foreground`, no red. Message: "Couldn't save preferences, try again."
- **No form reset on failure** -- preserve user's selections.
- **No back button** -- one-way funnel from signup to workspace.
- **Keyboard navigation:** Arrow keys within select dropdowns, Tab between selects, Enter/Space to submit. All built into Radix UI Select.
- **No celebration animations, no mascots, no illustrations.**

### Known Tradeoffs

- **Profile fetch on every protected route change:** `useOnboardingStatus` re-fetches `GET /api/account/profile` whenever `location.pathname` changes within the protected route group. This is necessary because ProtectedRoute stays mounted (uses `<Outlet />`) and the hook must detect state changes after onboarding completion. The profile query is a single-row PK lookup (<5ms). When TanStack Query is introduced (Epic 3+), this data will be cached with appropriate `staleTime` and the redundant fetches will be eliminated.

### Routing Changes

**Current flow (Stories 2.1-2.2):**
- Sign-up success -> `/onboarding` (placeholder)
- Sign-in success -> `/overview` (placeholder)
- Already authenticated -> redirect away from auth pages to `/overview`

**After this story:**
- Sign-up success -> `/onboarding` (real questionnaire)
- Questionnaire completion -> `/overview` (placeholder -- Story 2.4 will add skill floor routing)
- Sign-in success -> `/overview` IF onboarding complete, ELSE redirect to `/onboarding`
- Any protected route -> redirect to `/onboarding` if onboarding not complete
- `/onboarding` route -> redirect to `/overview` if onboarding already complete

### Previous Story Intelligence (Stories 2.1, 2.2)

**Key learnings to follow:**
- Firebase client SDK is `firebase` v12.x. `auth.currentUser` provides `email`, `displayName`, `uid`.
- `useAuth()` hook is read-only state observer returning `{ user, loading }`. Do NOT modify it.
- `apiFetch<T>()` in `apps/webapp/src/lib/api-fetch.ts` auto-injects Firebase Bearer token. Use this for ALL API calls.
- `MemoryRouter` from `'react-router'` (not `react-router-dom`) for test routing.
- After `shadcn add`, verify generated component imports resolve (fix `@/lib/utils` -> `../../lib/utils` if needed).
- Use `@testing-library/user-event` for realistic form interactions (installed in Story 2.2).
- Button name queries in tests: use regex `/^Continue$/` to avoid substring collisions.
- Loading state: show purpose-built card skeleton, not blank div (Story 2.2 review fix).
- Test pattern: `vi.mock()` at top-level, then dynamic import of module under test.
- `afterEach(() => vi.restoreAllMocks())` always.
- Import `{ auth }` from `../../lib/firebase` to access `auth.currentUser` for email/displayName.

**Files from Story 2.2 to reference (do not modify unless specified):**
- `apps/webapp/src/routes/SignIn.tsx` -- routing pattern after auth success
- `apps/webapp/src/routes/SignUp.tsx` -- Card layout pattern to match
- `packages/ui/src/components/ui/card.tsx` -- Card component (use as-is)
- `packages/ui/src/components/ui/button.tsx` -- Button component (use as-is)
- `packages/ui/src/globals.css` -- `@source` directive already covers new components

**Files created by Stories 2.1-2.2 that this story depends on:**
- `apps/webapp/src/lib/firebase.ts` -- Firebase client init + auth functions (import `auth` from here)
- `apps/webapp/src/lib/api-fetch.ts` -- `apiFetch<T>()` + `ApiError` (import from here)
- `apps/webapp/src/hooks/use-auth.ts` -- Auth state hook (used by ProtectedRoute)
- `apps/webapp/src/components/common/ProtectedRoute.tsx` -- **MODIFY in this story**
- `apps/webapp/src/App.tsx` -- **MODIFY in this story**
- `apps/backend/src/plugins/auth/index.ts` -- Auth plugin (provides `request.uid`, do NOT modify)
- `apps/backend/src/plugins/account/index.ts` -- **MODIFY in this story**

### Design System

- **Tailwind v4** with CSS-based config. Tokens in `packages/config/tailwind-tokens.css`.
- **Key tokens:** `bg-background` (page), `bg-card` (form card), `text-foreground` (primary text), `text-muted-foreground` (errors/secondary), `ring` (focus = green/primary).
- **Fonts:** Inter (UI) + JetBrains Mono (code), `font-display: optional` in webapp.
- **Global CSS entry:** `main.tsx` imports `@mycscompanion/ui/src/globals.css`.
- **`cn()` utility:** `@mycscompanion/ui/src/lib/utils.ts` (clsx + tailwind-merge).
- **shadcn components import pattern:**
  ```typescript
  import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@mycscompanion/ui/src/components/ui/select'
  import { Button } from '@mycscompanion/ui/src/components/ui/button'
  import { Card, CardContent, CardHeader, CardTitle } from '@mycscompanion/ui/src/components/ui/card'
  ```

### Project Structure Notes

**New files to create:**
- `packages/shared/src/types/domain.ts` -- update (add onboarding types)
- `packages/shared/src/types/api.ts` -- update (add API types)
- `apps/backend/migrations/002_add_user_onboarding.ts` -- new migration
- `apps/backend/src/plugins/account/profile.ts` -- new route file
- `apps/backend/src/plugins/account/onboarding.ts` -- new route file
- `apps/backend/src/plugins/account/account.test.ts` -- new test file
- `apps/webapp/src/routes/Onboarding.tsx` -- new route component
- `apps/webapp/src/routes/Onboarding.test.tsx` -- new test file
- `apps/webapp/src/hooks/use-onboarding-status.ts` -- new hook
- `apps/webapp/src/hooks/use-onboarding-status.test.ts` -- new test file

**Files to modify:**
- `apps/backend/src/plugins/account/index.ts` -- register routes
- `apps/webapp/src/App.tsx` -- replace placeholder
- `apps/webapp/src/components/common/ProtectedRoute.tsx` -- add onboarding gate
- `apps/webapp/src/components/common/ProtectedRoute.test.tsx` -- add onboarding tests

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 2.3: Background Questionnaire & User Profile] -- BDD acceptance criteria, FR/NFR/UX requirement IDs
- [Source: _bmad-output/planning-artifacts/architecture.md#Database Schema] -- Users table, column naming, snake_case conventions
- [Source: _bmad-output/planning-artifacts/architecture.md#Account Plugin Routes] -- `POST /onboarding`, `GET /profile` endpoint definitions
- [Source: _bmad-output/planning-artifacts/architecture.md#API Route Conventions] -- kebab-case paths, camelCase responses, `toCamelCase()` conversion
- [Source: _bmad-output/planning-artifacts/architecture.md#Authentication & Security] -- Auth boundary, `request.uid` pattern, plugin isolation
- [Source: _bmad-output/planning-artifacts/architecture.md#AI Tutor Context Assembly] -- Background questionnaire consumed by tutor system prompt
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Background Questionnaire] -- 3 select dropdowns, placeholder text, no labels, "Continue" button
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Flow 1: First Session] -- Onboarding funnel, no back buttons, canary metric
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Form Patterns] -- No asterisks, no inline validation for selects, error below action
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Keyboard Interaction] -- Select: Arrow keys + Enter to select
- [Source: _bmad-output/project-context.md] -- All project rules, anti-patterns, naming conventions

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

- Radix UI Select requires jsdom polyfills (ResizeObserver, scrollIntoView, pointer capture) for testing. Used `fireEvent.pointerDown` instead of `userEvent.click` to open Select dropdowns in tests.
- shadcn Select generated with `src/lib/utils` import path — fixed to `../../lib/utils` (same issue as Story 2.2).
- Pre-existing lint error in `apps/webapp/src/lib/firebase.test.ts:24` (@typescript-eslint/consistent-type-imports) — not introduced by this story.

### Completion Notes List

- All 10 tasks completed with all subtasks
- Domain types (`UserRole`, `ExperienceLevel`, `PrimaryLanguage`) and API types (`OnboardingRequest`, `UserProfile`) added to shared package
- Migration 002 adds 4 columns to users table (role, experience_level, primary_language, onboarding_completed_at)
- Backend: `GET /api/account/profile` (404 if no record) and `POST /api/account/onboarding` (upsert) routes implemented
- Frontend: Onboarding page with 3 Radix Select dropdowns, Continue button, error handling
- `useOnboardingStatus` hook with location-dependent refetch for post-onboarding navigation
- ProtectedRoute updated with OnboardingGate and OnboardingLoadingSkeleton
- App.tsx placeholder replaced with real Onboarding component
- 12 backend tests (real PostgreSQL, fastify.inject)
- 7 Onboarding component tests, 5 useOnboardingStatus hook tests, 8 ProtectedRoute tests (5 new)
- Full test suite: 126 tests pass, 0 regressions
- All typecheck passes across all packages

### Change Log

- 2026-02-28: Story 2.3 implemented — Background Questionnaire & User Profile (all 10 tasks, 126 tests pass)
- 2026-03-01: Code review fixes applied — 10 issues fixed (3 HIGH, 5 MEDIUM, 2 LOW), 128 tests pass
  - H1: Moved canary metric log after DB operation in onboarding.ts (was logging before executeTakeFirstOrThrow)
  - H2: Added missing 'should refetch when location pathname changes' test to use-onboarding-status.test.ts
  - H3: Typed VALID_ROLES/EXPERIENCE_LEVELS/PRIMARY_LANGUAGES arrays with domain types for compile-time safety
  - M1: OnboardingBody interface now uses UserRole/ExperienceLevel/PrimaryLanguage instead of plain string
  - M2: Fixed File List — domain.ts and api.ts correctly listed under Modified (not New)
  - M3: Added ProtectedRoute test for fail-open behavior (isComplete: null, loading: false)
  - M4: Replaced hardcoded bg-neutral-950/bg-neutral-800 with bg-background/bg-muted design tokens in skeletons
  - M5: Made db injectable via plugin options in account plugin, profile routes, and onboarding routes (DI compliance)
  - L1: Replaced non-null assertion (!) with optional chaining (?.) in account.test.ts
  - L2: Added minLength: 1 to email JSON Schema validation in onboarding route

### File List

**New files:**
- `apps/backend/migrations/002_add_user_onboarding.ts` — adds onboarding columns to users table
- `apps/backend/src/plugins/account/profile.ts` — GET /api/account/profile route
- `apps/backend/src/plugins/account/onboarding.ts` — POST /api/account/onboarding route
- `apps/backend/src/plugins/account/account.test.ts` — 12 backend tests
- `apps/webapp/src/routes/Onboarding.tsx` — onboarding questionnaire page
- `apps/webapp/src/routes/Onboarding.test.tsx` — 7 onboarding component tests
- `apps/webapp/src/hooks/use-onboarding-status.ts` — onboarding status check hook
- `apps/webapp/src/hooks/use-onboarding-status.test.ts` — 5 hook tests
- `packages/ui/src/components/ui/select.tsx` — shadcn Select component (generated)

**Modified files:**
- `packages/shared/src/types/domain.ts` — added onboarding domain types (UserRole, ExperienceLevel, PrimaryLanguage)
- `packages/shared/src/types/api.ts` — added API types (OnboardingRequest, UserProfile)
- `apps/backend/src/plugins/account/index.ts` — registered profile and onboarding routes
- `apps/webapp/src/App.tsx` — replaced OnboardingPlaceholder with real Onboarding component
- `apps/webapp/src/components/common/ProtectedRoute.tsx` — added OnboardingGate and OnboardingLoadingSkeleton
- `apps/webapp/src/components/common/ProtectedRoute.test.tsx` — added 5 onboarding gate tests
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — story status updated
