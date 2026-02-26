import type { FastifyInstance } from 'fastify'

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function executionPlugin(fastify: FastifyInstance): Promise<void> {
  // Routes added in Story 3.x:
  // POST /submit — submit code for execution
  // GET /:submissionId/stream — SSE stream for execution results
}
