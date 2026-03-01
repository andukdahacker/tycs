import type { FastifyInstance } from 'fastify'
import { db as defaultDb } from '../../shared/db.js'
import { toCamelCase } from '@mycscompanion/shared'

interface ProfileRoutesOptions {
  readonly db?: typeof defaultDb
}

export async function profileRoutes(fastify: FastifyInstance, opts: ProfileRoutesOptions = {}): Promise<void> {
  const db = opts.db ?? defaultDb
  fastify.get('/profile', async (request, reply) => {
    const user = await db
      .selectFrom('users')
      .selectAll()
      .where('id', '=', request.uid)
      .executeTakeFirst()

    if (!user) {
      return reply.status(404).send({
        error: { code: 'NOT_FOUND', message: 'User profile not found' },
      })
    }

    return toCamelCase(user)
  })
}
