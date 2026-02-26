import { describe, it, expect } from 'vitest'
import { TRACKS, MILESTONES } from './constants'

describe('TRACKS', () => {
  it('should contain build-your-own-database track slug', () => {
    expect(TRACKS.BUILD_YOUR_OWN_DATABASE).toBe('build-your-own-database')
  })
})

describe('MILESTONES', () => {
  it('should contain all 5 milestone slugs in kebab-case', () => {
    expect(MILESTONES.KV_STORE).toBe('kv-store')
    expect(MILESTONES.STORAGE_ENGINE).toBe('storage-engine')
    expect(MILESTONES.BTREE_INDEXING).toBe('btree-indexing')
    expect(MILESTONES.QUERY_PARSER).toBe('query-parser')
    expect(MILESTONES.TRANSACTIONS).toBe('transactions')
  })

  it('should have exactly 5 milestones', () => {
    expect(Object.keys(MILESTONES)).toHaveLength(5)
  })
})
