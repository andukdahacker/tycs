import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, waitFor, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router'

const mockUseAuth = vi.fn()
vi.mock('../hooks/use-auth', () => ({
  useAuth: () => mockUseAuth(),
}))

const mockSignInWithEmail = vi.fn()
const mockSignInWithGithub = vi.fn()
const mockMapFirebaseError = vi.fn()
vi.mock('../lib/firebase', () => ({
  signInWithEmail: (...args: unknown[]) => mockSignInWithEmail(...args),
  signInWithGithub: (...args: unknown[]) => mockSignInWithGithub(...args),
  mapFirebaseError: (...args: unknown[]) => mockMapFirebaseError(...args),
}))

const { SignIn } = await import('./SignIn')

function renderSignIn(): ReturnType<typeof render> {
  return render(
    <MemoryRouter initialEntries={['/sign-in']}>
      <Routes>
        <Route path="/sign-in" element={<SignIn />} />
        <Route path="/sign-up" element={<div>Sign Up Page</div>} />
        <Route path="/overview" element={<div>Overview Page</div>} />
        <Route path="/onboarding" element={<div>Onboarding Page</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('SignIn', () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('should render email and password inputs', () => {
    mockUseAuth.mockReturnValue({ user: null, loading: false })
    renderSignIn()

    expect(screen.getByLabelText('Email')).toBeDefined()
    expect(screen.getByLabelText('Password')).toBeDefined()
  })

  it('should render sign in button and GitHub button', () => {
    mockUseAuth.mockReturnValue({ user: null, loading: false })
    renderSignIn()

    expect(screen.getByRole('button', { name: /^Sign in$/ })).toBeDefined()
    expect(screen.getByRole('button', { name: /^Sign in with GitHub$/ })).toBeDefined()
  })

  it('should render create account link pointing to /sign-up', () => {
    mockUseAuth.mockReturnValue({ user: null, loading: false })
    renderSignIn()

    const link = screen.getByRole('link', { name: /Create account/ })
    expect(link).toBeDefined()
    expect(link.getAttribute('href')).toBe('/sign-up')
  })

  it('should not submit with empty fields', async () => {
    mockUseAuth.mockReturnValue({ user: null, loading: false })
    renderSignIn()

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /^Sign in$/ }))

    expect(mockSignInWithEmail).not.toHaveBeenCalled()
  })

  it('should navigate to /overview on successful email sign-in', async () => {
    mockUseAuth.mockReturnValue({ user: null, loading: false })
    mockSignInWithEmail.mockResolvedValue({ user: { uid: 'test-uid' } })
    renderSignIn()

    const user = userEvent.setup()
    await user.type(screen.getByLabelText('Email'), 'test@example.com')
    await user.type(screen.getByLabelText('Password'), 'password123')
    await user.click(screen.getByRole('button', { name: /^Sign in$/ }))

    await waitFor(() => {
      expect(screen.getByText('Overview Page')).toBeDefined()
    })
    expect(mockSignInWithEmail).toHaveBeenCalledWith('test@example.com', 'password123')
  })

  it('should navigate to /overview on GitHub sign-in for existing user', async () => {
    mockUseAuth.mockReturnValue({ user: null, loading: false })
    mockSignInWithGithub.mockResolvedValue({ credential: {}, isNewUser: false })
    renderSignIn()

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /^Sign in with GitHub$/ }))

    await waitFor(() => {
      expect(screen.getByText('Overview Page')).toBeDefined()
    })
  })

  it('should navigate to /onboarding on GitHub sign-in for new user', async () => {
    mockUseAuth.mockReturnValue({ user: null, loading: false })
    mockSignInWithGithub.mockResolvedValue({ credential: {}, isNewUser: true })
    renderSignIn()

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /^Sign in with GitHub$/ }))

    await waitFor(() => {
      expect(screen.getByText('Onboarding Page')).toBeDefined()
    })
  })

  it('should display error message on auth failure', async () => {
    mockUseAuth.mockReturnValue({ user: null, loading: false })
    mockSignInWithEmail.mockRejectedValue(new Error('auth error'))
    mockMapFirebaseError.mockReturnValue('Incorrect email or password. Try again.')
    renderSignIn()

    const user = userEvent.setup()
    await user.type(screen.getByLabelText('Email'), 'test@example.com')
    await user.type(screen.getByLabelText('Password'), 'wrong')
    await user.click(screen.getByRole('button', { name: /^Sign in$/ }))

    await waitFor(() => {
      expect(screen.getByText('Incorrect email or password. Try again.')).toBeDefined()
    })
  })

  it('should silently ignore popup-closed-by-user on GitHub sign-in', async () => {
    mockUseAuth.mockReturnValue({ user: null, loading: false })
    mockSignInWithGithub.mockRejectedValue(new Error('popup closed'))
    mockMapFirebaseError.mockReturnValue(null)
    renderSignIn()

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /^Sign in with GitHub$/ }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^Sign in with GitHub$/ })).toBeDefined()
    })
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('should redirect to /overview if already authenticated', () => {
    mockUseAuth.mockReturnValue({ user: { uid: 'test-uid' }, loading: false })
    renderSignIn()

    expect(screen.getByText('Overview Page')).toBeDefined()
  })

  it('should disable form during submission', async () => {
    mockUseAuth.mockReturnValue({ user: null, loading: false })
    let resolveSignIn: (value: unknown) => void
    mockSignInWithEmail.mockReturnValue(
      new Promise((resolve) => {
        resolveSignIn = resolve
      }),
    )
    renderSignIn()

    const user = userEvent.setup()
    await user.type(screen.getByLabelText('Email'), 'test@example.com')
    await user.type(screen.getByLabelText('Password'), 'password123')
    await user.click(screen.getByRole('button', { name: /^Sign in$/ }))

    await waitFor(() => {
      expect(screen.getByText('Signing in...')).toBeDefined()
    })
    expect(screen.getByLabelText('Email').hasAttribute('disabled')).toBe(true)
    expect(screen.getByLabelText('Password').hasAttribute('disabled')).toBe(true)

    resolveSignIn!({ user: { uid: 'test-uid' } })
  })
})
