import type { FastifyInstance } from 'fastify'
import { sql } from 'kysely'
import { toCamelCase } from '@mycscompanion/shared'
import { db as defaultDb } from '../../shared/db.js'

const skillAssessmentSchema = {
  body: {
    type: 'object',
    required: ['passed'],
    properties: {
      passed: { type: 'boolean' },
    },
    additionalProperties: false,
  },
} as const

interface SkillAssessmentBody {
  readonly passed: boolean
}

interface SkillAssessmentRoutesOptions {
  readonly db?: typeof defaultDb
}

export async function skillAssessmentRoutes(
  fastify: FastifyInstance,
  opts: SkillAssessmentRoutesOptions = {}
): Promise<void> {
  const db = opts.db ?? defaultDb

  fastify.post<{ Body: SkillAssessmentBody }>(
    '/skill-assessment',
    { schema: skillAssessmentSchema },
    async (request, reply) => {
      const { passed } = request.body

      const result = await db
        .updateTable('users')
        .set({
          skill_floor_passed: passed,
          skill_floor_completed_at: sql`now()`,
          updated_at: sql`now()`,
        })
        .where('id', '=', request.uid)
        .where('onboarding_completed_at', 'is not', null)
        .returningAll()
        .executeTakeFirst()

      if (!result) {
        return reply.status(400).send({
          error: { code: 'ONBOARDING_REQUIRED', message: 'Complete onboarding before taking the assessment' },
        })
      }

      request.log.info({ uid: request.uid, passed }, 'skill_assessment_completed')

      return toCamelCase(result)
    }
  )
}
