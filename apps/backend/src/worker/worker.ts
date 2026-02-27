import { Sentry } from '../instrument.js' // Must be first — Sentry auto-instrumentation
import pino from 'pino'

const logger = pino({
  level: process.env['LOG_LEVEL'] ?? 'info',
  transport:
    process.env['NODE_ENV'] !== 'production'
      ? { target: 'pino-pretty' }
      : undefined,
})

logger.info('Worker started')

// BullMQ processors registered in Story 3.3

// Keep the event loop alive until BullMQ provides its own activity (Story 3.3)
const keepAlive = setInterval(() => {}, 1 << 30)

for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.on(signal, () => {
    logger.info({ signal }, 'Worker shutting down')
    clearInterval(keepAlive)
    void (async () => {
      await Sentry.close(2000)
      process.exit(0)
    })().catch(() => process.exit(1))
  })
}
