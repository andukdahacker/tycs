import * as Sentry from '@sentry/node'

const dsn = process.env['TYCS_SENTRY_DSN']

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env['NODE_ENV'] ?? 'development',
    // Only send errors in staging/production — skip in development/test
    enabled: process.env['NODE_ENV'] === 'production' || process.env['NODE_ENV'] === 'staging',
    tracesSampleRate: 0, // No performance monitoring for MVP (ARCH: "No custom APM for MVP")
  })
}

export { Sentry }
