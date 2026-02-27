import { mergeConfig } from 'vitest/config'
import { baseVitestConfig } from '@mycscompanion/config/vitest.config'

export default mergeConfig(baseVitestConfig, {
  test: {
    environment: 'jsdom',
    setupFiles: ['@testing-library/jest-dom'],
    exclude: ['**/e2e/**', '**/node_modules/**'],
    passWithNoTests: true,
  },
})
