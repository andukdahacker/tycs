import type { DB } from '@mycscompanion/shared'
import { Kysely, PostgresDialect, sql } from 'kysely'
import pg from 'pg'

export function createTestDb(): Kysely<DB> {
  return new Kysely<DB>({
    dialect: new PostgresDialect({
      pool: new pg.Pool({
        connectionString: process.env['DATABASE_URL'],
        max: 1,
      }),
    }),
  })
}

export async function beginTransaction(db: Kysely<DB>): Promise<void> {
  await sql`BEGIN`.execute(db)
}

export async function rollbackTransaction(db: Kysely<DB>): Promise<void> {
  await sql`ROLLBACK`.execute(db)
}
