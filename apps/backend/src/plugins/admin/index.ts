import type { FastifyInstance } from 'fastify'
import basicAuth from '@fastify/basic-auth'
import { createBullBoard } from '@bull-board/api'
import { FastifyAdapter } from '@bull-board/fastify'

async function adminPlugin(fastify: FastifyInstance): Promise<void> {
  // Basic auth for /admin routes
  const adminUser = process.env['TYCS_ADMIN_USER'] ?? 'admin'
  const adminPass = process.env['TYCS_ADMIN_PASSWORD']

  if (!adminPass) {
    fastify.log.warn('TYCS_ADMIN_PASSWORD not set — Bull Board disabled')
    return
  }

  await fastify.register(basicAuth, {
    validate: async (username, password) => {
      if (username !== adminUser || password !== adminPass) {
        throw new Error('Unauthorized')
      }
    },
    authenticate: { realm: 'tycs-admin' },
  })

  // Bull Board setup — empty queues, filled in Epic 3
  const serverAdapter = new FastifyAdapter()
  serverAdapter.setBasePath('/admin/queues')

  createBullBoard({
    queues: [], // Queues added dynamically in Epic 3 (Story 3.3)
    serverAdapter,
  })

  // Use setBasePath ONLY — do NOT also pass prefix, or routes will double-prefix
  await fastify.register(serverAdapter.registerPlugin())

  // Protect all routes in this plugin scope with basic auth
  fastify.addHook('onRequest', fastify.basicAuth)
}

export { adminPlugin }
