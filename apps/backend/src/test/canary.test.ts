import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest'
import type { Kysely } from 'kysely'
import { sql } from 'kysely'
import type { DB } from '@tycs/shared'
import type { FastifyInstance } from 'fastify'
import { createTestDb, beginTransaction, rollbackTransaction } from './test-db.js'
import { createTestApp } from './test-app.js'
import { createMockRedis } from '@tycs/config/test-utils/mock-redis'

describe('Test Infrastructure Canary', () => {
  describe('Database', () => {
    let testDb: Kysely<DB>

    beforeEach(async () => {
      testDb = createTestDb()
    })

    afterEach(async () => {
      await testDb.destroy()
    })

    it('should connect to tycs_test database', async () => {
      const result = await sql`SELECT 1 as value`.execute(testDb)
      expect(result.rows[0]).toEqual({ value: 1 })
    })

    it('should rollback transactions to prevent state leakage', async () => {
      await beginTransaction(testDb)
      // Insert into a known table (users exists from migration)
      await testDb
        .insertInto('users')
        .values({ id: 'test-canary-user', email: 'canary@test.com' })
        .execute()
      // Verify insert succeeded within transaction
      const inserted = await testDb
        .selectFrom('users')
        .where('id', '=', 'test-canary-user')
        .executeTakeFirst()
      expect(inserted).toBeDefined()
      // Rollback
      await rollbackTransaction(testDb)
      // Verify row is gone after rollback
      const afterRollback = await testDb
        .selectFrom('users')
        .where('id', '=', 'test-canary-user')
        .executeTakeFirst()
      expect(afterRollback).toBeUndefined()
    })
  })

  describe('Fastify Inject', () => {
    let app: FastifyInstance

    beforeAll(async () => {
      app = await createTestApp()
    })

    afterAll(async () => {
      await app.close()
    })

    it('should inject GET /health and receive 200', async () => {
      const response = await app.inject({ method: 'GET', url: '/health' })
      expect(response.statusCode).toBe(200)
      expect(response.json()).toEqual({ status: 'ok' })
    })
  })

  describe('Redis Mock', () => {
    it('should support get/set operations', async () => {
      const redis = createMockRedis()
      await redis.set('key', 'value')
      const result = await redis.get('key')
      expect(result).toBe('value')
    })

    it('should return null for missing keys', async () => {
      const redis = createMockRedis()
      const result = await redis.get('nonexistent')
      expect(result).toBeNull()
    })

    it('should support del operations', async () => {
      const redis = createMockRedis()
      await redis.set('key', 'value')
      await redis.del('key')
      const result = await redis.get('key')
      expect(result).toBeNull()
    })

    it('should support ping', async () => {
      const redis = createMockRedis()
      const result = await redis.ping()
      expect(result).toBe('PONG')
    })
  })
})
