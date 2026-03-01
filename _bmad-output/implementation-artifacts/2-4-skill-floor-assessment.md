# Story 2.4: Skill Floor Assessment

Status: done

<!-- When this story contradicts project-context.md, project-context.md is authoritative. -->

## Story

As a **new user**,
I want to complete a quick skill check so the platform can confirm I have the prerequisite knowledge.

## Acceptance Criteria

1. **Given** a user has completed the background questionnaire **When** the system evaluates their responses **Then** it identifies potentially under-qualified users based on `experienceLevel === 'less-than-1'` (FR29).
2. **And** flagged users are presented with a lightweight code comprehension check — 3 multiple-choice questions using Go code snippets, not a coding test (FR30).
3. **And** the comprehension check assesses basic familiarity with programming concepts (loops, conditionals, filtering) relevant to building a database.
4. **And** users who pass the check (2/3 or more correct) proceed to the workspace (`/overview`).
5. **And** users who are not flagged (experience >= 1 year) skip the check entirely and proceed directly to the workspace.
6. **And** users who fail the check are redirected to a placeholder page (`/not-ready`) — Story 2.5 will implement the full graceful redirect.
7. **And** the assessment UI is keyboard-accessible and meets accessibility standards (NFR-A1, NFR-A2).
8. **And** the assessment uses the same dark-first design language as the rest of the app.
9. **And** no timer, no score display, no per-question feedback — silent processing, route to pass/fail.
10. **And** all 3 questions are visible simultaneously (no pagination for MVP).
11. **And** assessment result (`skill_floor_passed`, `skill_floor_completed_at`) is persisted to the `users` table.
12. **And** returning users who need assessment but haven't completed it are shown the assessment directly (skip questionnaire).

## Tasks / Subtasks

