import type { FastifyInstance } from 'fastify'
import { db as defaultDb } from '../../shared/db.js'
import { profileRoutes } from './profile.js'
import { onboardingRoutes } from './onboarding.js'

interface AccountPluginOptions {
  readonly db?: typeof defaultDb
}

export async function accountPlugin(fastify: FastifyInstance, opts: AccountPluginOptions = {}): Promise<void> {
  const db = opts.db ?? defaultDb
  await fastify.register(profileRoutes, { db })
  await fastify.register(onboardingRoutes, { db })
}
