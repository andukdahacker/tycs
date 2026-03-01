import { useState, useEffect, useCallback } from 'react'
import { useLocation } from 'react-router'
import { apiFetch, ApiError } from '../lib/api-fetch'
import type { UserProfile } from '@mycscompanion/shared'

interface OnboardingStatus {
  readonly isComplete: boolean | null
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
        setIsComplete(false)
      } else {
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
