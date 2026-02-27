import { mergeConfig } from 'vitest/config'
import { baseVitestConfig } from '@tycs/config/vitest.config'

const pgPort = process.env['CI'] === 'true' ? '5432' : '5433'

export default mergeConfig(baseVitestConfig, {
  test: {
    env: {
      DATABASE_URL: `postgresql://tycs:tycs@localhost:${pgPort}/tycs_test`,
      REDIS_URL: 'redis://localhost:6379',
      NODE_ENV: 'test',
      LOG_LEVEL: 'silent',
    },
    globalSetup: './src/test/global-setup.ts',
    setupFiles: ['./src/test/setup.ts'],
    exclude: ['**/e2e/**', '**/node_modules/**'],
  },
})
