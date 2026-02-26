import type { FastifyInstance } from 'fastify'
import fp from 'fastify-plugin'

declare module 'fastify' {
  interface FastifyRequest {
    uid: string
  }
}

async function auth(fastify: FastifyInstance): Promise<void> {
  fastify.decorateRequest('uid', '')

  fastify.addHook('onRequest', async (request) => {
    if (request.url === '/health' || request.url.startsWith('/health?')) return
    // TODO(story-2.1): Implement Firebase ID token verification
    // 1. Extract Authorization: Bearer <token>
    // 2. Verify via Firebase Admin SDK auth.verifyIdToken()
    // 3. Set request.uid = decodedToken.uid
    // 4. Return 401 if missing/invalid/expired
  })
}

export const authPlugin = fp(auth, { name: 'auth-plugin' })
