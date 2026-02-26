import Fastify from 'fastify'

const fastify = Fastify({
  logger: {
    transport:
      process.env['NODE_ENV'] !== 'production'
        ? { target: 'pino-pretty' }
        : undefined,
  },
})

fastify.get('/health', async () => {
  return { status: 'ok' }
})

const start = async (): Promise<void> => {
  const port = Number(process.env['PORT'] ?? 3001)
  const host = process.env['HOST'] ?? '0.0.0.0'

  await fastify.listen({ port, host })
}

start().catch((err: unknown) => {
  fastify.log.error(err)
  process.exit(1)
})
