import { Sentry } from './instrument.js' // Must be first — Sentry auto-instrumentation
import { buildApp } from './app.js'

async function start(): Promise<void> {
  const app = await buildApp()

  const port = Number(process.env['PORT'] ?? 3001)
  const host = process.env['HOST'] ?? '0.0.0.0'

  await app.listen({ port, host })

  for (const signal of ['SIGTERM', 'SIGINT'] as const) {
    process.on(signal, () => {
      app.log.info({ signal }, 'Shutting down')
      void (async () => {
        await Sentry.close(2000)
        await app.close()
        process.exit(0)
      })().catch(() => process.exit(1))
    })
  }
}

start().catch((err: unknown) => {
  // eslint-disable-next-line no-console
  console.error('Failed to start server:', err)
  process.exit(1)
})
