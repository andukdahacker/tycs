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
      '@tycs/shared': path.resolve(__dirname, '../shared/src'),
      '@tycs/execution': path.resolve(__dirname, '../execution/src'),
      '@tycs/config': path.resolve(__dirname, '../config'),
    },
  },
})
