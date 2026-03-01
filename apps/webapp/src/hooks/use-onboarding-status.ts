import { useState, useEffect, useCallback } from 'react'
import { useLocation } from 'react-router'
import { apiFetch, ApiError } from '../lib/api-fetch'
import type { UserProfile } from '@mycscompanion/shared'

interface OnboardingStatus {
  readonly isComplete: boolean | null
  readonly assessmentFailed: boolean
  readonly loading: boolean
}

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
        setIsComplete(false)
        setAssessmentFailed(false)
      } else if (profile.experienceLevel === 'less-than-1') {
        if (profile.skillFloorCompletedAt === null) {
          setIsComplete(false)
          setAssessmentFailed(false)
        } else if (profile.skillFloorPassed === false) {
          setIsComplete(false)
          setAssessmentFailed(true)
        } else {
          setIsComplete(true)
          setAssessmentFailed(false)
        }
      } else {
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

export { useOnboardingStatus }
