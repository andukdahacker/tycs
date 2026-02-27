import { defineConfig } from 'vitest/config'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export const baseVitestConfig = defineConfig({
  test: {
    include: ['**/*.test.{ts,tsx}'],
    restoreMocks: true,
  },
  resolve: {
    alias: {
      '@mycscompanion/shared': path.resolve(__dirname, '../shared/src'),
      '@mycscompanion/execution': path.resolve(__dirname, '../execution/src'),
      '@mycscompanion/config': path.resolve(__dirname, '../config'),
    },
  },
})
