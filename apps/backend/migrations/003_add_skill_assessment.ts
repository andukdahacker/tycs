import type { Kysely } from 'kysely'
import { sql } from 'kysely'

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('users')
    .addColumn('skill_floor_passed', 'boolean')
    .addColumn('skill_floor_completed_at', sql`timestamptz`)
    .execute()
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.alterTable('users').dropColumn('skill_floor_completed_at').execute()
  await db.schema.alterTable('users').dropColumn('skill_floor_passed').execute()
}
