import type { FastifyInstance } from 'fastify'

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function accountPlugin(fastify: FastifyInstance): Promise<void> {
  // Routes added in Story 8.x:
  // GET /profile — get user profile
  // PUT /profile — update user profile
  // POST /onboarding — submit onboarding data
  // GET /export — export user data
  // DELETE / — delete account
}
