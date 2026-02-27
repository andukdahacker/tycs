# Story 2.1: Firebase Auth Integration & Session Management

Status: ready-for-dev

<!-- When this story contradicts project-context.md, project-context.md is authoritative. -->

## Story

As a **developer**,
I want Firebase Auth configured on the client and validated on the server,
So that users can authenticate securely and their sessions persist across visits.

## Acceptance Criteria

1. **Given** the webapp is loaded **When** Firebase Auth SDK is initialized **Then** it supports email/password and GitHub OAuth sign-in methods (FR26).
2. **And** Firebase Auth is confined to `app.mycscompanion.dev` only — the landing page at `mycscompanion.dev` has no Firebase dependency (ARCH-3).
3. **And** the backend auth plugin validates Firebase ID tokens on all protected API endpoints (NFR-S6).
4. **And** the `GET /health` endpoint remains publicly accessible without authentication.
5. **And** user sessions persist across browser sessions via Firebase Auth persistence (FR27).
6. **And** sessions auto-refresh on tab focus after idle without forced logout (FR43).
7. **And** Firebase handles all credential storage, password hashing, and session tokens (NFR-S5).
8. **And** the auth middleware exposes user identity to downstream plugins, enabling per-user rate limiting in Epics 3 and 6.

## Tasks / Subtasks

