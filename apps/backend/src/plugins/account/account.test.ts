import { describe, it, expect, afterEach, afterAll } from 'vitest'
import Fastify from 'fastify'
import { authPlugin } from '../auth/index.js'
import { accountPlugin } from './index.js'
import { createMockFirebaseAuth } from '@mycscompanion/config/test-utils'
import { db } from '../../shared/db.js'

const TEST_UID = 'test-acct-uid'
const mockAuth = createMockFirebaseAuth(TEST_UID)

async function buildApp() {
  const app = Fastify({ logger: false })
  await app.register(authPlugin, { firebaseAuth: mockAuth })
  await app.register(accountPlugin, { prefix: '/api/account' })
  await app.ready()
  return app
}

const app = await buildApp()

afterEach(async () => {
  await db.deleteFrom('users').where('id', 'like', 'test-%').execute()
})

afterAll(async () => {
  await app.close()
})

describe('AccountPlugin', () => {
  describe('GET /api/account/profile', () => {
    it('should return 404 when user has no profile', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/account/profile',
        headers: { authorization: 'Bearer valid-token' },
      })

      expect(response.statusCode).toBe(404)
      expect(response.json()).toEqual({
        error: { code: 'NOT_FOUND', message: 'User profile not found' },
      })
    })

    it('should return user profile with camelCase keys when user exists', async () => {
      await db
        .insertInto('users')
        .values({
          id: TEST_UID,
          email: 'test@example.com',
          display_name: 'Test User',
          role: 'backend-engineer',
          experience_level: '3-to-5',
          primary_language: 'go',
        })
        .execute()

      const response = await app.inject({
        method: 'GET',
        url: '/api/account/profile',
        headers: { authorization: 'Bearer valid-token' },
      })

      expect(response.statusCode).toBe(200)
      const body = response.json()
      expect(body.id).toBe(TEST_UID)
      expect(body.email).toBe('test@example.com')
      expect(body.displayName).toBe('Test User')
      expect(body.experienceLevel).toBe('3-to-5')
      expect(body.primaryLanguage).toBe('go')
      expect(body.role).toBe('backend-engineer')
    })

    it('should return onboardingCompletedAt as null when onboarding not finished', async () => {
      await db
        .insertInto('users')
        .values({
          id: TEST_UID,
          email: 'test@example.com',
        })
        .execute()

      const response = await app.inject({
        method: 'GET',
        url: '/api/account/profile',
        headers: { authorization: 'Bearer valid-token' },
      })

      expect(response.statusCode).toBe(200)
      expect(response.json().onboardingCompletedAt).toBeNull()
    })

    it('should return 401 when no auth token provided', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/account/profile',
      })

      expect(response.statusCode).toBe(401)
    })
  })

  describe('POST /api/account/onboarding', () => {
    it('should create user record with onboarding data', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/account/onboarding',
        headers: { authorization: 'Bearer valid-token' },
        payload: {
          email: 'test@example.com',
          displayName: 'Test User',
          role: 'backend-engineer',
          experienceLevel: '3-to-5',
          primaryLanguage: 'go',
        },
      })

      expect(response.statusCode).toBe(200)

      const dbUser = await db
        .selectFrom('users')
        .selectAll()
        .where('id', '=', TEST_UID)
        .executeTakeFirst()

      expect(dbUser).toBeDefined()
      expect(dbUser?.role).toBe('backend-engineer')
      expect(dbUser?.experience_level).toBe('3-to-5')
      expect(dbUser?.primary_language).toBe('go')
    })

    it('should set onboarding_completed_at to current timestamp', async () => {
      await app.inject({
        method: 'POST',
        url: '/api/account/onboarding',
        headers: { authorization: 'Bearer valid-token' },
        payload: {
          email: 'test@example.com',
          role: 'student',
          experienceLevel: 'less-than-1',
          primaryLanguage: 'python',
        },
      })

      const dbUser = await db
        .selectFrom('users')
        .selectAll()
        .where('id', '=', TEST_UID)
        .executeTakeFirst()

      expect(dbUser?.onboarding_completed_at).not.toBeNull()
    })

    it('should return user profile in camelCase', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/account/onboarding',
        headers: { authorization: 'Bearer valid-token' },
        payload: {
          email: 'test@example.com',
          displayName: null,
          role: 'fullstack-engineer',
          experienceLevel: '1-to-3',
          primaryLanguage: 'javascript-typescript',
        },
      })

      expect(response.statusCode).toBe(200)
      const body = response.json()
      expect(body.id).toBe(TEST_UID)
      expect(body.displayName).toBeNull()
      expect(body.experienceLevel).toBe('1-to-3')
      expect(body.primaryLanguage).toBe('javascript-typescript')
      expect(body.onboardingCompletedAt).toBeDefined()
      expect(body.createdAt).toBeDefined()
      expect(body.updatedAt).toBeDefined()
    })

    it('should upsert when user record already exists', async () => {
      await db
        .insertInto('users')
        .values({
          id: TEST_UID,
          email: 'old@example.com',
          display_name: 'Old Name',
        })
        .execute()

      const response = await app.inject({
        method: 'POST',
        url: '/api/account/onboarding',
        headers: { authorization: 'Bearer valid-token' },
        payload: {
          email: 'new@example.com',
          displayName: 'New Name',
          role: 'devops-sre',
          experienceLevel: '5-plus',
          primaryLanguage: 'rust',
        },
      })

      expect(response.statusCode).toBe(200)
      const body = response.json()
      expect(body.email).toBe('new@example.com')
      expect(body.displayName).toBe('New Name')
      expect(body.role).toBe('devops-sre')
    })

    it('should return 400 for invalid role value', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/account/onboarding',
        headers: { authorization: 'Bearer valid-token' },
        payload: {
          email: 'test@example.com',
          role: 'invalid-role',
          experienceLevel: '1-to-3',
          primaryLanguage: 'go',
        },
      })

      expect(response.statusCode).toBe(400)
    })

    it('should return 400 for missing required fields', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/account/onboarding',
        headers: { authorization: 'Bearer valid-token' },
        payload: {
          role: 'student',
        },
      })

      expect(response.statusCode).toBe(400)
    })

    it('should return 400 for invalid experienceLevel value', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/account/onboarding',
        headers: { authorization: 'Bearer valid-token' },
        payload: {
          email: 'test@example.com',
          role: 'student',
          experienceLevel: 'invalid-level',
          primaryLanguage: 'go',
        },
      })

      expect(response.statusCode).toBe(400)
    })

    it('should return 401 when no auth token provided', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/account/onboarding',
        payload: {
          email: 'test@example.com',
          role: 'student',
          experienceLevel: '1-to-3',
          primaryLanguage: 'go',
        },
      })

      expect(response.statusCode).toBe(401)
    })
  })
})