- [x] Task 1: Update shared types (AC: #11)
  - [x] 1.1 Update `packages/shared/src/types/api.ts` — add two fields to `UserProfile`:
    ```typescript
    readonly skillFloorPassed: boolean | null
    readonly skillFloorCompletedAt: string | null
    ```
  - [x] 1.2 Add `SkillAssessmentRequest` interface to `packages/shared/src/types/api.ts`:
    ```typescript
    export interface SkillAssessmentRequest {
      readonly passed: boolean
    }
    ```
  - [x] 1.3 Verify exports chain: `api.ts` → `types/index.ts` → `packages/shared/src/index.ts` re-exports `SkillAssessmentRequest` and updated `UserProfile`

- [x] Task 2: Create database migration (AC: #11)
  - [x] 2.1 Create `apps/backend/migrations/003_add_skill_assessment.ts`:
    ```typescript
    import type { Kysely } from 'kysely'
    import { sql } from 'kysely'

    export async function up(db: Kysely<any>): Promise<void> {
      await db.schema
        .alterTable('users')
        .addColumn('skill_floor_passed', 'boolean')
        .addColumn('skill_floor_completed_at', sql`timestamptz`)
        .execute()
    }

    export async function down(db: Kysely<any>): Promise<void> {
      await db.schema.alterTable('users').dropColumn('skill_floor_completed_at').execute()
      await db.schema.alterTable('users').dropColumn('skill_floor_passed').execute()
    }
    ```
    - Both columns nullable — existing users and users who skip assessment remain unaffected
    - `skill_floor_passed`: `null` = not taken, `true` = passed, `false` = failed
    - `skill_floor_completed_at`: `timestamptz`, set to `now()` on completion
    - `down()` drops in reverse order of `addColumn`

  - [x] 2.2 Run migration and regenerate types:
    ```bash
    pnpm --filter backend db:migrate
    pnpm --filter shared db:types
    ```
    - Verify `packages/shared/src/types/db.ts` now includes `skill_floor_passed` and `skill_floor_completed_at` on the `Users` interface

- [x] Task 3: Install shadcn RadioGroup component (AC: #2, #7, #10)
  - [x] 3.1 Install shadcn RadioGroup:
    ```bash
    pnpm dlx shadcn@latest add radio-group --cwd ./packages/ui
    ```
    - Generates `packages/ui/src/components/ui/radio-group.tsx`
    - Uses `@radix-ui/react-radio-group` (already available via `radix-ui` dependency)
    - If `shadcn add` installs a separate `@radix-ui/react-radio-group` package, remove it — the bundled `radix-ui` (v1.4.3, already in `packages/ui/package.json`) includes all Radix primitives. The generated component's import from `@radix-ui/react-radio-group` resolves correctly through the bundled package.
    - The `@source` directive in `globals.css` already covers `./components/**/*.{ts,tsx}` — no CSS update needed
  - [x] 3.2 Fix import path if needed: `@/lib/utils` → `../../lib/utils` (same issue as Stories 2.2, 2.3)
  - [x] 3.3 Do NOT create a barrel file — import individually per project convention:
    ```typescript
    import { RadioGroup, RadioGroupItem } from '@mycscompanion/ui/src/components/ui/radio-group'
    ```

- [x] Task 4: Implement backend skill assessment endpoint (AC: #11)
  - [x] 4.1 Create `apps/backend/src/plugins/account/skill-assessment.ts`:
    ```typescript
    import type { FastifyInstance } from 'fastify'
    import { sql } from 'kysely'
    import { toCamelCase } from '@mycscompanion/shared'
    import { db as defaultDb } from '../../shared/db.js'

    const skillAssessmentSchema = {
      body: {
        type: 'object',
        required: ['passed'],
        properties: {
          passed: { type: 'boolean' },
        },
        additionalProperties: false,
      },
    } as const

    interface SkillAssessmentBody {
      readonly passed: boolean
    }

    interface SkillAssessmentRoutesOptions {
      readonly db?: typeof defaultDb
    }

    export async function skillAssessmentRoutes(
      fastify: FastifyInstance,
      opts: SkillAssessmentRoutesOptions = {}
    ): Promise<void> {
      const db = opts.db ?? defaultDb

      fastify.post<{ Body: SkillAssessmentBody }>(
        '/skill-assessment',
        { schema: skillAssessmentSchema },
        async (request, reply) => {
          const { passed } = request.body

          const result = await db
            .updateTable('users')
            .set({
              skill_floor_passed: passed,
              skill_floor_completed_at: sql`now()`,
              updated_at: sql`now()`,
            })
            .where('id', '=', request.uid)
            .where('onboarding_completed_at', 'is not', null)
            .returningAll()
            .executeTakeFirst()

          if (!result) {
            return reply.status(400).send({
              error: { code: 'ONBOARDING_REQUIRED', message: 'Complete onboarding before taking the assessment' },
            })
          }

          request.log.info({ uid: request.uid, passed }, 'skill_assessment_completed')

          return toCamelCase(result)
        }
      )
    }
    ```
    - DI-compliant `db` injection via options (matches onboarding.ts pattern)
    - WHERE clause ensures onboarding is completed before accepting assessment
    - Idempotent — re-submission overwrites (no retake UI exists, but API is safe)
    - Log after DB operation succeeds (Story 2.3 review fix H1)
    - Never log user answers at info level (privacy rule)

  - [x] 4.2 Update `apps/backend/src/plugins/account/index.ts` to register the new route:
    ```typescript
    import { skillAssessmentRoutes } from './skill-assessment.js'

    // Inside accountPlugin function:
    await fastify.register(skillAssessmentRoutes, { db })
    ```

- [x] Task 5: Create SkillFloorCheck component (AC: #2, #3, #7, #8, #9, #10)
  - [x] 5.1 Create directory `apps/webapp/src/components/onboarding/`
  - [x] 5.2 Create `apps/webapp/src/components/onboarding/SkillFloorCheck.tsx`:

    **Props interface:**
    ```typescript
    interface SkillFloorCheckProps {
      readonly onComplete: (passed: boolean) => void
    }
    ```

    **Assessment questions** — hardcoded constant array (MVP):
    ```typescript
    interface Question {
      readonly id: number
      readonly code: string
      readonly prompt: string
      readonly options: readonly string[]
      readonly correctIndex: number
    }

    const QUESTIONS: readonly Question[] = [
      {
        id: 1,
        code: `func count(items []string, target string) int {
        total := 0
        for _, item := range items {
            if item == target {
                total++
            }
        }
        return total
    }`,
        prompt: 'What does count([]string{"a", "b", "a", "c", "a"}, "a") return?',
        options: ['1', '2', '3', '5'],
        correctIndex: 2,
      },
      {
        id: 2,
        code: `func transform(values []int) []int {
        result := []int{}
        for _, v := range values {
            if v%2 == 0 {
                result = append(result, v*v)
            }
        }
        return result
    }`,
        prompt: 'What does transform([]int{1, 2, 3, 4, 5}) return?',
        options: ['[1, 4, 9, 16, 25]', '[2, 4]', '[4, 16]', '[1, 9, 25]'],
        correctIndex: 2,
      },
      {
        id: 3,
        code: `func summarize(records map[string]int) int {
        sum := 0
        for _, v := range records {
            if v > 10 {
                sum += v
            }
        }
        return sum
    }`,
        prompt: 'What does summarize(map[string]int{"a": 5, "b": 15, "c": 3, "d": 20}) return?',
        options: ['43', '35', '15', '20'],
        correctIndex: 1,
      },
    ]
    ```
    - Questions test **code reading**, not Go knowledge (loops, conditionals, filtering)
    - Pass threshold: 2/3 correct (generous — catching clearly wrong-fit, not borderline)
    - Correct answers: Q1=3 (index 2), Q2=[4, 16] (index 2), Q3=35 (index 1)

    **Required imports:**
    ```typescript
    import { useState } from 'react'
    import { apiFetch } from '../../lib/api-fetch'
    import { RadioGroup, RadioGroupItem } from '@mycscompanion/ui/src/components/ui/radio-group'
    import { Label } from '@mycscompanion/ui/src/components/ui/label'
    import { Button } from '@mycscompanion/ui/src/components/ui/button'
    import { Card, CardContent, CardHeader, CardTitle } from '@mycscompanion/ui/src/components/ui/card'
    ```

    **Layout:**
    - Full-page centered layout matching onboarding questionnaire (Card container, dark background)
    - Title: "Let's make sure this is the right fit" (h1, text-h2 size, weight 600) — aligns with UX spec Flow 5 "fit check" positioning
    - Subtitle: "Read the Go snippets below and pick the best answer for each." (`text-muted-foreground`)
    - NO framing as "test" or "exam" — positioned as a "fit check" per UX spec
    - All 3 questions visible simultaneously in vertical stack (no pagination)

    **Each question block:**
    - Code snippet in `<pre><code>` block with `font-mono bg-muted rounded-md p-4` styling
    - Question prompt text below code
    - `RadioGroup` with 4 `RadioGroupItem` options
    - Each radio option uses `Label` component for click-to-select
    - Add `aria-label` on each `RadioGroup`: `aria-label="Question {n}"`

    **Submit button:**
    - "Continue" (primary `default` variant) — same label as questionnaire for consistency
    - `min-h-11` (44px touch target)
    - Disabled until all 3 questions have a selected answer
    - Disabled during submission with `aria-disabled="true"`

    **Form state (React `useState` only — NOT Zustand):**
    ```typescript
    const [answers, setAnswers] = useState<Record<number, number>>({})
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    ```

    **Submission logic:**
    ```typescript
    async function handleSubmit(e: FormEvent): Promise<void> {
      e.preventDefault()
      setLoading(true)
      setError(null)

      // Evaluate locally — count correct answers
      const correctCount = QUESTIONS.reduce(
        (acc, q) => acc + (answers[q.id] === q.correctIndex ? 1 : 0),
        0
      )
      const passed = correctCount >= 2

      try {
        await apiFetch('/api/account/skill-assessment', {
          method: 'POST',
          body: JSON.stringify({ passed }),
        })
        onComplete(passed)
      } catch {
        setError("Couldn't save your results. Try again.")
      } finally {
        setLoading(false)
      }
    }
    ```
    - Evaluation happens on the frontend (questions are a fit check, not a security boundary)
    - Backend receives only `{ passed: boolean }` — no answer data sent
    - Error handling follows retry template pattern (below action, `text-muted-foreground`, no red)
    - No form reset on failure — preserve user's selections

  - [x] 5.3 No celebration, no score display, no per-question feedback after submission

- [x] Task 6: Update Onboarding.tsx for assessment flow (AC: #1, #4, #5, #12)
  - [x] 6.1 Add step management state to `apps/webapp/src/routes/Onboarding.tsx`:
    ```typescript
    const [step, setStep] = useState<'loading' | 'questionnaire' | 'assessment'>('loading')
    ```

  - [x] 6.2 Add profile detection on mount (determines which step to show for returning users):
    **New imports required** (add to existing imports in `Onboarding.tsx`):
    ```typescript
    import { useState, useEffect } from 'react'  // add useEffect
    import { apiFetch, ApiError } from '../lib/api-fetch'  // add ApiError
    import type { UserProfile } from '@mycscompanion/shared'  // add UserProfile
    import { SkillFloorCheck } from '../components/onboarding/SkillFloorCheck'  // new
    ```

    ```typescript
    useEffect(() => {
      async function detectStep(): Promise<void> {
        try {
          const profile = await apiFetch<UserProfile>('/api/account/profile')
          if (profile.onboardingCompletedAt === null) {
            setStep('questionnaire')
          } else if (
            profile.experienceLevel === 'less-than-1' &&
            profile.skillFloorCompletedAt === null
          ) {
            setStep('assessment')
          } else if (
            profile.experienceLevel === 'less-than-1' &&
            profile.skillFloorPassed === false
          ) {
            // Already failed assessment — redirect directly to /not-ready
            // (avoids a visible flash through /overview before gate redirects)
            navigate('/not-ready', { replace: true })
          } else {
            navigate('/overview', { replace: true })
          }
        } catch (err: unknown) {
          if (err instanceof ApiError && err.status === 404) {
            setStep('questionnaire')
          }
        }
      }
      void detectStep()
    }, [navigate])
    ```
    - 404 from profile → no user record → show questionnaire
    - Onboarding done + needs assessment → show assessment
    - Onboarding done + assessment failed → redirect to `/not-ready` (prevents flash)
    - Onboarding done + no assessment needed → redirect (shouldn't reach here via gate, but safe)
    - This fetch is intentionally separate from `useOnboardingStatus` — the gate handles macro routing, this handles micro flow within the page

  - [x] 6.3 Modify the questionnaire submit handler — replace the unconditional `navigate('/overview')` with experience-level check:
    ```typescript
    // After successful POST /api/account/onboarding:
    const response = await apiFetch<UserProfile>('/api/account/onboarding', { ... })

    if (response.experienceLevel === 'less-than-1') {
      setStep('assessment')
    } else {
      navigate('/overview', { replace: true })
    }
    ```
    - Import `UserProfile` from `@mycscompanion/shared`
    - The `apiFetch` call must now capture the response (currently it doesn't)
    - Update the return type annotation: `apiFetch<UserProfile>(...)`

  - [x] 6.4 Add assessment completion handler:
    ```typescript
    function handleAssessmentComplete(passed: boolean): void {
      if (passed) {
        navigate('/overview', { replace: true })
      } else {
        navigate('/not-ready', { replace: true })
      }
    }
    ```

  - [x] 6.5 Conditionally render based on step:
    ```typescript
    if (step === 'loading') return <OnboardingLoadingSkeleton />
    if (step === 'assessment') return <SkillFloorCheck onComplete={handleAssessmentComplete} />
    // else: render questionnaire form (existing code)
    ```
    - Import `SkillFloorCheck` from `../components/onboarding/SkillFloorCheck`
    - `OnboardingLoadingSkeleton` is already defined in `ProtectedRoute.tsx` — either import it or create a local equivalent. Prefer extracting to a shared location or duplicating the simple skeleton inline.
    - Actually, `OnboardingLoadingSkeleton` is defined inside `ProtectedRoute.tsx` and not exported. Create a local loading skeleton in `Onboarding.tsx` following the same pattern (Card skeleton with pulse animation, dark background, `bg-muted` bars).

  - [x] 6.6 The existing questionnaire form code stays inline in `Onboarding.tsx` — do NOT refactor it into a separate component (avoid unnecessary churn)

- [x] Task 7: Update useOnboardingStatus hook (AC: #1, #5, #6, #12)
  - [x] 7.1 Update `apps/webapp/src/hooks/use-onboarding-status.ts`:

    **Updated interface:**
    ```typescript
    interface OnboardingStatus {
      readonly isComplete: boolean | null // null = loading or error
      readonly assessmentFailed: boolean
      readonly loading: boolean
    }
    ```

    **Updated logic:**
    ```typescript
    function useOnboardingStatus(): OnboardingStatus {
      const [isComplete, setIsComplete] = useState<boolean | null>(null)
      const [assessmentFailed, setAssessmentFailed] = useState(false)
      const [loading, setLoading] = useState(true)
      const location = useLocation()

      const fetchStatus = useCallback(async () => {
        setLoading(true)
        try {
          const profile = await apiFetch<UserProfile>('/api/account/profile')

          if (profile.onboardingCompletedAt === null) {
            // Questionnaire not done
            setIsComplete(false)
            setAssessmentFailed(false)
          } else if (profile.experienceLevel === 'less-than-1') {
            if (profile.skillFloorCompletedAt === null) {
              // Needs assessment, hasn't taken it
              setIsComplete(false)
              setAssessmentFailed(false)
            } else if (profile.skillFloorPassed === false) {
              // Took assessment, failed
              setIsComplete(false)
              setAssessmentFailed(true)
            } else {
              // Took assessment, passed
              setIsComplete(true)
              setAssessmentFailed(false)
            }
          } else {
            // Experience >= 1 year, no assessment needed
            setIsComplete(true)
            setAssessmentFailed(false)
          }
        } catch (err: unknown) {
          if (err instanceof ApiError && err.status === 404) {
            setIsComplete(false)
            setAssessmentFailed(false)
          } else {
            setIsComplete(null)
            setAssessmentFailed(false)
          }
        } finally {
          setLoading(false)
        }
      }, [])

      useEffect(() => {
        void fetchStatus()
      }, [fetchStatus, location.pathname])

      return { isComplete, assessmentFailed, loading }
    }
    ```
    - `isComplete = true` only when: onboarding done AND (no assessment needed OR assessment passed)
    - `assessmentFailed = true` only when: assessment completed AND `skillFloorPassed === false`
    - `isComplete = false` covers: no profile, questionnaire not done, or assessment needed but not completed
    - Fail-open on network errors: `isComplete = null`, `assessmentFailed = false`

- [x] Task 8: Update ProtectedRoute OnboardingGate (AC: #4, #5, #6)
  - [x] 8.1 Update `apps/webapp/src/components/common/ProtectedRoute.tsx` `OnboardingGate`:
    ```typescript
    function OnboardingGate(): React.ReactElement {
      const { isComplete, assessmentFailed, loading } = useOnboardingStatus()
      const location = useLocation()

      if (loading) return <OnboardingLoadingSkeleton />

      // Failed assessment → /not-ready (Story 2.5 placeholder)
      if (assessmentFailed && location.pathname !== '/not-ready') {
        return <Navigate to="/not-ready" replace />
      }

      // Don't let non-failed users access /not-ready
      if (!assessmentFailed && location.pathname === '/not-ready') {
        return <Navigate to="/overview" replace />
      }

      // Incomplete onboarding → /onboarding
      if (isComplete === false && !assessmentFailed && location.pathname !== '/onboarding') {
        return <Navigate to="/onboarding" replace />
      }

      // Complete user revisiting /onboarding → /overview
      if (isComplete === true && location.pathname === '/onboarding') {
        return <Navigate to="/overview" replace />
      }

      return <Outlet />
    }
    ```
    - `assessmentFailed` check comes first — these users must see `/not-ready`
    - Non-failed users are blocked from `/not-ready`
    - All other logic unchanged from Story 2.3

- [x] Task 9: Add /not-ready placeholder route to App.tsx (AC: #6)
  - [x] 9.1 Add placeholder component in `apps/webapp/src/App.tsx`:
    ```typescript
    function NotReadyPlaceholder(): React.ReactElement {
      return (
        <div className="flex h-screen items-center justify-center bg-background text-muted-foreground">
          Not Ready (Story 2.5)
        </div>
      )
    }
    ```
    - Uses design tokens (`bg-background`, `text-muted-foreground`) not raw Tailwind colors
    - Note: The existing `OverviewPlaceholder` uses raw Tailwind colors (`bg-neutral-950 text-neutral-400`) — this is known tech debt from earlier stories. Do NOT change `OverviewPlaceholder` in this story.
  - [x] 9.2 Add route inside the `<Route element={<ProtectedRoute />}>` wrapper:
    ```tsx
    <Route path="/not-ready" element={<NotReadyPlaceholder />} />
    ```

- [x] Task 10: Write backend tests (AC: all)
  - [x] 10.1 Update `apps/backend/src/plugins/account/account.test.ts` with new test group:

    **Test setup reuses existing pattern:**
    - Same `buildApp()` function, same `mockAuth`, same `TEST_UID`
    - Add cleanup for new columns in `afterEach`:
      ```typescript
      await db.deleteFrom('users').where('id', 'like', 'test-%').execute()
      ```

    **`POST /api/account/skill-assessment` tests:**
    ```typescript
    describe('POST /api/account/skill-assessment', () => {
      it('should update user with passed=true and set skill_floor_completed_at', async () => {
        // Insert user with onboarding complete
        await db.insertInto('users').values({
          id: TEST_UID,
          email: 'test@test.com',
          onboarding_completed_at: sql`now()`,
        }).execute()

        const res = await app.inject({
          method: 'POST',
          url: '/api/account/skill-assessment',
          headers: { authorization: 'Bearer test-token' },
          payload: { passed: true },
        })

        expect(res.statusCode).toBe(200)
        const body = JSON.parse(res.payload)
        expect(body.skillFloorPassed).toBe(true)
        expect(body.skillFloorCompletedAt).not.toBeNull()
      })

      it('should update user with passed=false', async () => {
        // Insert user with onboarding complete
        // POST with { passed: false }
        // Verify skillFloorPassed === false and skillFloorCompletedAt set
      })

      it('should return 400 when onboarding not completed', async () => {
        // Insert user WITHOUT onboarding_completed_at
        // POST → expect 400 with ONBOARDING_REQUIRED code
      })

      it('should return 400 when user does not exist', async () => {
        // No user record → UPDATE affects 0 rows → 400
      })

      it('should return camelCase response keys', async () => {
        // Verify skillFloorPassed, skillFloorCompletedAt (not snake_case)
      })

      it('should return 400 for missing passed field', async () => {
        // Empty body → JSON Schema validation → 400
      })

      it('should return 400 for non-boolean passed value', async () => {
        // { passed: "yes" } → JSON Schema validation → 400
      })

      it('should return 401 when no auth token provided', async () => {
        // No Authorization header → 401
      })

      it('should overwrite previous assessment result on re-submission', async () => {
        // Insert user with existing skill_floor_passed=false
        // POST with { passed: true }
        // Verify skill_floor_passed is now true
      })
    })
    ```

    **`GET /api/account/profile` tests for new fields:**
    ```typescript
    it('should return skillFloorPassed and skillFloorCompletedAt in profile after assessment', async () => {
      // Insert user with onboarding complete + skill_floor_passed=true + skill_floor_completed_at set
      // GET /api/account/profile → verify skillFloorPassed and skillFloorCompletedAt in response
    })

    it('should return skillFloorPassed as null when assessment not taken', async () => {
      // Insert user with onboarding complete, no assessment columns set
      // GET /api/account/profile → verify skillFloorPassed is null, skillFloorCompletedAt is null
    })
    ```
    - These tests validate that `profile.ts` (unchanged code, uses `selectAll()`) automatically returns the new columns after migration — no code changes needed in `profile.ts`

  - [x] 10.2 Testing patterns (same as Story 2.3):
    - `fastify.inject()` only — never supertest
    - `vi.fn()`, `vi.mock()` — never `jest.fn()`
    - `afterEach(() => vi.restoreAllMocks())`
    - `it()` not `test()`, names describe behavior
    - Real PostgreSQL — never SQLite/in-memory
    - `test-` prefix for all test user IDs

- [x] Task 11: Write frontend tests (AC: all)
  - [x] 11.1 Create `apps/webapp/src/components/onboarding/SkillFloorCheck.test.tsx`:

    **Radix UI polyfills in `beforeAll`** (same as Onboarding.test.tsx):
    ```typescript
    beforeAll(() => {
      globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} }
      Element.prototype.scrollIntoView = vi.fn()
      Element.prototype.hasPointerCapture = vi.fn().mockReturnValue(false)
      Element.prototype.setPointerCapture = vi.fn()
      Element.prototype.releasePointerCapture = vi.fn()
    })
    ```

    **Test cases:**
    - `it('should render 3 code snippets with radio button groups')` — verify 3 `RadioGroup` elements visible
    - `it('should render Continue button disabled until all questions answered')` — verify disabled state
    - `it('should enable Continue button when all 3 questions have selections')`
    - `it('should call onComplete with true when 2+ answers are correct')` — select correct answers for 2/3 questions, submit, verify `onComplete(true)` called
    - `it('should call onComplete with false when fewer than 2 answers correct')` — select wrong answers, submit, verify `onComplete(false)` called
    - `it('should display error message on API failure')` — mock `apiFetch` to throw, verify "Couldn't save your results. Try again."
    - `it('should preserve selections on API failure')` — verify radio selections maintained after error
    - `it('should disable form during submission')` — verify button disabled and `aria-disabled`
    - `it('should be keyboard-accessible')` — verify `RadioGroup` has `aria-label` attributes

    **Testing Radix RadioGroup in jsdom:**
    ```typescript
    // RadioGroup renders as role="radiogroup"
    // RadioGroupItem renders as role="radio"
    const radioGroup = screen.getByRole('radiogroup', { name: 'Question 1' })
    const option = within(radioGroup).getByRole('radio', { name: '3' })
    await userEvent.click(option)
    ```

    **Mocking:**
    ```typescript
    const mockApiFetch = vi.fn()
    vi.mock('../../lib/api-fetch', () => ({
      apiFetch: (...args: unknown[]) => mockApiFetch(...args),
    }))
    ```

  - [x] 11.2 Update `apps/webapp/src/routes/Onboarding.test.tsx`:
    - Add test: `it('should show SkillFloorCheck when experience is less-than-1 after questionnaire')` — mock `apiFetch` POST to return profile with `experienceLevel: 'less-than-1'`, verify SkillFloorCheck renders
    - Add test: `it('should navigate to /overview when experience is 1+ years after questionnaire')` — mock `apiFetch` POST to return profile with `experienceLevel: '1-to-3'`, verify navigation
    - Add test: `it('should show assessment directly for returning user needing assessment')` — mock `apiFetch` GET profile with `onboardingCompletedAt` set, `experienceLevel: 'less-than-1'`, `skillFloorCompletedAt: null`, verify SkillFloorCheck renders
    - Add test: `it('should show loading skeleton while detecting step')`
    - Add test: `it('should redirect to /not-ready for returning user who failed assessment')` — mock `apiFetch` GET profile with `skillFloorPassed: false`, `skillFloorCompletedAt` set, verify navigation to `/not-ready`

  - [x] 11.3 Update `apps/webapp/src/hooks/use-onboarding-status.test.ts`:
    - Add test: `it('should return isComplete true when experience >= 1 year and onboarding done')` — mock profile with `experienceLevel: '3-to-5'`, `onboardingCompletedAt` set
    - Add test: `it('should return isComplete false when assessment needed but not completed')` — mock profile with `experienceLevel: 'less-than-1'`, `onboardingCompletedAt` set, `skillFloorCompletedAt: null`
    - Add test: `it('should return assessmentFailed true when assessment completed with passed=false')` — mock profile with `skillFloorPassed: false`, `skillFloorCompletedAt` set
    - Add test: `it('should return isComplete true when assessment passed')` — mock profile with `skillFloorPassed: true`
    - Update existing tests to include `assessmentFailed` in expected return values

  - [x] 11.4 Update `apps/webapp/src/components/common/ProtectedRoute.test.tsx`:
    - Add test: `it('should redirect to /not-ready when assessment failed')` — mock `useOnboardingStatus` returning `assessmentFailed: true`
    - Add test: `it('should redirect to /overview when non-failed user visits /not-ready')` — mock `assessmentFailed: false`, current path `/not-ready`
    - Add test: `it('should allow failed user to see /not-ready page')` — mock `assessmentFailed: true`, current path `/not-ready`
    - Update existing tests to include `assessmentFailed: false` in mock returns

## Dev Notes

### Critical Architecture Patterns

- **Assessment lives within the onboarding flow** — not a separate top-level route. `Onboarding.tsx` manages the step transition from questionnaire to assessment based on experience level.
- **Plugin isolation:** Assessment endpoint is in the `account` plugin (`apps/backend/src/plugins/account/skill-assessment.ts`). Imports only from `../../shared/` and `@mycscompanion/shared`.
- **DB->API conversion:** Every route handler calls `toCamelCase()` on Kysely results.
- **JSON Schema validation** at API boundary. The backend receives `{ passed: boolean }` — minimal payload.
- **Frontend-side evaluation:** Questions and correct answers are hardcoded in `SkillFloorCheck.tsx`. The frontend evaluates answers and sends only the pass/fail result. This is appropriate for a low-stakes fit check.
- **State management:** Form state uses React `useState` only. NOT Zustand, NOT TanStack Query.
- **DI-compliant `db` injection** via plugin options (matches onboarding.ts pattern).
- **No `@/` import aliases** — relative paths within apps.
- **Named exports only** — no default exports.
- **No `any` type** — including test files.
- **`readonly` on function params** and interface fields for shared data.

### Database Schema Changes

**New columns on `users` table (migration 003):**

| Column | Type | Nullable | Notes |
|---|---|---|---|
| `skill_floor_passed` | `boolean` | Yes | `null` = not taken, `true` = passed, `false` = failed |
| `skill_floor_completed_at` | `timestamptz` | Yes | Set to `now()` on assessment completion. `NULL` = not taken. |

- Column names are `snake_case` per naming convention
- Both nullable — users who skip assessment (experience >= 1 year) and existing records remain unaffected
- No new tables — assessment result lives on the `users` row (architecture: no separate `assessment_results` table)
- User ID remains Firebase UID (text PK)

### API Endpoints

| Method | Path | Request Body | Response | Notes |
|---|---|---|---|---|
| `POST` | `/api/account/skill-assessment` | `{ passed: boolean }` | `UserProfile` (200) or `{ error }` (400) | Updates user with assessment result. Requires onboarding complete. |

Existing endpoints unchanged (no code modifications needed):
- `GET /api/account/profile` — automatically returns `skillFloorPassed` and `skillFloorCompletedAt` after migration because `profile.ts` uses `selectAll()` + `toCamelCase()`. Do NOT modify `profile.ts`.
- `POST /api/account/onboarding` — unchanged

### Assessment Content

**3 Go code comprehension questions** (hardcoded in `SkillFloorCheck.tsx`):

1. **Loop counting** — `count()` function iterating strings, counting matches. Answer: 3
2. **Filter + transform** — `transform()` filtering even numbers, squaring them. Answer: [4, 16]
3. **Map aggregation** — `summarize()` summing map values above threshold. Answer: 35

**Design principles (all mandatory):**
- Questions test code **reading**, not writing
- Go syntax present but questions test logical comprehension, not language knowledge
- No timer, no score display, no "test" framing — positioned as "fit check"
- Pass threshold: 2/3 correct (generous — catches clearly wrong-fit, not borderline)
- Fail screen never uses: "failed," "incorrect," "wrong," "sorry"

### UX Specifications

- **Framing text:** Title "Let's make sure this is the right fit" (per UX spec Flow 5 "fit check" positioning), subtitle "Read the Go snippets below and pick the best answer for each." (`text-muted-foreground`)
- **No "test" or "exam" language** — this is a "fit check"
- **All 3 questions visible simultaneously** — no pagination, no stepper
- **Code blocks:** `font-mono bg-muted rounded-md p-4` styling
- **Radio buttons** via shadcn RadioGroup (Radix primitives provide WCAG 2.1 AA keyboard/ARIA)
- **Submit button:** "Continue" (`default` variant, primary green). ONE primary per screen.
- **Error display:** Below submit button, `text-muted-foreground`, no red. Message: "Couldn't save your results. Try again."
- **No form reset on failure** — preserve user's selections
- **No back button** — one-way funnel
- **No celebration, no mascot, no illustrations**
- **44px minimum touch target** on all interactive elements (`min-h-11`)

### Routing Changes

**After this story:**
- Questionnaire completion with `less-than-1` experience → show SkillFloorCheck (same page, step transition)
- Questionnaire completion with experience >= 1 year → `/overview` (skip assessment)
- Assessment pass → `/overview`
- Assessment fail → `/not-ready` (placeholder until Story 2.5)
- Returning user needing assessment → `/onboarding` (shows assessment directly, skips questionnaire)
- Failed user revisiting any route → `/not-ready`
- Non-failed user visiting `/not-ready` → `/overview`

**New route:**
- `/not-ready` — placeholder page inside ProtectedRoute (Story 2.5 implements full graceful redirect)

### Previous Story Intelligence (Stories 2.1-2.3)

**Key patterns to follow:**
- Firebase client SDK: `auth.currentUser` for email/displayName/uid
- `useAuth()` hook is read-only state observer — do NOT modify
- `apiFetch<T>()` in `apps/webapp/src/lib/api-fetch.ts` auto-injects Firebase Bearer token
- `MemoryRouter` from `'react-router'` (not `react-router-dom`) for test routing
- After `shadcn add`, fix `@/lib/utils` → `../../lib/utils` if needed
- Button name queries in tests: use regex `/^Continue$/` to avoid substring collisions
- Test pattern: `vi.mock()` at top-level, then dynamic import
- `afterEach(() => vi.restoreAllMocks())` always
- `fireEvent.pointerDown` to open Radix Select/RadioGroup in jsdom tests (not `userEvent.click`)
- Radix UI needs `beforeAll` polyfills: `ResizeObserver`, `scrollIntoView`, `hasPointerCapture`, `setPointerCapture`, `releasePointerCapture`
- DB test cleanup: `where('id', 'like', 'test-%')` pattern
- Logging: `request.log.info()` AFTER DB operation succeeds (Story 2.3 review fix H1)
- Typed enum arrays: declare with domain type annotation for compile-time safety (Story 2.3 review fix H3)

**Files from Story 2.3 to reference (do not modify unless specified):**
- `apps/webapp/src/routes/Onboarding.tsx` — **MODIFY in this story** (add step management)
- `apps/backend/src/plugins/account/onboarding.ts` — reference for route pattern (do NOT modify)
- `apps/backend/src/plugins/account/profile.ts` — response now includes new fields via migration (do NOT modify)
- `apps/webapp/src/hooks/use-onboarding-status.ts` — **MODIFY in this story**
- `apps/webapp/src/components/common/ProtectedRoute.tsx` — **MODIFY in this story**

### Design System

- **Tailwind v4** with CSS-based config. Tokens in `packages/config/tailwind-tokens.css`.
- **Key tokens:** `bg-background` (page), `bg-card` (form card), `bg-muted` (code blocks, skeletons), `text-foreground` (primary text), `text-muted-foreground` (errors/secondary), `ring` (focus = green/primary).
- **Fonts:** Inter (UI) + JetBrains Mono (code — use for Go snippets), `font-display: optional` in webapp.
- **`cn()` utility:** `@mycscompanion/ui/src/lib/utils.ts` (clsx + tailwind-merge).
- **shadcn components import pattern:**
  ```typescript
  import { RadioGroup, RadioGroupItem } from '@mycscompanion/ui/src/components/ui/radio-group'
  import { Label } from '@mycscompanion/ui/src/components/ui/label'
  import { Button } from '@mycscompanion/ui/src/components/ui/button'
  import { Card, CardContent, CardHeader, CardTitle } from '@mycscompanion/ui/src/components/ui/card'
  ```

### Project Structure Notes

**New files to create:**
- `apps/backend/migrations/003_add_skill_assessment.ts` — adds assessment columns to users table
- `apps/backend/src/plugins/account/skill-assessment.ts` — POST /api/account/skill-assessment route
- `apps/webapp/src/components/onboarding/SkillFloorCheck.tsx` — assessment component
- `apps/webapp/src/components/onboarding/SkillFloorCheck.test.tsx` — component tests

**Files to modify:**
- `packages/shared/src/types/api.ts` — add `SkillAssessmentRequest`, update `UserProfile`
- `apps/backend/src/plugins/account/index.ts` — register skill-assessment routes
- `apps/backend/src/plugins/account/account.test.ts` — add assessment tests
- `apps/webapp/src/routes/Onboarding.tsx` — add step detection and assessment flow
- `apps/webapp/src/routes/Onboarding.test.tsx` — add assessment step tests
- `apps/webapp/src/hooks/use-onboarding-status.ts` — add `assessmentFailed` return value
- `apps/webapp/src/hooks/use-onboarding-status.test.ts` — add assessment status tests
- `apps/webapp/src/components/common/ProtectedRoute.tsx` — update OnboardingGate
- `apps/webapp/src/components/common/ProtectedRoute.test.tsx` — add assessment gate tests
- `apps/webapp/src/App.tsx` — add /not-ready placeholder route

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 2.4: Skill Floor Assessment] — BDD acceptance criteria, FR29/FR30 requirement IDs
- [Source: _bmad-output/planning-artifacts/prd.md#FR29-FR30] — Skill floor detection and code comprehension check requirements
- [Source: _bmad-output/planning-artifacts/prd.md#Taylor "The Wrong Fit"] — User journey: framing, tone, question style, graceful redirect
- [Source: _bmad-output/planning-artifacts/architecture.md#Frontend Routes] — /onboarding route, ProtectedRoute guard
- [Source: _bmad-output/planning-artifacts/architecture.md#Component Structure] — SkillFloorCheck.tsx location in components/onboarding/
- [Source: _bmad-output/planning-artifacts/architecture.md#Account Plugin] — POST /api/account endpoint patterns
- [Source: _bmad-output/planning-artifacts/architecture.md#Database Schema] — users table, column naming
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Flow 5: Skill Floor Check] — Full flowchart, design principles, entry condition
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Skill Floor Check] — RadioGroup, 2-3 questions, "Continue" button, no score display
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Emotional Journey] — "Respected and guided" target emotion, no rejection language
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Form Patterns] — No asterisks, error below action, no form reset on failure
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Tone Patterns] — "Respect at boundaries", product never makes user feel bad
- [Source: _bmad-output/project-context.md] — All project rules, anti-patterns, naming conventions
- [Source: _bmad-output/implementation-artifacts/2-3-background-questionnaire-and-user-profile.md] — Previous story patterns, code patterns, debug log

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

- RadioGroup "uncontrolled to controlled" warning: Cosmetic React 19 + Radix UI warning when value transitions from `undefined` to string on first selection. Component works correctly. Not a bug.
- Pre-existing lint error in `apps/webapp/src/lib/firebase.test.ts:24` (consistent-type-imports) — not from this story's changes.

### Completion Notes List

- Task 1: Added `skillFloorPassed`, `skillFloorCompletedAt` fields to `UserProfile` and new `SkillAssessmentRequest` interface in shared types. Exports chain verified.
- Task 2: Created migration 003 adding `skill_floor_passed` (boolean) and `skill_floor_completed_at` (timestamptz) nullable columns to users table. Migration ran successfully, `kysely-codegen` types regenerated.
- Task 3: Installed shadcn RadioGroup component. Fixed import path `src/lib/utils` → `../../lib/utils`. No separate `@radix-ui/react-radio-group` package installed (bundled `radix-ui` used).
- Task 4: Created `skill-assessment.ts` route with JSON Schema validation, DI-compliant db injection, onboarding check via WHERE clause, `toCamelCase()` response, structured logging. Registered in account plugin.
- Task 5: Created `SkillFloorCheck.tsx` with 3 Go code comprehension questions, RadioGroup UI, front-end evaluation, `{ passed: boolean }` API call. Dark-first design, no test framing, all 3 questions visible, 44px touch targets.
- Task 6: Updated `Onboarding.tsx` with step detection (`loading`/`questionnaire`/`assessment`), profile-based flow routing, experience-level check after questionnaire submit, assessment completion handler, and loading skeleton.
- Task 7: Updated `useOnboardingStatus` hook with `assessmentFailed` state. Complete logic: onboarding check → experience level check → assessment completion/pass status.
- Task 8: Updated `OnboardingGate` in `ProtectedRoute.tsx` with assessment gate: failed → `/not-ready`, non-failed blocked from `/not-ready`.
- Task 9: Added `NotReadyPlaceholder` component and `/not-ready` route in `App.tsx` using design tokens.
- Task 10: Added 11 backend tests: 9 for POST /api/account/skill-assessment (pass, fail, onboarding required, no user, camelCase, schema validation, auth, idempotent) + 2 for GET profile skill assessment fields. All 48 backend tests pass.
- Task 11: Created 9 SkillFloorCheck component tests. Updated Onboarding tests (12 total, 5 new assessment-related). Updated use-onboarding-status tests (9 total, 3 new). Updated ProtectedRoute tests (12 total, 3 new assessment gate). All 98 webapp tests pass.

### Change Log

- 2026-03-01: Implemented Story 2.4 Skill Floor Assessment — database migration, backend endpoint, SkillFloorCheck component, onboarding flow integration, routing gates, and comprehensive test coverage.
- 2026-03-01: Code review fixes — H1: Added non-404 error fallback in Onboarding.tsx detectStep (user was stuck on loading skeleton on network errors). M1: Fixed RadioGroup uncontrolled-to-controlled React warning by using empty string instead of undefined. M2: Added test for detectStep non-404 error path. All 99 webapp tests pass, 0 RadioGroup warnings.

### File List

**New files:**
- apps/backend/migrations/003_add_skill_assessment.ts
- apps/backend/src/plugins/account/skill-assessment.ts
- apps/webapp/src/components/onboarding/SkillFloorCheck.tsx
- apps/webapp/src/components/onboarding/SkillFloorCheck.test.tsx
- packages/ui/src/components/ui/radio-group.tsx (generated by shadcn)

**Modified files:**
- packages/shared/src/types/api.ts
- apps/backend/src/plugins/account/index.ts
- apps/backend/src/plugins/account/account.test.ts
- apps/webapp/src/routes/Onboarding.tsx
- apps/webapp/src/routes/Onboarding.test.tsx
- apps/webapp/src/hooks/use-onboarding-status.ts
- apps/webapp/src/hooks/use-onboarding-status.test.ts
- apps/webapp/src/components/common/ProtectedRoute.tsx
- apps/webapp/src/components/common/ProtectedRoute.test.tsx
- apps/webapp/src/App.tsx
- _bmad-output/implementation-artifacts/sprint-status.yaml
