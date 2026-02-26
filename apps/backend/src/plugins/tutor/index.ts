import type { FastifyInstance } from 'fastify'

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function tutorPlugin(fastify: FastifyInstance): Promise<void> {
  // Routes added in Story 6.x:
  // GET /:sessionId/stream — SSE stream for tutor responses
  // POST /:sessionId/message — send message to tutor
  // GET /:sessionId/messages — get conversation history
}
