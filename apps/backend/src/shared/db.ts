import type { DB } from '@mycscompanion/shared'
import { Kysely, PostgresDialect } from 'kysely'
import pg from 'pg'

if (!process.env['DATABASE_URL']) {
  throw new Error('DATABASE_URL environment variable is required')
}

const dialect = new PostgresDialect({
  pool: new pg.Pool({
    connectionString: process.env['DATABASE_URL'],
  }),
})

export const db = new Kysely<DB>({ dialect })

export async function destroyDb(): Promise<void> {
  await db.destroy()
}
