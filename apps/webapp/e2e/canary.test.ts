import { test as it, expect } from '@playwright/test'

const describe = it.describe

describe('E2E Infrastructure Canary', () => {
  it('should reach backend health endpoint', async ({ request }) => {
    const response = await request.get('/health')
    expect(response.status()).toBe(200)
    const body = await response.json()
    expect(body).toEqual({ status: 'ok' })
  })
})
