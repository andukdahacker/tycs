import { describe, it, expect, vi, afterEach } from 'vitest'
import Fastify from 'fastify'
import { authPlugin } from './index.js'
import { createMockFirebaseAuth } from '@mycscompanion/config/test-utils'

describe('AuthPlugin', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('token verification', () => {
    it('should set request.uid when valid token is provided', async () => {
      const mockAuth = createMockFirebaseAuth('user-123')
      const app = Fastify()
      await app.register(authPlugin, { firebaseAuth: mockAuth })
      app.get('/test', async (request) => ({ uid: request.uid }))

      const response = await app.inject({
        method: 'GET',
        url: '/test',
        headers: { authorization: 'Bearer valid-token' },
      })

      expect(response.statusCode).toBe(200)
      expect(response.json()).toEqual({ uid: 'user-123' })
      expect(mockAuth.verifyIdToken).toHaveBeenCalledWith('valid-token')
    })

    it('should return 401 when no authorization header is provided', async () => {
      const mockAuth = createMockFirebaseAuth()
      const app = Fastify()
      await app.register(authPlugin, { firebaseAuth: mockAuth })
      app.get('/test', async () => ({ ok: true }))

      const response = await app.inject({ method: 'GET', url: '/test' })

      expect(response.statusCode).toBe(401)
      expect(response.json()).toEqual({
        error: { code: 'UNAUTHORIZED', message: 'Missing or invalid authorization header' },
      })
    })

    it('should return 401 when token verification fails', async () => {
      const mockAuth = createMockFirebaseAuth()
      mockAuth.verifyIdToken.mockRejectedValueOnce(new Error('Token is invalid'))
      const app = Fastify()
      await app.register(authPlugin, { firebaseAuth: mockAuth })
      app.get('/test', async () => ({ ok: true }))

      const response = await app.inject({
        method: 'GET',
        url: '/test',
        headers: { authorization: 'Bearer bad-token' },
      })

      expect(response.statusCode).toBe(401)
      expect(response.json().error.code).toBe('UNAUTHORIZED')
    })

    it('should return 401 when token is expired', async () => {
      const mockAuth = createMockFirebaseAuth()
      mockAuth.verifyIdToken.mockRejectedValueOnce(
        new Error('Firebase ID token has expired'),
      )
      const app = Fastify()
      await app.register(authPlugin, { firebaseAuth: mockAuth })
      app.get('/test', async () => ({ ok: true }))

      const response = await app.inject({
        method: 'GET',
        url: '/test',
        headers: { authorization: 'Bearer expired-token' },
      })

      expect(response.statusCode).toBe(401)
      expect(response.json().error.message).toBe('Token expired')
    })
  })

  describe('public route exemptions', () => {
    it('should allow /health without authentication', async () => {
      const mockAuth = createMockFirebaseAuth()
      const app = Fastify()
      await app.register(authPlugin, { firebaseAuth: mockAuth })
      app.get('/health', async () => ({ status: 'ok' }))

      const response = await app.inject({ method: 'GET', url: '/health' })

      expect(response.statusCode).toBe(200)
      expect(mockAuth.verifyIdToken).not.toHaveBeenCalled()
    })

    it('should allow /admin routes without Firebase auth', async () => {
      const mockAuth = createMockFirebaseAuth()
      const app = Fastify()
      await app.register(authPlugin, { firebaseAuth: mockAuth })
      app.get('/admin/queues', async () => ({ ok: true }))

      const response = await app.inject({ method: 'GET', url: '/admin/queues' })

      expect(response.statusCode).toBe(200)
      expect(mockAuth.verifyIdToken).not.toHaveBeenCalled()
    })
  })
})
