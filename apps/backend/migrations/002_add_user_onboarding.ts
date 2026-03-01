import type { Kysely } from 'kysely'
import { sql } from 'kysely'

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('users')
    .addColumn('role', 'text')
    .addColumn('experience_level', 'text')
    .addColumn('primary_language', 'text')
    .addColumn('onboarding_completed_at', sql`timestamptz`)
    .execute()
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.alterTable('users').dropColumn('onboarding_completed_at').execute()
  await db.schema.alterTable('users').dropColumn('primary_language').execute()
  await db.schema.alterTable('users').dropColumn('experience_level').execute()
  await db.schema.alterTable('users').dropColumn('role').execute()
}
