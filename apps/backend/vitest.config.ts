import { mergeConfig } from 'vitest/config'
import { baseVitestConfig } from '@tycs/config/vitest.config'

export default mergeConfig(baseVitestConfig, {
  test: {
    env: {
      DATABASE_URL: 'postgresql://tycs:tycs@localhost:5433/tycs_test',
      REDIS_URL: 'redis://localhost:6379',
      NODE_ENV: 'test',
      LOG_LEVEL: 'silent',
    },
    globalSetup: './src/test/global-setup.ts',
    setupFiles: ['./src/test/setup.ts'],
    exclude: ['**/e2e/**', '**/node_modules/**'],
  },
})
