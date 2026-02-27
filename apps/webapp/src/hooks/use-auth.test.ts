import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'

// Mock firebase/auth before importing useAuth
const mockOnAuthStateChanged = vi.fn()
const mockGetIdToken = vi.fn()
const mockCurrentUser = { getIdToken: mockGetIdToken }

vi.mock('firebase/auth', () => ({
  getAuth: vi.fn(() => ({ currentUser: mockCurrentUser })),
  onAuthStateChanged: mockOnAuthStateChanged,
}))

vi.mock('../lib/firebase', () => ({
  auth: { currentUser: mockCurrentUser },
}))

// Import after mocks are set up
const { useAuth } = await import('./use-auth')

describe('useAuth', () => {
  beforeEach(() => {
    mockOnAuthStateChanged.mockReturnValue(vi.fn()) // return unsubscribe, don't fire callback
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should return loading true and user null initially', () => {
    const { result } = renderHook(() => useAuth())

    expect(result.current.loading).toBe(true)
    expect(result.current.user).toBeNull()
  })

  it('should update state when onAuthStateChanged fires with a user', () => {
    const mockUser = { uid: 'test-uid', email: 'test@test.com' }
    mockOnAuthStateChanged.mockImplementation((_auth: unknown, callback: (user: unknown) => void) => {
      callback(mockUser)
      return vi.fn()
    })

    const { result } = renderHook(() => useAuth())

    expect(result.current.loading).toBe(false)
    expect(result.current.user).toBe(mockUser)
  })

  it('should update state when onAuthStateChanged fires with null', () => {
    mockOnAuthStateChanged.mockImplementation((_auth: unknown, callback: (user: null) => void) => {
      callback(null)
      return vi.fn()
    })

    const { result } = renderHook(() => useAuth())

    expect(result.current.loading).toBe(false)
    expect(result.current.user).toBeNull()
  })

  it('should unsubscribe from onAuthStateChanged on unmount', () => {
    const unsubscribe = vi.fn()
    mockOnAuthStateChanged.mockReturnValue(unsubscribe)

    const { unmount } = renderHook(() => useAuth())
    unmount()

    expect(unsubscribe).toHaveBeenCalled()
  })
})
