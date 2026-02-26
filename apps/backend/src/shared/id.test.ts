import { describe, it, expect } from 'vitest'
import { generateId } from './id.js'

describe('generateId', () => {
  it('should return a string', () => {
    const id = generateId()
    expect(typeof id).toBe('string')
  })

  it('should return a non-empty string', () => {
    const id = generateId()
    expect(id.length).toBeGreaterThan(0)
  })

  it('should return unique IDs across calls', () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateId()))
    expect(ids.size).toBe(100)
  })
})