- [ ] Task 1: Install Firebase dependencies (AC: #1, #3)
  - [ ] 1.1 Install Firebase Admin SDK in backend:
    ```bash
    pnpm --filter backend add firebase-admin
    ```
    - `firebase-admin` v13.x — native ESM support, compatible with `"type": "module"`
    - Do NOT install `firebase` (client SDK) in the backend

  - [ ] 1.2 Install Firebase JS SDK in webapp:
    ```bash
    pnpm --filter webapp add firebase
    ```
    - `firebase` v11.x — modular tree-shakeable API
    - Import only what you need: `firebase/app`, `firebase/auth`
    - Do NOT install `firebase-admin` in the webapp

- [ ] Task 2: Firebase Admin SDK initialization (AC: #3)
  - [ ] 2.1 Create `apps/backend/src/plugins/auth/firebase.ts`:
    ```typescript
    import { initializeApp, cert, getApps } from 'firebase-admin/app'
    import { getAuth, type Auth } from 'firebase-admin/auth'

    function initFirebaseAdmin(): Auth {
      if (getApps().length > 0) return getAuth()

      const serviceAccount = process.env['FIREBASE_SERVICE_ACCOUNT']
      if (!serviceAccount) {
        throw new Error('FIREBASE_SERVICE_ACCOUNT environment variable is required')
      }

      // Support both raw JSON string and base64-encoded JSON
      const decoded = serviceAccount.startsWith('{')
        ? serviceAccount
        : Buffer.from(serviceAccount, 'base64').toString('utf-8')

      initializeApp({ credential: cert(JSON.parse(decoded)) })
      return getAuth()
    }

    export { initFirebaseAdmin }
    export type { Auth }
    ```
    - **Why base64 support:** Railway env vars handle JSON poorly (newlines, escaping). Base64 is the standard workaround.
    - Named export only — no default export (project-context)
    - The function returns a Firebase `Auth` instance for dependency injection
    - `getApps()` guard prevents re-initialization in tests

- [ ] Task 3: Complete auth plugin — Firebase ID token verification (AC: #3, #4, #8)
  - [ ] 3.1 Update `apps/backend/src/plugins/auth/index.ts`:
    ```typescript
    import type { FastifyInstance } from 'fastify'
    import fp from 'fastify-plugin'
    import type { Auth } from 'firebase-admin/auth'
    import { initFirebaseAdmin } from './firebase.js'

    declare module 'fastify' {
      interface FastifyRequest {
        uid: string
      }
    }

    interface AuthPluginOptions {
      readonly firebaseAuth?: Auth
    }

    async function auth(fastify: FastifyInstance, opts: AuthPluginOptions): Promise<void> {
      const firebaseAuth = opts.firebaseAuth ?? initFirebaseAdmin()

      fastify.decorateRequest('uid', '')

      fastify.addHook('onRequest', async (request, reply) => {
        // Public routes — skip auth
        if (request.url === '/health' || request.url.startsWith('/health?')) return
        if (request.url.startsWith('/admin')) return // Admin routes use basic auth, not Firebase

        const authHeader = request.headers.authorization
        if (!authHeader?.startsWith('Bearer ')) {
          return reply.status(401).send({
            error: { code: 'UNAUTHORIZED', message: 'Missing or invalid authorization header' },
          })
        }

        const token = authHeader.slice(7) // Strip "Bearer "

        try {
          const decodedToken = await firebaseAuth.verifyIdToken(token)
          request.uid = decodedToken.uid
        } catch (err: unknown) {
          const message =
            err instanceof Error && err.message.includes('expired')
              ? 'Token expired'
              : 'Invalid token'

          return reply.status(401).send({
            error: { code: 'UNAUTHORIZED', message },
          })
        }
      })
    }

    export const authPlugin = fp(auth, { name: 'auth-plugin' })
    ```
    - **CRITICAL:** Plugin uses `fp()` (fastify-plugin) — hook applies globally to ALL routes
    - **Dependency injection:** `opts.firebaseAuth` allows mocking in tests (architecture mandate: "injectable for testability")
    - **Error response format:** `{ error: { code, message } }` — matches architecture API response pattern
    - **401 errors are client errors** — they go to `request.log.warn()` via the error handler, NOT Sentry
    - `reply` param added to hook signature — required to send 401 responses directly
    - Token verification errors provide minimal info (don't leak internal details)
    - The `reply.send()` with `return` prevents downstream execution on auth failure

  - [ ] 3.2 Register auth plugin with options in `apps/backend/src/app.ts`:
    ```typescript
    // Position 1: Auth (global onRequest hook — must be first)
    await fastify.register(authPlugin)
    ```
    - **No change to registration** — the auth plugin's default behavior (no opts) calls `initFirebaseAdmin()` internally
    - In test setup, pass `{ firebaseAuth: mockAuth }` to inject mock

- [ ] Task 4: Firebase client SDK initialization (AC: #1, #2, #5)
  - [ ] 4.1 Create `apps/webapp/src/lib/firebase.ts`:
    ```typescript
    import { initializeApp } from 'firebase/app'
    import {
      getAuth,
      browserLocalPersistence,
      setPersistence,
      GithubAuthProvider,
      EmailAuthProvider,
    } from 'firebase/auth'

    const firebaseConfig = {
      apiKey: import.meta.env['VITE_FIREBASE_API_KEY'],
      authDomain: import.meta.env['VITE_FIREBASE_AUTH_DOMAIN'],
      projectId: import.meta.env['VITE_FIREBASE_PROJECT_ID'],
      storageBucket: import.meta.env['VITE_FIREBASE_STORAGE_BUCKET'],
      messagingSenderId: import.meta.env['VITE_FIREBASE_MESSAGING_SENDER_ID'],
      appId: import.meta.env['VITE_FIREBASE_APP_ID'],
    }

    const app = initializeApp(firebaseConfig)
    const auth = getAuth(app)

    // FR27: Persist sessions across browser sessions
    void setPersistence(auth, browserLocalPersistence)

    const githubProvider = new GithubAuthProvider()
    const emailProvider = new EmailAuthProvider()

    export { auth, githubProvider, emailProvider }
    ```
    - **ARCH-3:** Firebase is ONLY initialized in the webapp (`app.mycscompanion.dev`). The Astro website (`mycscompanion.dev`) must NEVER import this file.
    - `browserLocalPersistence` = IndexedDB persistence. Survives browser close/reopen (FR27).
    - `void setPersistence(...)` — fire-and-forget, persistence is set before any auth operations
    - Providers exported for use by Story 2.2 (sign-in/sign-up UI)
    - **No `@/` aliases** — relative imports within the app (project-context)
    - Env vars use `VITE_` prefix — required by Vite for client-side exposure

  - [ ] 4.2 Update `apps/webapp/vite.config.ts` — set envDir to monorepo root:
    ```typescript
    import { defineConfig } from 'vite'
    import react from '@vitejs/plugin-react-swc'
    import tailwindcss from '@tailwindcss/vite'

    export default defineConfig({
      plugins: [react(), tailwindcss()],
      envDir: '../..',
    })
    ```
    - **Why:** Monorepo uses a single root `.env` file. Vite by default looks for `.env` in its project root (`apps/webapp/`). Setting `envDir: '../..'` lets Vite read `VITE_*` vars from the monorepo root `.env`.

  - [ ] 4.3 Create `apps/webapp/src/vite-env.d.ts` type augmentation (update existing file):
    ```typescript
    /// <reference types="vite/client" />

    interface ImportMetaEnv {
      readonly VITE_FIREBASE_API_KEY: string
      readonly VITE_FIREBASE_AUTH_DOMAIN: string
      readonly VITE_FIREBASE_PROJECT_ID: string
      readonly VITE_FIREBASE_STORAGE_BUCKET: string
      readonly VITE_FIREBASE_MESSAGING_SENDER_ID: string
      readonly VITE_FIREBASE_APP_ID: string
      readonly VITE_API_URL: string
    }

    interface ImportMeta {
      readonly env: ImportMetaEnv
    }
    ```
    - Provides TypeScript autocompletion for `import.meta.env` vars

- [ ] Task 5: Create apiFetch utility (AC: #3, #6)
  - [ ] 5.1 Create `apps/webapp/src/lib/api-fetch.ts`:
    ```typescript
    import { auth } from './firebase'

    const API_URL = import.meta.env['VITE_API_URL'] ?? 'http://localhost:3001'

    class ApiError extends Error {
      constructor(
        readonly status: number,
        readonly code: string,
        message: string,
      ) {
        super(message)
        this.name = 'ApiError'
      }
    }

    async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
      const user = auth.currentUser
      if (!user) {
        window.location.href = '/sign-in'
        throw new ApiError(401, 'UNAUTHORIZED', 'Not authenticated')
      }

      let token = await user.getIdToken()

      const doFetch = async (bearerToken: string): Promise<Response> => {
        return fetch(`${API_URL}${path}`, {
          ...options,
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${bearerToken}`,
            ...options.headers,
          },
        })
      }

      let response = await doFetch(token)

      // 401 → force token refresh → retry once → redirect to /sign-in
      if (response.status === 401) {
        try {
          token = await user.getIdToken(true) // force refresh
          response = await doFetch(token)
        } catch {
          window.location.href = '/sign-in'
          throw new ApiError(401, 'UNAUTHORIZED', 'Session expired')
        }

        if (response.status === 401) {
          window.location.href = '/sign-in'
          throw new ApiError(401, 'UNAUTHORIZED', 'Session expired')
        }
      }

      if (!response.ok) {
        const body = await response.json().catch(() => ({ error: {} })) as {
          error?: { code?: string; message?: string }
        }
        throw new ApiError(
          response.status,
          body.error?.code ?? 'UNKNOWN',
          body.error?.message ?? 'Request failed',
        )
      }

      return response.json() as Promise<T>
    }

    export { apiFetch, ApiError }
    ```
    - **Architecture verbatim:** "thin wrapper around fetch() — attaches Firebase Bearer token, handles 401 → force refresh → retry once → redirect to /sign-in"
    - **No Axios, no fetch wrapper library** — TanStack Query handles retries, caching, error states
    - Auth retry is SEPARATE from TanStack Query's network retry (architecture decision)
    - `ApiError` class provides typed error handling for consumers
    - **Location:** `apps/webapp/src/lib/api-fetch.ts` — NOT in `@mycscompanion/shared` (depends on Firebase client SDK)

- [ ] Task 6: Auth hook and tab-focus refresh (AC: #5, #6, #8)
  - [ ] 6.1 Create `apps/webapp/src/hooks/use-auth.ts`:
    ```typescript
    import { useState, useEffect } from 'react'
    import { onAuthStateChanged, type User } from 'firebase/auth'
    import { auth } from '../lib/firebase'

    interface AuthState {
      readonly user: User | null
      readonly loading: boolean
    }

    function useAuth(): AuthState {
      const [state, setState] = useState<AuthState>({ user: null, loading: true })

      useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
          setState({ user, loading: false })
        })
        return unsubscribe
      }, [])

      // FR43: Auto-refresh token on tab focus after idle
      useEffect(() => {
        const handleVisibilityChange = (): void => {
          if (document.visibilityState === 'visible' && auth.currentUser) {
            void auth.currentUser.getIdToken(true)
          }
        }

        document.addEventListener('visibilitychange', handleVisibilityChange)
        return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
      }, [])

      return state
    }

    export { useAuth }
    export type { AuthState }
    ```
    - `onAuthStateChanged` fires on page load with persisted session (FR27) and on sign-in/sign-out
    - `loading: true` initially — prevents flash of unauthenticated content
    - Tab focus refresh: `getIdToken(true)` forces Firebase to refresh the token proactively. This prevents 401s when the user returns to an idle tab after the 1-hour token expiry.
    - The `void` before `getIdToken` — fire-and-forget, errors handled gracefully by apiFetch's 401 retry

- [ ] Task 7: ProtectedRoute and route structure scaffolding (AC: #3, #4)
  - [ ] 7.1 Create `apps/webapp/src/components/common/ProtectedRoute.tsx`:
    ```typescript
    import { Navigate, Outlet } from 'react-router'
    import { useAuth } from '../../hooks/use-auth'

    function ProtectedRoute(): React.ReactElement {
      const { user, loading } = useAuth()

      if (loading) {
        return <AuthLoadingSkeleton />
      }

      if (!user) {
        return <Navigate to="/sign-in" replace />
      }

      return <Outlet />
    }

    function AuthLoadingSkeleton(): React.ReactElement {
      return (
        <div className="flex h-screen items-center justify-center bg-neutral-950">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-neutral-700 border-t-green-500" />
        </div>
      )
    }

    export { ProtectedRoute }
    ```
    - **Architecture:** `ProtectedRoute` wrapper checks Firebase Auth state, redirects to `/sign-in` if unauthenticated
    - `AuthLoadingSkeleton` is a purpose-built skeleton (project-context: "No generic spinners")
    - Uses dark theme colors from UX spec (bg-neutral-950, green accent)
    - `<Outlet />` renders nested child routes (React Router v7 pattern)

  - [ ] 7.2 Update `apps/webapp/src/App.tsx` — Route structure with placeholders:
    ```typescript
    import { BrowserRouter, Routes, Route, Navigate } from 'react-router'
    import { ProtectedRoute } from './components/common/ProtectedRoute'

    // Placeholder components — replaced by real implementations in Stories 2.2-2.5, 3.5+
    function SignInPlaceholder(): React.ReactElement {
      return <div className="flex h-screen items-center justify-center bg-neutral-950 text-neutral-400">Sign In (Story 2.2)</div>
    }
    function SignUpPlaceholder(): React.ReactElement {
      return <div className="flex h-screen items-center justify-center bg-neutral-950 text-neutral-400">Sign Up (Story 2.2)</div>
    }
    function OnboardingPlaceholder(): React.ReactElement {
      return <div className="flex h-screen items-center justify-center bg-neutral-950 text-neutral-400">Onboarding (Story 2.3)</div>
    }
    function OverviewPlaceholder(): React.ReactElement {
      return <div className="flex h-screen items-center justify-center bg-neutral-950 text-neutral-400">Overview (Story 4+)</div>
    }

    function App(): React.ReactElement {
      return (
        <BrowserRouter>
          <Routes>
            {/* Public routes */}
            <Route path="/sign-in" element={<SignInPlaceholder />} />
            <Route path="/sign-up" element={<SignUpPlaceholder />} />

            {/* Protected routes */}
            <Route element={<ProtectedRoute />}>
              <Route path="/onboarding" element={<OnboardingPlaceholder />} />
              <Route path="/overview" element={<OverviewPlaceholder />} />
              <Route path="/" element={<Navigate to="/overview" replace />} />
            </Route>
          </Routes>
        </BrowserRouter>
      )
    }

    export { App }
    ```
    - **Architecture routes:** `/sign-in`, `/sign-up` (public), `/onboarding`, `/overview`, `/workspace/:milestoneId`, `/completion/:milestoneId` (protected)
    - Only routes relevant to Epic 2 scaffolded now. Workspace/completion routes added in Epic 3+.
    - Placeholder components are intentional — Story 2.2+ replaces them with real implementations
    - Named export only (no `export default`)

- [ ] Task 8: Update environment variable configuration (AC: #1, #3)
  - [ ] 8.1 Update root `.env.example` — add Firebase client vars with VITE_ prefix:
    ```bash
    # --- Firebase Client (Story 2.1) ---
    # Get these from Firebase Console → Project Settings → Your Apps → Web App
    VITE_FIREBASE_API_KEY=
    VITE_FIREBASE_AUTH_DOMAIN=
    VITE_FIREBASE_PROJECT_ID=
    VITE_FIREBASE_STORAGE_BUCKET=
    VITE_FIREBASE_MESSAGING_SENDER_ID=
    VITE_FIREBASE_APP_ID=

    # --- Webapp (Story 2.1) ---
    VITE_API_URL=http://localhost:3001
    ```
    - **KEEP existing `FIREBASE_SERVICE_ACCOUNT=` var** — it's for the backend
    - **REMOVE or REPLACE `MCC_FIREBASE_CONFIG=`** — individual VITE_ vars replace it
    - `VITE_` prefix is mandatory — Vite only exposes prefixed vars to the client bundle
    - These are PUBLIC keys (safe to expose in client-side code). Firebase security is enforced by backend token verification + Firebase Security Rules.

  - [ ] 8.2 Update root `.env` (local dev) with actual Firebase project values:
    - User must create a Firebase project and web app in Firebase Console
    - Enable Email/Password and GitHub authentication providers
    - Copy web app config values to `.env`
    - Generate a service account key and base64-encode it for `FIREBASE_SERVICE_ACCOUNT`

- [ ] Task 9: Add Firebase mock factory to test utilities (AC: #3)
  - [ ] 9.1 Create `packages/config/test-utils/mock-firebase-auth.ts`:
    ```typescript
    import type { Mock } from 'vitest'
    import { vi } from 'vitest'

    interface MockDecodedToken {
      readonly uid: string
      readonly email: string
      readonly name?: string
    }

    interface MockFirebaseAuth {
      verifyIdToken: Mock<(token: string) => Promise<MockDecodedToken>>
    }

    function createMockFirebaseAuth(defaultUid?: string): MockFirebaseAuth {
      const uid = defaultUid ?? 'test-user-uid'
      return {
        verifyIdToken: vi.fn(async () => ({
          uid,
          email: `${uid}@test.com`,
          name: 'Test User',
        })),
      }
    }

    export { createMockFirebaseAuth }
    export type { MockFirebaseAuth, MockDecodedToken }
    ```
    - **Architecture test pattern:** "Mock `verifyIdToken()` to return test uid"
    - Canonical mock — import from `@mycscompanion/config/test-utils/`, never create ad-hoc mocks
    - `defaultUid` param allows per-test customization
    - Returns typed mock matching Firebase Admin `Auth` interface (partial)

  - [ ] 9.2 Update `packages/config/test-utils/index.ts` — export new mock:
    ```typescript
    export { createMockFirebaseAuth } from './mock-firebase-auth.js'
    export type { MockFirebaseAuth, MockDecodedToken } from './mock-firebase-auth.js'
    ```

- [ ] Task 10: Backend auth plugin tests (AC: #3, #4)
  - [ ] 10.1 Create `apps/backend/src/plugins/auth/auth.test.ts`:
    ```typescript
    import { describe, it, expect, vi, afterEach } from 'vitest'
    import Fastify from 'fastify'
    import { authPlugin } from './index.js'
    import { createMockFirebaseAuth } from '@mycscompanion/config/test-utils'

    describe('AuthPlugin', () => {
      afterEach(() => {
        vi.restoreAllMocks()
      })

      describe('token verification', () => {
        it('should set request.uid when valid token is provided', async () => {
          const mockAuth = createMockFirebaseAuth('user-123')
          const app = Fastify()
          await app.register(authPlugin, { firebaseAuth: mockAuth as any })
          app.get('/test', async (request) => ({ uid: request.uid }))

          const response = await app.inject({
            method: 'GET',
            url: '/test',
            headers: { authorization: 'Bearer valid-token' },
          })

          expect(response.statusCode).toBe(200)
          expect(response.json()).toEqual({ uid: 'user-123' })
          expect(mockAuth.verifyIdToken).toHaveBeenCalledWith('valid-token')
        })

        it('should return 401 when no authorization header is provided', async () => {
          const mockAuth = createMockFirebaseAuth()
          const app = Fastify()
          await app.register(authPlugin, { firebaseAuth: mockAuth as any })
          app.get('/test', async () => ({ ok: true }))

          const response = await app.inject({ method: 'GET', url: '/test' })

          expect(response.statusCode).toBe(401)
          expect(response.json()).toEqual({
            error: { code: 'UNAUTHORIZED', message: 'Missing or invalid authorization header' },
          })
        })

        it('should return 401 when token verification fails', async () => {
          const mockAuth = createMockFirebaseAuth()
          mockAuth.verifyIdToken.mockRejectedValueOnce(new Error('Token is invalid'))
          const app = Fastify()
          await app.register(authPlugin, { firebaseAuth: mockAuth as any })
          app.get('/test', async () => ({ ok: true }))

          const response = await app.inject({
            method: 'GET',
            url: '/test',
            headers: { authorization: 'Bearer bad-token' },
          })

          expect(response.statusCode).toBe(401)
          expect(response.json().error.code).toBe('UNAUTHORIZED')
        })

        it('should return 401 when token is expired', async () => {
          const mockAuth = createMockFirebaseAuth()
          mockAuth.verifyIdToken.mockRejectedValueOnce(
            new Error('Firebase ID token has expired')
          )
          const app = Fastify()
          await app.register(authPlugin, { firebaseAuth: mockAuth as any })
          app.get('/test', async () => ({ ok: true }))

          const response = await app.inject({
            method: 'GET',
            url: '/test',
            headers: { authorization: 'Bearer expired-token' },
          })

          expect(response.statusCode).toBe(401)
          expect(response.json().error.message).toBe('Token expired')
        })
      })

      describe('public route exemptions', () => {
        it('should allow /health without authentication', async () => {
          const mockAuth = createMockFirebaseAuth()
          const app = Fastify()
          await app.register(authPlugin, { firebaseAuth: mockAuth as any })
          app.get('/health', async () => ({ status: 'ok' }))

          const response = await app.inject({ method: 'GET', url: '/health' })

          expect(response.statusCode).toBe(200)
          expect(mockAuth.verifyIdToken).not.toHaveBeenCalled()
        })

        it('should allow /admin routes without Firebase auth', async () => {
          const mockAuth = createMockFirebaseAuth()
          const app = Fastify()
          await app.register(authPlugin, { firebaseAuth: mockAuth as any })
          app.get('/admin/queues', async () => ({ ok: true }))

          const response = await app.inject({ method: 'GET', url: '/admin/queues' })

          expect(response.statusCode).toBe(200)
          expect(mockAuth.verifyIdToken).not.toHaveBeenCalled()
        })
      })
    })
    ```
    - Uses `fastify.inject()` — never supertest (project-context)
    - Uses `createMockFirebaseAuth()` from canonical test utilities
    - Test names describe behavior: "should return 401 when..." (project-context)
    - `afterEach(() => vi.restoreAllMocks())` — mandatory (project-context)
    - Tests verify both positive (valid token) and negative (missing, invalid, expired) paths

- [ ] Task 11: Frontend tests (AC: #5, #6)
  - [ ] 11.1 Create `apps/webapp/src/hooks/use-auth.test.ts`:
    - Test that `useAuth` returns `{ user: null, loading: true }` initially
    - Test that `useAuth` updates state when `onAuthStateChanged` fires
    - Mock `firebase/auth` module with `vi.mock()`
    - Use `renderHook` from `@testing-library/react`

  - [ ] 11.2 Create `apps/webapp/src/components/common/ProtectedRoute.test.tsx`:
    - Test that unauthenticated users are redirected to `/sign-in`
    - Test that authenticated users see child routes
    - Test that loading state shows skeleton
    - Mock `useAuth` hook
    - Use `MemoryRouter` for route testing

  - [ ] 11.3 Create `apps/webapp/src/lib/api-fetch.test.ts`:
    - Test that Bearer token is attached to requests
    - Test 401 → token refresh → retry flow
    - Test redirect to `/sign-in` on persistent 401
    - Test `ApiError` is thrown with correct properties on non-OK responses
    - Mock `firebase/auth` and global `fetch`

- [ ] Task 12: Validate complete implementation (AC: #1-#8)
  - [ ] 12.1 Run `pnpm lint` — zero errors
  - [ ] 12.2 Run `pnpm typecheck` — zero type errors
  - [ ] 12.3 Run `pnpm test` — all tests pass (no regressions)
  - [ ] 12.4 Run `pnpm build` — all workspaces build successfully
  - [ ] 12.5 Verify auth plugin works with `fastify.inject()` tests
  - [ ] 12.6 Verify webapp builds with Firebase SDK (no bundle errors)
  - [ ] 12.7 Verify ProtectedRoute redirects unauthenticated users
  - [ ] 12.8 Verify `GET /health` remains accessible without auth

## Dev Notes

### Rules (MUST Follow)

**Firebase Admin SDK (Backend):**
- Initialize in `apps/backend/src/plugins/auth/firebase.ts` — singleton pattern with `getApps()` guard
- `FIREBASE_SERVICE_ACCOUNT` env var — support both raw JSON and base64-encoded JSON
- Inject via plugin options for testability: `authPlugin({ firebaseAuth: mockAuth })`
- `verifyIdToken()` is the ONLY Firebase Admin API needed for this story
- **Do NOT use Firebase Admin for user management** (creating users, updating profiles) — Firebase client SDK handles that

**Firebase Client SDK (Webapp):**
- Initialize in `apps/webapp/src/lib/firebase.ts` — one global instance
- `browserLocalPersistence` for session persistence across browser sessions (FR27)
- Enable email/password + GitHub providers (configure in Firebase Console, not in code)
- **Firebase Auth is confined to `app.mycscompanion.dev`** — NEVER import firebase in the Astro website
- `import.meta.env['VITE_*']` for all Firebase config values

**Auth Plugin (Architecture verbatim):**
- Global `onRequest` hook via `fastify-plugin` — applies to ALL routes
- Extracts `Authorization: Bearer <token>` from request header
- Verifies via `firebaseAuth.verifyIdToken()`
- Decorates `request.uid` with verified user ID
- Returns 401 if missing, expired, or invalid
- Public exemptions: `/health`, `/admin/*`
- Error response: `{ error: { code: 'UNAUTHORIZED', message: '...' } }`

**apiFetch Utility (Architecture verbatim):**
- Location: `apps/webapp/src/lib/api-fetch.ts` — NOT in `@mycscompanion/shared`
- Attaches Firebase Bearer token via `getIdToken()`
- Handles 401 → force token refresh (`getIdToken(true)`) → retry once → redirect to `/sign-in`
- No Axios, no fetch wrapper library
- TanStack Query handles retries, caching, error states (separate from auth retry)

**Token Refresh (FR43):**
- Firebase tokens expire after 1 hour
- `useAuth` hook listens for `visibilitychange` event
- On tab focus: `getIdToken(true)` proactively refreshes the token
- This prevents users from hitting 401 after returning to an idle tab

**Route Structure (Architecture):**
- `/sign-in`, `/sign-up` — public (no auth required)
- `/onboarding`, `/overview`, `/workspace/:milestoneId`, `/completion/:milestoneId` — protected via `ProtectedRoute`
- `ProtectedRoute` uses React Router v7's `<Outlet />` pattern for nested routes
- Route-level code splitting via `React.lazy()` for workspace (not needed yet, placeholder routes for now)

**Plugin Registration Order (ARCH-5) — Do NOT change:**
1. Auth plugin (global onRequest hook — must be first)
2. Rate limiter (Story 2.1 placeholder comment — depends on auth for uid)
3. Domain plugins (execution, tutor, curriculum, progress, account)
4. Admin plugin (Bull Board with basic auth)
5. Error handler (must be last)

### Anti-Patterns (MUST AVOID)

- Do NOT install `firebase` (client SDK) in the backend — use `firebase-admin` only
- Do NOT install `firebase-admin` in the webapp — use `firebase` only
- Do NOT import from `firebase/auth` in the Astro website — no Firebase on `mycscompanion.dev`
- Do NOT create a custom token refresh mechanism — Firebase SDK handles token lifecycle
- Do NOT use `@/` import aliases — relative paths within apps (project-context)
- Do NOT add default exports — named exports only
- Do NOT use `console.log` — use Fastify's pino logger (backend) or don't log at all (frontend)
- Do NOT create a separate auth context with React Context — `useAuth` hook with Firebase's `onAuthStateChanged` is sufficient
- Do NOT store Firebase tokens in localStorage/sessionStorage manually — Firebase Auth SDK manages its own persistence
- Do NOT add TanStack Query or Zustand integration in this story — Story 2.2+ handles data fetching patterns
- Do NOT create user database records in the auth plugin — user record creation is Story 2.3 (onboarding)
- Do NOT mock `firebase-admin` module globally — use the injectable `firebaseAuth` option pattern
- Do NOT add rate limiting in this story — it's scaffolded in the auth plugin but implemented in later stories
- Do NOT use `any` type — use `Partial<T>` or proper typing. Exception: `as any` for passing mock auth to the typed plugin opts is acceptable in test files only.

### Previous Story Intelligence (Story 1.7)

**What was established:**
- Sentry integration with custom error handler (`setErrorHandler`) — 500+ → Sentry, 4xx → warn only
- Bull Board at `/admin/queues` with basic auth — admin routes exempted from Firebase auth
- Auth plugin stub with `decorateRequest('uid', '')` and TODO comments
- `trustProxy: true` for Railway reverse proxy
- `instrument.ts` imported first in server.ts and worker.ts
- Plugin registration order documented in `app.ts`
- 32 tests passing across all workspaces

**Code patterns from Story 1.7:**
- Named exports only (no default) — BUT `fastify-plugin` wrapper pattern for global plugins
- `.js` extensions on all relative imports (NodeNext module resolution)
- Error response format: `{ error: { code: string, message: string } }`
- `vi.restoreAllMocks()` in `afterEach` — mandatory in all test files
- `fastify.inject()` for all route testing — never supertest
- Single commit per story: `Implement Story X.Y: Brief description`

**Critical fix from 1.7 code review:**
- 500 error messages are masked to 'Internal Server Error' in responses (don't leak internals)
- Admin plugin auth hook exemption added: `if (request.url.startsWith('/admin')) return`

### Git Intelligence (Recent Commits)

```
fa04d6a Implement Story 1.7: Error tracking, monitoring and deployment config
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
- Stories build incrementally

### Project Structure Notes

**Files to CREATE:**
```
apps/backend/src/plugins/auth/
├── firebase.ts                         # NEW — Firebase Admin SDK initialization
├── auth.test.ts                        # NEW — Auth plugin tests

apps/webapp/src/
├── lib/
│   ├── firebase.ts                     # NEW — Firebase client SDK initialization
│   └── api-fetch.ts                    # NEW — Auth-aware API fetch utility
│   └── api-fetch.test.ts              # NEW — apiFetch tests
├── hooks/
│   └── use-auth.ts                     # NEW — Auth state hook with tab-focus refresh
│   └── use-auth.test.ts               # NEW — useAuth hook tests
├── components/
│   └── common/
│       └── ProtectedRoute.tsx          # NEW — Auth guard for protected routes
│       └── ProtectedRoute.test.tsx     # NEW — ProtectedRoute tests

packages/config/test-utils/
├── mock-firebase-auth.ts              # NEW — Canonical Firebase auth mock factory
```

**Files to MODIFY:**
```
apps/backend/src/plugins/auth/index.ts  # MODIFY — Complete Firebase token verification
apps/webapp/src/App.tsx                 # MODIFY — Add route structure + ProtectedRoute
apps/webapp/src/vite-env.d.ts           # MODIFY — Add VITE_FIREBASE_* type declarations
apps/webapp/vite.config.ts              # MODIFY — Add envDir: '../..'
packages/config/test-utils/index.ts     # MODIFY — Export new mock factory
.env.example                           # MODIFY — Add VITE_FIREBASE_* vars
```

**Files NOT to touch:**
- `apps/backend/src/app.ts` — auth plugin registration unchanged (no new options needed at call site)
- `apps/backend/src/server.ts` — no changes needed
- `apps/backend/src/worker/worker.ts` — no changes needed
- `apps/backend/src/instrument.ts` — no changes needed
- `apps/backend/src/plugins/admin/index.ts` — no changes needed
- `apps/backend/migrations/*` — no new migrations (Users table already has id, email, display_name)
- `apps/website/*` — NO Firebase in Astro website (ARCH-3)
- `packages/shared/*` — no shared type changes needed for auth infrastructure
- `packages/ui/*` — no UI component changes
- `.github/workflows/ci.yml` — no CI changes needed
- `docker-compose.yml` — no infrastructure changes
- `turbo.json` — no pipeline changes

### Library Version Notes

| Library | Version | Notes |
|---|---|---|
| `firebase-admin` | ^13.x | Firebase Admin SDK for Node.js. Native ESM. |
| `firebase` | ^11.x | Firebase JS SDK (modular, tree-shakeable). |

**Firebase Admin v13 notes:**
- Native ESM support (works with `"type": "module"`)
- Import from `firebase-admin/app`, `firebase-admin/auth` (modular imports)
- Do NOT use `const admin = require('firebase-admin')` — use ESM imports

**Firebase JS v11 notes:**
- Modular tree-shakeable API — import only needed modules
- `browserLocalPersistence` replaces old `firebase.auth.Auth.Persistence.LOCAL`
- `onAuthStateChanged` is the primary auth state listener

### Downstream Dependencies

| Story | What It Gets From 2.1 |
|---|---|
| 2.2 Signup & Login UI | Firebase auth instance, providers (github, email). Uses `auth` from `lib/firebase.ts` for `signInWithEmailAndPassword`, `signInWithPopup`. Route structure with `/sign-in`, `/sign-up`. |
| 2.3 Background Questionnaire | `request.uid` available on all API requests. `useAuth()` hook for frontend auth state. `apiFetch` for API calls. `ProtectedRoute` guards onboarding route. |
| 2.4 Skill Floor Assessment | Same as 2.3 — auth infrastructure available. |
| 2.5 Graceful Redirect | Same as 2.3 — auth infrastructure available. |
| 3.x Execution stories | `request.uid` enables per-user rate limiting and submission ownership. |
| 6.x Tutor stories | `request.uid` enables per-user rate limiting and conversation ownership. |
| All future stories | Auth infrastructure (token verification, apiFetch, ProtectedRoute) is foundational. |

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story-2.1 — Acceptance criteria and story definition]
- [Source: _bmad-output/planning-artifacts/architecture.md#Authentication-Security — Firebase Auth boundary, API authorization, token refresh]
- [Source: _bmad-output/planning-artifacts/architecture.md#Frontend-Architecture — apiFetch, routing, ProtectedRoute, state management]
- [Source: _bmad-output/planning-artifacts/architecture.md#Structure-Patterns — Backend plugin structure (auth/firebase.ts, auth/index.ts)]
- [Source: _bmad-output/planning-artifacts/architecture.md#Format-Patterns — API error response format { error: { code, message } }]
- [Source: _bmad-output/planning-artifacts/architecture.md#Test-Patterns — Mock verifyIdToken() for test uid]
- [Source: _bmad-output/project-context.md#Error-Handling — Two-path error classification (auth is platform error path)]
- [Source: _bmad-output/project-context.md#Framework-Rules — Fastify plugin registration order, request decorator pattern]
- [Source: _bmad-output/project-context.md#Testing-Rules — Co-located tests, vi.restoreAllMocks, fastify.inject()]
- [Source: _bmad-output/project-context.md#Anti-Patterns — No default exports, no @/ aliases, no console.log]
- [Source: _bmad-output/implementation-artifacts/1-7-error-tracking-monitoring-and-deployment-config.md — Auth plugin stub, admin route exemption, error handler patterns]
- [Source: apps/backend/src/plugins/auth/index.ts — Current auth plugin stub with TODO comments]
- [Source: apps/backend/src/app.ts — Plugin registration order, error handler]
- [Source: apps/webapp/src/App.tsx — Current minimal route structure]
- [Source: apps/backend/migrations/001_initial_schema.ts — Users table schema (id text PK, email, display_name)]

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### Change Log

### File List
