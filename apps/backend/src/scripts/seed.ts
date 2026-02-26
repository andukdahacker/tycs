/* eslint-disable no-console */
import { TRACKS, MILESTONES } from '@tycs/shared'
import { db, destroyDb } from '../shared/db.js'
import { generateId } from '../shared/id.js'

async function seed(): Promise<void> {
  console.info('Seeding database...')

  await db.transaction().execute(async (trx) => {
    // Seed track
    await trx
      .insertInto('tracks')
      .values({
        id: generateId(),
        name: 'Build Your Own Database',
        slug: TRACKS.BUILD_YOUR_OWN_DATABASE,
        description: 'Learn computer science by building a database from scratch in Go.',
      })
      .onConflict((oc) => oc.column('slug').doNothing())
      .execute()

    // Retrieve the track (may already exist from previous run)
    const track = await trx
      .selectFrom('tracks')
      .select('id')
      .where('slug', '=', TRACKS.BUILD_YOUR_OWN_DATABASE)
      .executeTakeFirstOrThrow()

    // Seed milestones (batch insert)
    const milestones = [
      { position: 1, title: 'Simple Key-Value Store', slug: MILESTONES.KV_STORE, description: 'Build a key-value store that persists data to disk.' },
      { position: 2, title: 'Storage Engine', slug: MILESTONES.STORAGE_ENGINE, description: 'Implement a log-structured storage engine with compaction.' },
      { position: 3, title: 'B-Tree Indexing', slug: MILESTONES.BTREE_INDEXING, description: 'Add B-tree indexing for efficient key lookups.' },
      { position: 4, title: 'Query Parser', slug: MILESTONES.QUERY_PARSER, description: 'Build a SQL-like query parser and executor.' },
      { position: 5, title: 'Transactions', slug: MILESTONES.TRANSACTIONS, description: 'Implement ACID transactions with write-ahead logging.' },
    ]

    await trx
      .insertInto('milestones')
      .values(
        milestones.map((m) => ({
          id: generateId(),
          track_id: track.id,
          title: m.title,
          slug: m.slug,
          position: m.position,
          description: m.description,
        }))
      )
      .onConflict((oc) => oc.columns(['track_id', 'slug']).doNothing())
      .execute()
  })

  console.info('Seed complete.')
}

seed()
  .catch((err: unknown) => {
    console.error('Seed failed:', err)
    process.exitCode = 1
  })
  .finally(() => destroyDb())
