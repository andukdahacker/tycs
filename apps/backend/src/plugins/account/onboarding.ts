import type { FastifyInstance } from 'fastify'
import { sql } from 'kysely'
import { db as defaultDb } from '../../shared/db.js'
import { toCamelCase } from '@mycscompanion/shared'
import type { UserRole, ExperienceLevel, PrimaryLanguage } from '@mycscompanion/shared'

const VALID_ROLES: readonly UserRole[] = ['backend-engineer', 'frontend-engineer', 'fullstack-engineer', 'devops-sre', 'student', 'other']
const VALID_EXPERIENCE_LEVELS: readonly ExperienceLevel[] = ['less-than-1', '1-to-3', '3-to-5', '5-plus']
const VALID_PRIMARY_LANGUAGES: readonly PrimaryLanguage[] = ['go', 'python', 'javascript-typescript', 'rust', 'java', 'c-cpp', 'other']

const onboardingSchema = {
  body: {
    type: 'object',
    required: ['email', 'role', 'experienceLevel', 'primaryLanguage'],
    properties: {
      email: { type: 'string', minLength: 1 },
      displayName: { type: ['string', 'null'] },
      role: { type: 'string', enum: [...VALID_ROLES] },
      experienceLevel: { type: 'string', enum: [...VALID_EXPERIENCE_LEVELS] },
      primaryLanguage: { type: 'string', enum: [...VALID_PRIMARY_LANGUAGES] },
    },
    additionalProperties: false,
  },
} as const

interface OnboardingBody {
  readonly email: string
  readonly displayName?: string | null
  readonly role: UserRole
  readonly experienceLevel: ExperienceLevel
  readonly primaryLanguage: PrimaryLanguage
}

interface OnboardingRoutesOptions {
  readonly db?: typeof defaultDb
}

export async function onboardingRoutes(fastify: FastifyInstance, opts: OnboardingRoutesOptions = {}): Promise<void> {
  const db = opts.db ?? defaultDb
  fastify.post<{ Body: OnboardingBody }>('/onboarding', { schema: onboardingSchema }, async (request) => {
    const { email, displayName, role, experienceLevel, primaryLanguage } = request.body

    const result = await db
      .insertInto('users')
      .values({
        id: request.uid,
        email,
        display_name: displayName ?? null,
        role,
        experience_level: experienceLevel,
        primary_language: primaryLanguage,
        onboarding_completed_at: sql`now()`,
      })
      .onConflict((oc) =>
        oc.column('id').doUpdateSet({
          email,
          display_name: displayName ?? null,
          role,
          experience_level: experienceLevel,
          primary_language: primaryLanguage,
          onboarding_completed_at: sql`now()`,
          updated_at: sql`now()`,
        })
      )
      .returningAll()
      .executeTakeFirstOrThrow()

    request.log.info({ uid: request.uid, experienceLevel }, 'onboarding_completed')

    return toCamelCase(result)
  })
}
