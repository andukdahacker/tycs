import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router'

// Mock useAuth hook
const mockUseAuth = vi.fn()
vi.mock('../../hooks/use-auth', () => ({
  useAuth: () => mockUseAuth(),
}))

// Import after mock
const { ProtectedRoute } = await import('./ProtectedRoute')

describe('ProtectedRoute', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

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

  it('should render child routes when user is authenticated', () => {
    mockUseAuth.mockReturnValue({ user: { uid: 'test-uid' }, loading: false })

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
