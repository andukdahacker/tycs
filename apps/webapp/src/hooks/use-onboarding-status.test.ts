import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook, render, waitFor, act, cleanup } from '@testing-library/react'
import { createElement } from 'react'
import { MemoryRouter, Routes, Route, useNavigate } from 'react-router'

const mockApiFetch = vi.fn()
vi.mock('../lib/api-fetch', () => ({
  apiFetch: (...args: unknown[]) => mockApiFetch(...args),
  ApiError: class ApiError extends Error {
    readonly status: number
    readonly code: string
    constructor(status: number, code: string, message: string) {
      super(message)
      this.status = status
      this.code = code
    }
  },
}))

const { useOnboardingStatus } = await import('./use-onboarding-status')
const { ApiError } = await import('../lib/api-fetch')

function createWrapper(initialEntries: string[]) {
  return function Wrapper({ children }: { readonly children: React.ReactNode }) {
    return createElement(MemoryRouter, { initialEntries }, children)
  }
}

describe('useOnboardingStatus', () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('should return isComplete true when profile has onboardingCompletedAt and experience >= 1 year', async () => {
    mockApiFetch.mockResolvedValue({
      id: 'test-uid',
      onboardingCompletedAt: '2026-02-28T00:00:00.000Z',
      experienceLevel: '3-to-5',
      skillFloorPassed: null,
      skillFloorCompletedAt: null,
    })

    const { result } = renderHook(() => useOnboardingStatus(), {
      wrapper: createWrapper(['/overview']),
    })

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })
    expect(result.current.isComplete).toBe(true)
    expect(result.current.assessmentFailed).toBe(false)
  })

  it('should return isComplete false when profile endpoint returns 404', async () => {
    mockApiFetch.mockRejectedValue(new ApiError(404, 'NOT_FOUND', 'User profile not found'))

    const { result } = renderHook(() => useOnboardingStatus(), {
      wrapper: createWrapper(['/overview']),
    })

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })
    expect(result.current.isComplete).toBe(false)
    expect(result.current.assessmentFailed).toBe(false)
  })

  it('should return loading true while fetching', async () => {
    let resolveApiFetch: (value: unknown) => void
    mockApiFetch.mockReturnValue(
      new Promise((resolve) => {
        resolveApiFetch = resolve
      }),
    )

    const { result } = renderHook(() => useOnboardingStatus(), {
      wrapper: createWrapper(['/overview']),
    })

    expect(result.current.loading).toBe(true)

    await act(async () => {
      resolveApiFetch!({ id: 'test-uid', onboardingCompletedAt: null })
    })
  })

  it('should return isComplete false when profile has null onboardingCompletedAt', async () => {
    mockApiFetch.mockResolvedValue({
      id: 'test-uid',
      onboardingCompletedAt: null,
    })

    const { result } = renderHook(() => useOnboardingStatus(), {
      wrapper: createWrapper(['/overview']),
    })

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })
    expect(result.current.isComplete).toBe(false)
    expect(result.current.assessmentFailed).toBe(false)
  })

  it('should refetch when location pathname changes', async () => {
    mockApiFetch.mockClear()
    mockApiFetch.mockResolvedValue({
      id: 'test-uid',
      onboardingCompletedAt: '2026-02-28T00:00:00.000Z',
      experienceLevel: '3-to-5',
      skillFloorPassed: null,
      skillFloorCompletedAt: null,
    })

    let navigateFn: ReturnType<typeof useNavigate>

    function TestHarness() {
      navigateFn = useNavigate()
      useOnboardingStatus()
      return null
    }

    render(
      createElement(MemoryRouter, { initialEntries: ['/onboarding'] },
        createElement(Routes, null,
          createElement(Route, { path: '*', element: createElement(TestHarness) })
        )
      )
    )

    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledTimes(1)
    })

    await act(async () => {
      navigateFn!('/overview')
    })

    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledTimes(2)
    })
  })

  it('should return isComplete null on network error', async () => {
    mockApiFetch.mockRejectedValue(new Error('Network error'))

    const { result } = renderHook(() => useOnboardingStatus(), {
      wrapper: createWrapper(['/overview']),
    })

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })
    expect(result.current.isComplete).toBeNull()
    expect(result.current.assessmentFailed).toBe(false)
  })

  it('should return isComplete false when assessment needed but not completed', async () => {
    mockApiFetch.mockResolvedValue({
      id: 'test-uid',
      onboardingCompletedAt: '2026-02-28T00:00:00.000Z',
      experienceLevel: 'less-than-1',
      skillFloorPassed: null,
      skillFloorCompletedAt: null,
    })

    const { result } = renderHook(() => useOnboardingStatus(), {
      wrapper: createWrapper(['/overview']),
    })

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })
    expect(result.current.isComplete).toBe(false)
    expect(result.current.assessmentFailed).toBe(false)
  })

  it('should return assessmentFailed true when assessment completed with passed=false', async () => {
    mockApiFetch.mockResolvedValue({
      id: 'test-uid',
      onboardingCompletedAt: '2026-02-28T00:00:00.000Z',
      experienceLevel: 'less-than-1',
      skillFloorPassed: false,
      skillFloorCompletedAt: '2026-02-28T00:00:00.000Z',
    })

    const { result } = renderHook(() => useOnboardingStatus(), {
      wrapper: createWrapper(['/overview']),
    })

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })
    expect(result.current.isComplete).toBe(false)
    expect(result.current.assessmentFailed).toBe(true)
  })

  it('should return isComplete true when assessment passed', async () => {
    mockApiFetch.mockResolvedValue({
      id: 'test-uid',
      onboardingCompletedAt: '2026-02-28T00:00:00.000Z',
      experienceLevel: 'less-than-1',
      skillFloorPassed: true,
      skillFloorCompletedAt: '2026-02-28T00:00:00.000Z',
    })

    const { result } = renderHook(() => useOnboardingStatus(), {
      wrapper: createWrapper(['/overview']),
    })

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })
    expect(result.current.isComplete).toBe(true)
    expect(result.current.assessmentFailed).toBe(false)
  })
})
