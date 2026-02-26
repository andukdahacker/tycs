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

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- replaced by kysely-codegen types in Story 1.3
export const db = new Kysely<any>({ dialect })

export async function destroyDb(): Promise<void> {
  await db.destroy()
}
