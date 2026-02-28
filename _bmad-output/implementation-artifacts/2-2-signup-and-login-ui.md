# Story 2.2: Signup & Login UI

Status: done

<!-- When this story contradicts project-context.md, project-context.md is authoritative. -->

## Story

As a **visitor**,
I want to sign up or log in with email/password or GitHub,
So that I can access the learning platform.

## Acceptance Criteria

1. **Given** an unauthenticated visitor navigates to the app **When** they reach the auth page **Then** they see a login form with email/password fields and a "Sign in with GitHub" button.
2. **And** a "Create account" option switches to signup mode with email, password, and confirm password fields.
3. **And** form validation provides inline error feedback for invalid email, weak password, or mismatched confirmation.
4. **And** the page uses dark-first color system with green accent for primary action only (UX-9).
5. **And** typography uses Inter for UI text with `font-display: optional` (UX-10).
6. **And** all interactive elements meet 44x44px minimum touch targets (UX-17).
7. **And** the layout is responsive: full experience at >=1280px, adapted at 1024-1279px, functional at <768px (UX-14).
8. **And** all form fields and buttons are keyboard-accessible with visible focus indicators (NFR-A1, NFR-A2).
9. **And** on successful signup, new users are redirected to the onboarding questionnaire.
10. **And** on successful login, returning users are redirected to the workspace (overview).

## Tasks / Subtasks

