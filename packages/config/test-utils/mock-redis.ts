import type { Mock } from 'vitest'
import { vi } from 'vitest'

export interface MockRedis {
  get: Mock<(key: string) => Promise<string | null>>
  set: Mock<(key: string, value: string) => Promise<string>>
  del: Mock<(...keys: string[]) => Promise<number>>
  expire: Mock<(key: string, seconds: number) => Promise<number>>
  ttl: Mock<(key: string) => Promise<number>>
  keys: Mock<(pattern: string) => Promise<string[]>>
  quit: Mock<() => Promise<string>>
  on: Mock<(event: string, handler: (...args: unknown[]) => void) => void>
  ping: Mock<() => Promise<string>>
}

export function createMockRedis(): MockRedis {
  const store = new Map<string, string>()
  return {
    get: vi.fn(async (key: string) => store.get(key) ?? null),
    set: vi.fn(async (key: string, value: string) => {
      store.set(key, value)
      return 'OK'
    }),
    del: vi.fn(async (...keys: string[]) => {
      let count = 0
      for (const key of keys) {
        if (store.delete(key)) count++
      }
      return count
    }),
    expire: vi.fn(async () => 1),
    ttl: vi.fn(async () => -1),
    keys: vi.fn(async (pattern: string) => {
      const regex = new RegExp('^' + pattern.replace(/\*/g, '.*').replace(/\?/g, '.') + '$')
      return [...store.keys()].filter((k) => regex.test(k))
    }),
    quit: vi.fn(async () => 'OK'),
    on: vi.fn(),
    ping: vi.fn(async () => 'PONG'),
  }
}
