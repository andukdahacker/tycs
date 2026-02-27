import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from 'vitest'

// vi.hoisted runs before vi.mock hoisting — safe to reference in factory
const { mockCaptureException } = vi.hoisted(() => ({
  mockCaptureException: vi.fn(),
}))

vi.mock('@sentry/node', () => ({
  init: vi.fn(),
  captureException: mockCaptureException,
  close: vi.fn().mockResolvedValue(undefined),
}))

import type { FastifyInstance } from 'fastify'
import { buildApp } from '../app.js'

describe('Error Handler', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = await buildApp()

    // Test route that throws a server error (500)
    app.get('/test/server-error', async () => {
      throw new Error('Test server error')
    })

    // Test route that throws a client error (404)
    app.get('/test/not-found', async () => {
      throw Object.assign(new Error('Resource not found'), { statusCode: 404 })
    })

    // Test route that throws a client error (400) with custom code
    app.get('/test/bad-request', async () => {
      throw Object.assign(new Error('Bad request data'), {
        statusCode: 400,
        code: 'VALIDATION_ERROR',
      })
    })

    await app.ready()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  afterAll(async () => {
    await app.close()
  })

  describe('500+ errors', () => {
    it('should call Sentry.captureException for server errors', async () => {
      mockCaptureException.mockClear()

      const response = await app.inject({
        method: 'GET',
        url: '/test/server-error',
      })

      expect(response.statusCode).toBe(500)
      expect(mockCaptureException).toHaveBeenCalledTimes(1)
      expect(mockCaptureException).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Test server error' }),
        expect.objectContaining({
          extra: expect.objectContaining({
            method: 'GET',
            url: '/test/server-error',
          }),
        })
      )
    })

    it('should return error response format { error: { code, message } }', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/test/server-error',
      })

      const body = response.json()
      expect(body).toHaveProperty('error')
      expect(body.error).toHaveProperty('code')
      expect(body.error).toHaveProperty('message')
      expect(body.error.message).toBe('Internal Server Error')
    })
  })

  describe('4xx errors', () => {
    it('should NOT call Sentry.captureException for client errors', async () => {
      mockCaptureException.mockClear()

      const response = await app.inject({
        method: 'GET',
        url: '/test/not-found',
      })

      expect(response.statusCode).toBe(404)
      expect(mockCaptureException).not.toHaveBeenCalled()
    })

    it('should return error response format with custom code', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/test/bad-request',
      })

      const body = response.json()
      expect(response.statusCode).toBe(400)
      expect(body.error.code).toBe('VALIDATION_ERROR')
      expect(body.error.message).toBe('Bad request data')
    })
  })

  describe('boundary rule', () => {
    it('should not trigger Sentry for successful responses', async () => {
      // User-code errors are delivered as 200 OK SSE payloads and never
      // reach the error handler. This test confirms a 200 response
      // does NOT trigger captureException.
      mockCaptureException.mockClear()

      const response = await app.inject({
        method: 'GET',
        url: '/health',
      })

      expect(response.statusCode).toBe(200)
      expect(mockCaptureException).not.toHaveBeenCalled()
    })
  })
})
