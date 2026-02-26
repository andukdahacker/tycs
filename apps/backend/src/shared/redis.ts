import { Redis } from 'ioredis'

if (!process.env['REDIS_URL']) {
  throw new Error('REDIS_URL environment variable is required')
}

export const redis = new Redis(process.env['REDIS_URL'])

// Prevent Node.js from crashing on Redis connection errors.
// ioredis reconnects automatically; consuming code adds specific error handling.
redis.on('error', () => {})

export async function destroyRedis(): Promise<void> {
  await redis.quit()
}
