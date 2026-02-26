import type { Kysely } from 'kysely'
import { sql } from 'kysely'

export async function up(db: Kysely<any>): Promise<void> {
  // --- users ---
  await db.schema
    .createTable('users')
    .addColumn('id', 'text', (col) => col.primaryKey())
    .addColumn('email', 'text', (col) => col.notNull())
    .addColumn('display_name', 'text')
    .addColumn('created_at', sql`timestamptz`, (col) =>
      col.notNull().defaultTo(sql`now()`)
    )
    .addColumn('updated_at', sql`timestamptz`, (col) =>
      col.notNull().defaultTo(sql`now()`)
    )
    .execute()

  await db.schema
    .createIndex('idx_users_email')
    .on('users')
    .column('email')
    .unique()
    .execute()

  // --- tracks ---
  await db.schema
    .createTable('tracks')
    .addColumn('id', 'text', (col) => col.primaryKey())
    .addColumn('name', 'text', (col) => col.notNull())
    .addColumn('slug', 'text', (col) => col.notNull())
    .addColumn('description', 'text')
    .addColumn('created_at', sql`timestamptz`, (col) =>
      col.notNull().defaultTo(sql`now()`)
    )
    .addColumn('updated_at', sql`timestamptz`, (col) =>
      col.notNull().defaultTo(sql`now()`)
    )
    .execute()

  await db.schema
    .createIndex('idx_tracks_slug')
    .on('tracks')
    .column('slug')
    .unique()
    .execute()

  // --- milestones ---
  await db.schema
    .createTable('milestones')
    .addColumn('id', 'text', (col) => col.primaryKey())
    .addColumn('track_id', 'text', (col) =>
      col.notNull().references('tracks.id').onDelete('cascade')
    )
    .addColumn('title', 'text', (col) => col.notNull())
    .addColumn('slug', 'text', (col) => col.notNull())
    .addColumn('position', 'integer', (col) => col.notNull())
    .addColumn('description', 'text')
    .addColumn('created_at', sql`timestamptz`, (col) =>
      col.notNull().defaultTo(sql`now()`)
    )
    .addColumn('updated_at', sql`timestamptz`, (col) =>
      col.notNull().defaultTo(sql`now()`)
    )
    .execute()

  await db.schema
    .createIndex('idx_milestones_track_id')
    .on('milestones')
    .column('track_id')
    .execute()

  await db.schema
    .createIndex('idx_milestones_track_id_position')
    .on('milestones')
    .columns(['track_id', 'position'])
    .unique()
    .execute()

  await db.schema
    .createIndex('idx_milestones_track_id_slug')
    .on('milestones')
    .columns(['track_id', 'slug'])
    .unique()
    .execute()
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('milestones').execute()
  await db.schema.dropTable('tracks').execute()
  await db.schema.dropTable('users').execute()
}
