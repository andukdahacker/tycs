import { config } from 'dotenv'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

config({ path: resolve(dirname(fileURLToPath(import.meta.url)), '../../.env') })

import { defineConfig } from 'kysely-ctl'
import { PostgresDialect } from 'kysely'
import pg from 'pg'

export default defineConfig({
  dialect: new PostgresDialect({
    pool: new pg.Pool({
      connectionString: process.env['DATABASE_URL'],
    }),
  }),
  migrations: {
    migrationFolder: './migrations',
  },
})