- [x] Task 1: Install and configure shadcn/ui components in `packages/ui/` (AC: #1, #2, #4)
  - [x] 1.1 Initialize shadcn/ui in `packages/ui/` for Tailwind v4:
    - Run from monorepo root with `--cwd` flag:
      ```bash
      pnpm dlx shadcn@latest init --cwd ./packages/ui
      ```
    - Configure `components.json`:
      - `tailwind.config`: `""` (empty string — Tailwind v4 has no config file)
      - `tailwind.css`: `"src/globals.css"`
      - `rsc`: `false` (Vite, not Next.js)
      - `aliases.utils`: path to `src/lib/utils` (where `cn()` lives)
      - **Alias configuration:** The project does NOT use `@/` import aliases. Configure aliases to use relative paths or the package name. The generated components will use `@/lib/utils` internally — after init, verify all generated component imports resolve correctly, and fix if needed to use relative paths (e.g., `../lib/utils`).
    - shadcn init will add peer dependencies to `packages/ui/package.json`: `@radix-ui/*`, `lucide-react`, `class-variance-authority`, `tw-animate-css`. This is expected.
  - [x] 1.2 Install required shadcn/ui components:
    ```bash
    pnpm dlx shadcn@latest add button input label card separator --cwd ./packages/ui
    ```
    - `Button` — primary (green bg), outline (secondary), ghost (tertiary) variants
    - `Input` — text inputs with focus ring using `--ring` (green)
    - `Label` — form field labels
    - `Card` — auth form container with `--card` background
    - `Separator` — divider between email and OAuth sections
    - shadcn generates **kebab-case filenames** in a `ui/` subdirectory: `src/components/ui/button.tsx`, `src/components/ui/input.tsx`, etc.
  - [x] 1.3 **CRITICAL — Add `@source` directive for Tailwind v4 monorepo scanning:**
    Tailwind v4 does NOT automatically detect utility classes from files outside the CSS entry directory. Since shadcn components live in `packages/ui/` but CSS is consumed by `apps/webapp/`, add this directive to `packages/ui/src/globals.css` immediately after `@import 'tailwindcss'`:
    ```css
    @import 'tailwindcss';
    @source "../../../packages/ui/src/**/*.{ts,tsx}";
    @import '@mycscompanion/config/tailwind-tokens.css';
    ```
    **Without this, all shadcn components will render completely unstyled.** (See shadcn GitHub #6878.)
    Note: The relative path is from `packages/ui/src/globals.css` perspective as consumed by the webapp — verify the exact path resolves correctly at build time. It may need to be `"../../packages/ui/src/**/*.{ts,tsx}"` depending on how Vite resolves the import chain.
  - [x] 1.4 Verify components render with correct design tokens — green primary, dark backgrounds, all oklch values rendering properly. If components appear unstyled, the `@source` path is wrong.
  - [x] 1.5 Do NOT create a barrel `index.ts` — import each component individually per project convention:
    ```typescript
    import { Button } from '@mycscompanion/ui/src/components/ui/button'
    import { Input } from '@mycscompanion/ui/src/components/ui/input'
    import { Label } from '@mycscompanion/ui/src/components/ui/label'
    import { Card, CardContent, CardHeader, CardTitle } from '@mycscompanion/ui/src/components/ui/card'
    import { Separator } from '@mycscompanion/ui/src/components/ui/separator'
    ```
  - [x] 1.6 Install `@testing-library/user-event` for realistic form interaction tests:
    ```bash
    pnpm --filter webapp add -D @testing-library/user-event
    ```

- [x] Task 2: Create Firebase auth action functions (AC: #1, #9, #10)
  - [x] 2.1 Add auth action functions to `apps/webapp/src/lib/firebase.ts`:
    ```typescript
    import {
      signInWithEmailAndPassword,
      createUserWithEmailAndPassword,
      signInWithPopup,
      signOut as firebaseSignOut,
      getAdditionalUserInfo,
      type UserCredential,
    } from 'firebase/auth'
    import { FirebaseError } from 'firebase/app'
    ```
  - [x] 2.2 Implement `signInWithEmail(email: string, password: string): Promise<UserCredential>`:
    - Calls `signInWithEmailAndPassword(auth, email, password)`
    - Returns the `UserCredential` directly — caller handles routing
    - Let Firebase errors propagate (handled by UI error mapping in Task 4)
  - [x] 2.3 Implement `signUpWithEmail(email: string, password: string): Promise<UserCredential>`:
    - Calls `createUserWithEmailAndPassword(auth, email, password)`
    - Returns the `UserCredential` — `additionalUserInfo?.isNewUser` will be `true`
  - [x] 2.4 Implement `signInWithGithub(): Promise<{ credential: UserCredential; isNewUser: boolean }>`:
    - Calls `signInWithPopup(auth, githubProvider)`
    - Extracts `getAdditionalUserInfo(result)?.isNewUser ?? true` to determine new vs returning
    - Returns both `credential` and `isNewUser` flag for routing decision
    - Handle popup blocked scenario — Firebase throws `auth/popup-blocked`
  - [x] 2.5 Implement `signOut(): Promise<void>`:
    - Calls `firebaseSignOut(auth)`
  - [x] 2.6 Create `mapFirebaseError(error: unknown): string` utility:
    - Use `FirebaseError` from `firebase/app` for type-safe error code access:
      ```typescript
      function mapFirebaseError(error: unknown): string {
        if (error instanceof FirebaseError) {
          switch (error.code) { /* ... */ }
        }
        return 'Something went wrong. Try again.'
      }
      ```
    - Maps Firebase error codes to user-friendly messages following UX retry template:
      - `auth/invalid-credential` → "Incorrect email or password. Try again." **(PRIMARY — this is the code you'll actually see for wrong email/password due to Firebase email enumeration protection, enabled by default since Sep 2023)**
      - `auth/user-not-found` → "Incorrect email or password. Try again." (legacy fallback — same message as invalid-credential; this code is suppressed on new Firebase projects but kept as defensive handling)
      - `auth/wrong-password` → "Incorrect email or password. Try again." (legacy fallback — same as above)
      - `auth/email-already-in-use` → "An account with this email already exists. Try signing in."
      - `auth/weak-password` → "Password is too weak. Use at least 6 characters."
      - `auth/invalid-email` → "Please enter a valid email address."
      - `auth/too-many-requests` → "Too many attempts. Please try again later."
      - `auth/popup-blocked` → "Popup was blocked. Please allow popups for this site and try again."
      - `auth/popup-closed-by-user` → return `null` (not an error — user intentionally cancelled; caller should check for `null` and skip error display)
      - `auth/account-exists-with-different-credential` → "An account already exists with this email using a different sign-in method."
      - Default → "Something went wrong. Try again."
    - Uses UX spec format: "[What happened]. [What to do]."
    - Contractions intentional per UX spec ("Couldn't", "wasn't")
    - Return type should be `string | null` to handle `popup-closed-by-user` gracefully
  - [x] 2.7 All functions use named exports only — no default exports

- [x] Task 3: Create SignIn page component (AC: #1, #3, #4, #5, #6, #7, #8, #10)
  - [x] 3.1 Create `apps/webapp/src/routes/SignIn.tsx`:
    - Replace the `SignInPlaceholder` in `App.tsx`
    - Full-page centered layout with Card containing the sign-in form
    - Dark background (`bg-background`), card uses `bg-card`
  - [x] 3.2 Form layout:
    - App logo/name "mycscompanion" at top (h1 weight 600, text-h2 size)
    - Email input field with Label
    - Password input field with Label (type="password")
    - Primary "Sign in" Button (green, `default` variant) — ONE primary per screen
    - Separator with "or" text between email form and OAuth
    - "Sign in with GitHub" Button (`outline` variant — secondary action)
    - Link at bottom: "Don't have an account? Create account" → navigates to `/sign-up`
  - [x] 3.3 Form state management (use React `useState` — no Zustand for form state):
    - `email: string`, `password: string` — controlled inputs
    - `error: string | null` — Firebase error message displayed inline below form
    - `loading: boolean` — disables form during auth
    - `githubLoading: boolean` — separate loading state for GitHub button
  - [x] 3.4 Form submission:
    - On submit: set `loading: true`, clear error, call `signInWithEmail(email, password)`
    - On success: `navigate('/overview', { replace: true })` — returning users go to overview
    - On error: display mapped error message below the form action
    - On finally: set `loading: false`
  - [x] 3.5 GitHub OAuth:
    - On click: set `githubLoading: true`, call `signInWithGithub()`
    - On success with `isNewUser === true`: `navigate('/onboarding', { replace: true })`
    - On success with `isNewUser === false`: `navigate('/overview', { replace: true })`
    - If `mapFirebaseError` returns `null` (popup-closed-by-user) — silently ignore
    - On error: display mapped error message if non-null
  - [x] 3.6 If user is already authenticated (from `useAuth()`), redirect to `/overview` immediately
  - [x] 3.7 Error display: error message rendered in `text-muted-foreground` below the submit button. No toasts per UX spec. No red per UX spec.
  - [x] 3.8 **Future enhancement note:** `signInWithPopup` has known issues with popup blockers (Safari, Firefox, Chrome first-click). For MVP, the error message is sufficient. A future story could add automatic fallback to `signInWithRedirect` for improved resilience.

- [x] Task 4: Create SignUp page component (AC: #2, #3, #4, #5, #6, #7, #8, #9)
  - [x] 4.1 Create `apps/webapp/src/routes/SignUp.tsx`:
    - Replace the `SignUpPlaceholder` in `App.tsx`
    - Same centered Card layout as SignIn for visual consistency
  - [x] 4.2 Form layout:
    - App logo/name "mycscompanion" at top
    - Email input field with Label
    - Password input field with Label (type="password")
    - Confirm password input field with Label (type="password")
    - Primary "Create account" Button (green, `default` variant)
    - Separator with "or" text
    - "Sign up with GitHub" Button (`outline` variant)
    - Link at bottom: "Already have an account? Sign in" → navigates to `/sign-in`
  - [x] 4.3 Client-side validation (inline error feedback per AC #3):
    - Email: validate on blur — check format with basic regex `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`
    - Password: validate on blur — minimum 8 characters (stricter than Firebase's 6 to encourage stronger passwords; Firebase will enforce its own minimum regardless)
    - Confirm password: validate on blur — must match password field
    - Display validation errors directly below the relevant input field in `text-muted-foreground text-body-sm`
    - Clear field-level errors when user starts typing in that field
    - Do NOT submit if any client-side validation errors exist
  - [x] 4.4 Form submission:
    - On submit: set `loading: true`, clear errors, call `signUpWithEmail(email, password)`
    - On success: `navigate('/onboarding', { replace: true })` — new users always go to onboarding
    - On error: display mapped Firebase error message below form
  - [x] 4.5 GitHub OAuth: same as SignIn Task 3.5 (new users → onboarding, existing → overview)
  - [x] 4.6 If user is already authenticated, redirect to `/overview` immediately

- [x] Task 5: Update App.tsx routing (AC: #9, #10)
  - [x] 5.1 Replace placeholder components with real route components:
    ```typescript
    import { SignIn } from './routes/SignIn'
    import { SignUp } from './routes/SignUp'
    ```
  - [x] 5.2 Remove inline placeholder function components for sign-in and sign-up
  - [x] 5.3 Keep other placeholders (Onboarding, Overview) — they're implemented in later stories
  - [x] 5.4 Route structure remains:
    - `/sign-in` → `<SignIn />` (public)
    - `/sign-up` → `<SignUp />` (public)
    - Protected routes unchanged

- [x] Task 6: Responsive layout and accessibility (AC: #4, #5, #6, #7, #8)
  - [x] 6.1 Responsive breakpoints:
    - **>=1280px (Desktop):** Centered Card max-width ~400px, generous padding
    - **1024-1279px (Small desktop):** Same as desktop (auth page doesn't change)
    - **<768px (Mobile):** Card fills width with horizontal padding, stack remains vertical
    - Auth pages are simple single-column forms — responsive behavior is straightforward
  - [x] 6.2 Touch targets:
    - All buttons: `min-h-11` (44px) — use shadcn Button which respects this
    - All inputs: `min-h-11` (44px) — use shadcn Input which respects this
    - Links ("Create account", "Sign in"): ensure `py-2` minimum for 44px hit area
  - [x] 6.3 Keyboard accessibility:
    - Tab order: email → password → (confirm password on signup) → submit → GitHub → create/sign-in link
    - `Enter` on form submits (native form behavior)
    - Visible focus rings on all interactive elements (shadcn uses `--ring` which is our green)
    - No focus trapping — standard page navigation
  - [x] 6.4 ARIA:
    - Form inputs associated with Labels via `htmlFor`/`id` pairs
    - Error messages associated with inputs via `aria-describedby`
    - `aria-invalid="true"` on inputs with validation errors
    - Loading buttons: `aria-disabled="true"` during submission
    - GitHub sign-in/sign-up: full text label (not just an icon)
  - [x] 6.5 Color contrast verification:
    - `foreground` on `background`: ensure 7:1 ratio (WCAG AAA)
    - `primary` on `background`: ensure 4.5:1 ratio (WCAG AA)
    - `muted-foreground` on `background`: ensure 4.5:1 ratio (WCAG AA)

- [x] Task 7: Write tests (AC: all)
  - [x] 7.1 Create `apps/webapp/src/lib/firebase.test.ts`:
    - Test `signInWithEmail` calls Firebase `signInWithEmailAndPassword`
    - Test `signUpWithEmail` calls Firebase `createUserWithEmailAndPassword`
    - Test `signInWithGithub` calls Firebase `signInWithPopup` and extracts `isNewUser`
    - Test `signOut` calls Firebase `signOut`
    - Test `mapFirebaseError` returns correct messages for all error codes
    - Mock Firebase auth functions with `vi.mock('firebase/auth')`
  - [x] 7.2 Create `apps/webapp/src/routes/SignIn.test.tsx`:
    - Test renders email and password inputs
    - Test renders "Sign in" primary button and "Sign in with GitHub" button
    - Test renders "Create account" link pointing to `/sign-up`
    - Test form validation prevents empty submission
    - Test successful email sign-in navigates to `/overview`
    - Test GitHub sign-in for existing user navigates to `/overview`
    - Test GitHub sign-in for new user navigates to `/onboarding`
    - Test displays error message on auth failure
    - Test redirects to `/overview` if already authenticated
    - Test loading state disables form during submission
    - Use `vi.mock` for firebase functions, `MemoryRouter` for routing
  - [x] 7.3 Create `apps/webapp/src/routes/SignUp.test.tsx`:
    - Test renders email, password, and confirm password inputs
    - Test renders "Create account" primary button and "Sign up with GitHub" button
    - Test renders "Sign in" link pointing to `/sign-in`
    - Test client-side validation: invalid email shows error
    - Test client-side validation: password too short shows error
    - Test client-side validation: mismatched passwords shows error
    - Test successful email sign-up navigates to `/onboarding`
    - Test displays Firebase error message on auth failure
    - Test redirects to `/overview` if already authenticated
  - [x] 7.4 Testing patterns (from Story 2.1):
    - Use `vi.mock()` at top-level with dynamic imports:
      ```typescript
      vi.mock('../../lib/firebase', () => ({ signInWithEmail: vi.fn(), ... }))
      ```
    - Use `@testing-library/react` for component tests: `render`, `screen`
    - Use `@testing-library/user-event` (installed in Task 1.6) for realistic form interactions — preferred over `fireEvent` for typing, clicking, and form submission
    - Use `MemoryRouter` from `react-router` for route testing
    - `afterEach(() => vi.restoreAllMocks())`
    - Test behavior, not implementation: `it('should navigate to overview on successful sign-in')`
    - No snapshot tests — explicit behavioral assertions only

## Dev Notes

### Critical Architecture Patterns

- **Pure frontend story** — no backend changes required. All auth is handled client-side by Firebase Auth SDK. Backend auth plugin (Story 2.1) validates tokens on API calls.
- **Firebase Auth SDK** is already installed in webapp (`firebase` package). Client is initialized in `apps/webapp/src/lib/firebase.ts` with `browserLocalPersistence`, `GithubAuthProvider`, and `EmailAuthProvider`.
- **`useAuth()` hook** (`apps/webapp/src/hooks/use-auth.ts`) is a read-only state observer returning `{ user: User | null, loading: boolean }`. Do NOT add auth actions to this hook — keep actions in `firebase.ts`.
- **State management:** Form state uses React `useState` only. NOT Zustand (only 2 Zustand stores allowed: `useWorkspaceUIStore`, `useEditorStore`). NOT TanStack Query (that's for server state).
- **No `@/` import aliases** — use relative paths within the webapp.
- **Named exports only** — no default exports anywhere.
- **No `any` type** — including test files. Use `Partial<T>` or mock factories.

### Design System

- **Tailwind v4** with CSS-based config (no `tailwind.config.js`). Design tokens in `packages/config/tailwind-tokens.css` — read that file for exact oklch color values.
- **Key tokens for auth pages:** `bg-background` (page), `bg-card` (form card), `text-foreground` (primary text), `text-muted-foreground` (errors/secondary), `ring` (focus = green/primary).
- **Fonts:** Inter (UI) + JetBrains Mono (code), `font-display: optional` in webapp. Declarations in `packages/ui/src/globals.css`.
- **Global CSS entry:** `main.tsx` imports `@mycscompanion/ui/src/globals.css`
- **`cn()` utility:** Available at `@mycscompanion/ui/src/lib/utils.ts` (clsx + tailwind-merge).

### shadcn/ui Component Installation

- **No components exist yet** — `packages/ui/src/components/` directory does not exist. This story creates it via `shadcn init`.
- shadcn CLI v3.x+ fully supports Tailwind v4. Auto-detects CSS-based config.
- Components go in `packages/ui/src/components/ui/` (shadcn creates a `ui/` subdirectory) — NOT in `apps/webapp/`.
- shadcn generates **kebab-case filenames**: `button.tsx`, `input.tsx`, `card.tsx`, etc. (NOT PascalCase).
- Import individually: `import { Button } from '@mycscompanion/ui/src/components/ui/button'`
- No barrel file for `@mycscompanion/ui` — tree-shaking optimization per architecture.
- **`components.json` aliases:** The project does NOT use `@/` aliases. After init, verify generated component internal imports resolve. May need to adjust alias paths to use relative imports or configure the `utils` alias to point to `src/lib/utils`.
- **`@source` directive is MANDATORY** — see Task 1.3. Without it, Tailwind v4 won't detect utility classes from `packages/ui/` when building the webapp.

### UX Specifications

- **One-primary-per-screen rule:** Only the main submit button ("Sign in" or "Create account") gets `default` variant (green). GitHub button uses `outline` variant.
- **Error messages:** Displayed inline below the action that triggered them, in `text-muted-foreground`. No toasts. No red. Follow retry template: "[What happened]. [What to do]."
- **Button disabled state:** `opacity: 0.5` + `pointer-events: none` (shadcn default). Buttons never disappear.
- **No back buttons** in the auth flow per UX navigation patterns.
- **Loading principle:** For auth submission (<500ms typical), no skeleton needed. Show disabled state on button during submission.
- **No celebration animations, no mascots, no illustrations.**

### Routing Decisions

- **Sign-up success** → `/onboarding` (always — new users need background questionnaire)
- **Sign-in success** → `/overview` (returning users go to workspace overview)
- **GitHub OAuth new user** → `/onboarding`
- **GitHub OAuth existing user** → `/overview`
- **Already authenticated** → redirect away from auth pages to `/overview`
- Detecting new vs returning for GitHub: use `getAdditionalUserInfo(result)?.isNewUser`
- Note: Story 2.3 will later enhance `ProtectedRoute` to check questionnaire completion and redirect incomplete users to `/onboarding`. For now, routing logic lives in the auth page post-success handlers.

### Previous Story Intelligence (Story 2.1)

**Key learnings from Story 2.1 implementation:**
- Firebase client SDK is `firebase` v12.x (`^12.9.0` in package.json). Modular/tree-shakeable API stable since v9 — no breaking changes through v12.
- Firebase Admin SDK is in backend only — webapp never imports `firebase-admin`
- `browserLocalPersistence` is already set — sessions survive browser restart
- Tab-focus token refresh via `visibilitychange` listener in `useAuth()` already handles FR43
- Test pattern: `vi.mock('firebase/auth', ...)` at top level, then dynamic import of the module under test
- `mock-firebase-auth.ts` in `@mycscompanion/config/test-utils/` provides `createMockFirebaseAuth()` for server-side tests — NOT needed for client-side tests (those mock `firebase/auth` directly)
- `MemoryRouter` from `react-router` (not `react-router-dom`) for test routing
- Environment variables use `import.meta.env['VITE_*']` bracket notation
- `vite.config.ts` has `envDir: '../..'` — `.env` files load from monorepo root

**Files created/modified by Story 2.1:**
- `apps/webapp/src/lib/firebase.ts` — Firebase client init (MODIFY: add auth action functions)
- `apps/webapp/src/hooks/use-auth.ts` — Auth state hook (DO NOT MODIFY)
- `apps/webapp/src/components/common/ProtectedRoute.tsx` — Auth guard (DO NOT MODIFY)
- `apps/webapp/src/App.tsx` — Routing (MODIFY: replace placeholders)
- `apps/webapp/src/lib/api-fetch.ts` — Authenticated fetch (DO NOT MODIFY)

### Project Structure Notes

- **`apps/webapp/src/routes/` directory does NOT exist yet** — create it before adding route components.
- New files follow architecture spec placement:
  - `apps/webapp/src/routes/SignIn.tsx` — route-level component
  - `apps/webapp/src/routes/SignUp.tsx` — route-level component
  - `apps/webapp/src/routes/SignIn.test.tsx` — co-located test
  - `apps/webapp/src/routes/SignUp.test.tsx` — co-located test
  - `apps/webapp/src/lib/firebase.test.ts` — co-located test for new auth functions (does not exist yet — Story 2.1 mocked firebase in consumer tests but did not create a dedicated firebase.test.ts)
- Architecture spec defines `routes/` directory for page-level components (SignIn.tsx, SignUp.tsx, Onboarding.tsx, etc.)
- Reusable form sub-components (if extracted) go in `apps/webapp/src/components/auth/` — but prefer keeping auth form logic inline in route components unless duplication is excessive.
- Component files: `PascalCase.tsx`. Utility files: `kebab-case.ts`.
- Use `useNavigate()` from `'react-router'` (NOT `react-router-dom` — v7 unified the packages) for programmatic navigation after auth success.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 2.2: Signup & Login UI] — BDD acceptance criteria, FR/NFR/UX requirement IDs
- [Source: _bmad-output/planning-artifacts/architecture.md#Authentication & Security] — Auth boundary, API authorization, token refresh flow
- [Source: _bmad-output/planning-artifacts/architecture.md#Frontend Architecture] — State management split, routing, component organization
- [Source: _bmad-output/planning-artifacts/architecture.md#API & Communication Patterns] — Fastify plugin table, error response format
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Color System] — Token mapping, color principles, no-red rule
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Typography System] — Inter font, type scale, font-display: optional
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Responsive Behavior] — Three breakpoints, mobile read-only
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Touch Targets] — 44x44px minimum
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Button Hierarchy] — 3-tier system, one-primary rule
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Retry Message Template] — Error message format
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Form Patterns] — Form principles
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Keyboard Accessibility] — Per-component keyboard mapping
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Contrast Requirements] — WCAG AA/AAA ratios
- [Source: _bmad-output/project-context.md] — All project rules, anti-patterns, naming conventions

## Dev Agent Record

### Agent Model Used
Claude Opus 4.6

### Debug Log References
- shadcn CLI `init` failed with "could not detect a supported framework" in shared package — created `components.json` manually and used `shadcn add` directly
- Generated component imports used `src/lib/utils` (non-relative) — fixed to `../../lib/utils` relative paths
- `@source` directive path: used `./components/**/*.{ts,tsx}` relative to CSS file location in `packages/ui/src/`
- Test cleanup issue: `@testing-library/react` auto-cleanup wasn't clearing DOM between tests — added explicit `cleanup()` in `afterEach`
- Button name queries: used regex `/^Sign in$/` instead of string to avoid substring matching collisions with "Sign in with GitHub"

### Completion Notes List
- Task 1: Initialized shadcn/ui with manual `components.json`, installed Button/Input/Label/Card/Separator, added `@source` directive, installed `@testing-library/user-event`
- Task 2: Added `signInWithEmail`, `signUpWithEmail`, `signInWithGithub`, `signOut`, `mapFirebaseError` to `firebase.ts`. All named exports, `string | null` return for error mapper
- Task 3: Created `SignIn.tsx` — centered Card layout, email/password form, GitHub OAuth button, error display, auth redirect
- Task 4: Created `SignUp.tsx` — same layout + confirm password, client-side validation on blur (email regex, 8-char password, match confirm), aria-invalid/aria-describedby
- Task 5: Replaced `SignInPlaceholder`/`SignUpPlaceholder` in `App.tsx` with real route components
- Task 6: Accessibility built into components — min-h-11 touch targets, htmlFor/id labels, aria attributes, keyboard navigation via native form behavior
- Task 7: 46 new tests (20 firebase, 11 SignIn, 15 SignUp), all 59 total passing. Zero regressions.

### Senior Developer Review (AI)

**Reviewer:** Claude Opus 4.6 (code-review workflow)
**Date:** 2026-02-28
**Outcome:** Approved with fixes applied

**Issues found: 8 (1 HIGH, 5 MEDIUM, 2 LOW) — all fixed**

1. **[HIGH] Missing "empty submission" test** — Task 7.2 specified this test but it was absent. Fixed: added empty-field guard in `handleSubmit` + `required` on inputs + new test.
2. **[MEDIUM] `as never` / `as Record<string, unknown>` casts in tests** — Violated "no `as` casting" rule (7 instances). Fixed: refactored firebase.test.ts to top-level mock functions pattern, used `vi.importActual<T>()`.
3. **[MEDIUM] `as HTMLInputElement` in SignIn.test.tsx** — Fixed: replaced with `.hasAttribute('disabled')`.
4. **[MEDIUM] Empty loading state** — Blank div during auth loading. Fixed: purpose-built card skeleton in both SignIn/SignUp.
5. **[MEDIUM] Missing SignUp disabled-state test** — SignIn had this test, SignUp didn't. Fixed: added equivalent test.
6. **[MEDIUM] SignIn missing `aria-describedby` for error** — Fixed: added `id="form-error"` on error `<p>` and `aria-describedby` on `<form>`.
7. **[LOW] Redundant `font-semibold`** — CardTitle already applies it; removed duplicate from h1 in both pages.
8. **[LOW] `emailProvider` export unused** — Pre-existing from Story 2.1. Not fixed (out of scope for this story).

**Post-fix test results:** 59/59 passing, typecheck clean.

## Change Log
- 2026-02-28: Story 2.2 implementation complete — signup/login UI with shadcn/ui components, Firebase auth actions, client-side validation, comprehensive test coverage
- 2026-02-28: Code review — 8 issues found and 7 fixed (1 deferred as out-of-scope). Tests 57→59. All passing.

### File List
**New files:**
- `packages/ui/components.json` — shadcn/ui configuration
- `packages/ui/src/components/ui/button.tsx` — Button component (shadcn)
- `packages/ui/src/components/ui/input.tsx` — Input component (shadcn)
- `packages/ui/src/components/ui/label.tsx` — Label component (shadcn)
- `packages/ui/src/components/ui/card.tsx` — Card component (shadcn)
- `packages/ui/src/components/ui/separator.tsx` — Separator component (shadcn)
- `apps/webapp/src/routes/SignIn.tsx` — Sign in page component
- `apps/webapp/src/routes/SignUp.tsx` — Sign up page component
- `apps/webapp/src/lib/firebase.test.ts` — Firebase auth function tests (20 tests)
- `apps/webapp/src/routes/SignIn.test.tsx` — SignIn component tests (11 tests)
- `apps/webapp/src/routes/SignUp.test.tsx` — SignUp component tests (15 tests)

**Modified files:**
- `packages/ui/src/globals.css` — Added `@source` directive for Tailwind v4 monorepo scanning
- `packages/ui/package.json` — Added radix-ui, class-variance-authority, lucide-react dependencies
- `apps/webapp/package.json` — Added @testing-library/user-event dev dependency
- `apps/webapp/src/lib/firebase.ts` — Added auth action functions and error mapper
- `apps/webapp/src/App.tsx` — Replaced sign-in/sign-up placeholders with real route components
- `pnpm-lock.yaml` — Updated lockfile
