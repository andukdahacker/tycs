import type { FastifyInstance } from 'fastify'
import Fastify from 'fastify'
import cors from '@fastify/cors'
import { authPlugin } from './plugins/auth/index.js'
import { executionPlugin } from './plugins/execution/index.js'
import { tutorPlugin } from './plugins/tutor/index.js'
import { curriculumPlugin } from './plugins/curriculum/index.js'
import { progressPlugin } from './plugins/progress/index.js'
import { accountPlugin } from './plugins/account/index.js'

export async function buildApp(): Promise<FastifyInstance> {
  const fastify = Fastify({
    logger: {
      level: process.env['LOG_LEVEL'] ?? 'info',
      transport:
        process.env['NODE_ENV'] !== 'production'
          ? { target: 'pino-pretty' }
          : undefined,
    },
  })

  // CORS — allow webapp origin
  await fastify.register(cors, {
    origin: process.env['CORS_ORIGIN'] ?? 'http://localhost:5173',
    credentials: true,
  })

  // Health check — unauthenticated, registered before auth plugin
  fastify.get('/health', async () => {
    return { status: 'ok' }
  })

  // --- Plugin registration order (ARCH-5) ---
  // Position 1: Auth (global onRequest hook — must be first)
  await fastify.register(authPlugin)

  // Position 2: Rate limiter (Story 2.1 — depends on auth for uid)

  // Position 3: Domain plugins
  await fastify.register(executionPlugin, { prefix: '/api/execution' })
  await fastify.register(tutorPlugin, { prefix: '/api/tutor' })
  await fastify.register(curriculumPlugin, { prefix: '/api/curriculum' })
  await fastify.register(progressPlugin, { prefix: '/api/progress' })
  await fastify.register(accountPlugin, { prefix: '/api/account' })

  return fastify
}
