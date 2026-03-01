/**
 * Shared API request/response types for mycscompanion.
 */

import type { UserRole, ExperienceLevel, PrimaryLanguage } from './domain.js'

export interface OnboardingRequest {
  readonly email: string
  readonly displayName?: string | null
  readonly role: UserRole
  readonly experienceLevel: ExperienceLevel
  readonly primaryLanguage: PrimaryLanguage
}

export interface UserProfile {
  readonly id: string
  readonly email: string
  readonly displayName: string | null
  readonly role: UserRole | null
  readonly experienceLevel: ExperienceLevel | null
  readonly primaryLanguage: PrimaryLanguage | null
  readonly onboardingCompletedAt: string | null
  readonly skillFloorPassed: boolean | null
  readonly skillFloorCompletedAt: string | null
  readonly createdAt: string
  readonly updatedAt: string
}

export interface SkillAssessmentRequest {
  readonly passed: boolean
}
