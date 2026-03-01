import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router'

const mockUseAuth = vi.fn()
vi.mock('../../hooks/use-auth', () => ({
  useAuth: () => mockUseAuth(),
}))

const mockUseOnboardingStatus = vi.fn()
vi.mock('../../hooks/use-onboarding-status', () => ({
  useOnboardingStatus: () => mockUseOnboardingStatus(),
}))

const { ProtectedRoute } = await import('./ProtectedRoute')

describe('ProtectedRoute', () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  describe('authentication', () => {
    it('should show loading skeleton when auth is loading', () => {
      mockUseAuth.mockReturnValue({ user: null, loading: true })

      render(
        <MemoryRouter initialEntries={['/protected']}>
          <Routes>
            <Route element={<ProtectedRoute />}>
              <Route path="/protected" element={<div>Protected Content</div>} />
            </Route>
          </Routes>
        </MemoryRouter>,
      )

      expect(screen.queryByText('Protected Content')).toBeNull()
    })

    it('should redirect to /sign-in when user is not authenticated', () => {
      mockUseAuth.mockReturnValue({ user: null, loading: false })

      render(
        <MemoryRouter initialEntries={['/protected']}>
          <Routes>
            <Route path="/sign-in" element={<div>Sign In Page</div>} />
            <Route element={<ProtectedRoute />}>
              <Route path="/protected" element={<div>Protected Content</div>} />
            </Route>
          </Routes>
        </MemoryRouter>,
      )

      expect(screen.getByText('Sign In Page')).toBeDefined()
      expect(screen.queryByText('Protected Content')).toBeNull()
    })

    it('should render child routes when user is authenticated and onboarding complete', () => {
      mockUseAuth.mockReturnValue({ user: { uid: 'test-uid' }, loading: false })
      mockUseOnboardingStatus.mockReturnValue({ isComplete: true, loading: false })

      render(
        <MemoryRouter initialEntries={['/protected']}>
          <Routes>
            <Route element={<ProtectedRoute />}>
              <Route path="/protected" element={<div>Protected Content</div>} />
            </Route>
          </Routes>
        </MemoryRouter>,
      )

      expect(screen.getByText('Protected Content')).toBeDefined()
    })
  })

  describe('onboarding gate', () => {
    it('should redirect to /onboarding when user has not completed onboarding', () => {
      mockUseAuth.mockReturnValue({ user: { uid: 'test-uid' }, loading: false })
      mockUseOnboardingStatus.mockReturnValue({ isComplete: false, loading: false })

      render(
        <MemoryRouter initialEntries={['/overview']}>
          <Routes>
            <Route element={<ProtectedRoute />}>
              <Route path="/onboarding" element={<div>Onboarding Page</div>} />
              <Route path="/overview" element={<div>Overview Page</div>} />
            </Route>
          </Routes>
        </MemoryRouter>,
      )

      expect(screen.getByText('Onboarding Page')).toBeDefined()
      expect(screen.queryByText('Overview Page')).toBeNull()
    })

    it('should redirect to /overview when completed user visits /onboarding', () => {
      mockUseAuth.mockReturnValue({ user: { uid: 'test-uid' }, loading: false })
      mockUseOnboardingStatus.mockReturnValue({ isComplete: true, loading: false })

      render(
        <MemoryRouter initialEntries={['/onboarding']}>
          <Routes>
            <Route element={<ProtectedRoute />}>
              <Route path="/onboarding" element={<div>Onboarding Page</div>} />
              <Route path="/overview" element={<div>Overview Page</div>} />
            </Route>
          </Routes>
        </MemoryRouter>,
      )

      expect(screen.getByText('Overview Page')).toBeDefined()
      expect(screen.queryByText('Onboarding Page')).toBeNull()
    })

    it('should render outlet when onboarding is complete', () => {
      mockUseAuth.mockReturnValue({ user: { uid: 'test-uid' }, loading: false })
      mockUseOnboardingStatus.mockReturnValue({ isComplete: true, loading: false })

      render(
        <MemoryRouter initialEntries={['/overview']}>
          <Routes>
            <Route element={<ProtectedRoute />}>
              <Route path="/overview" element={<div>Overview Page</div>} />
            </Route>
          </Routes>
        </MemoryRouter>,
      )

      expect(screen.getByText('Overview Page')).toBeDefined()
    })

    it('should show skeleton while checking onboarding status', () => {
      mockUseAuth.mockReturnValue({ user: { uid: 'test-uid' }, loading: false })
      mockUseOnboardingStatus.mockReturnValue({ isComplete: null, loading: true })

      render(
        <MemoryRouter initialEntries={['/overview']}>
          <Routes>
            <Route element={<ProtectedRoute />}>
              <Route path="/overview" element={<div>Overview Page</div>} />
            </Route>
          </Routes>
        </MemoryRouter>,
      )

      expect(screen.queryByText('Overview Page')).toBeNull()
    })

    it('should render outlet when onboarding status is unknown (fail-open on network error)', () => {
      mockUseAuth.mockReturnValue({ user: { uid: 'test-uid' }, loading: false })
      mockUseOnboardingStatus.mockReturnValue({ isComplete: null, loading: false })

      render(
        <MemoryRouter initialEntries={['/overview']}>
          <Routes>
            <Route element={<ProtectedRoute />}>
              <Route path="/overview" element={<div>Overview Page</div>} />
              <Route path="/onboarding" element={<div>Onboarding Page</div>} />
            </Route>
          </Routes>
        </MemoryRouter>,
      )

      expect(screen.getByText('Overview Page')).toBeDefined()
      expect(screen.queryByText('Onboarding Page')).toBeNull()
    })

    it('should allow /onboarding page when onboarding is not complete', () => {
      mockUseAuth.mockReturnValue({ user: { uid: 'test-uid' }, loading: false })
      mockUseOnboardingStatus.mockReturnValue({ isComplete: false, loading: false })

      render(
        <MemoryRouter initialEntries={['/onboarding']}>
          <Routes>
            <Route element={<ProtectedRoute />}>
              <Route path="/onboarding" element={<div>Onboarding Page</div>} />
            </Route>
          </Routes>
        </MemoryRouter>,
      )

      expect(screen.getByText('Onboarding Page')).toBeDefined()
    })
  })
})
