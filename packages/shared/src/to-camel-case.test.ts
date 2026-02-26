import { describe, it, expect } from 'vitest'
import { toCamelCase } from './to-camel-case'

describe('toCamelCase', () => {
  it('should convert flat snake_case keys to camelCase', () => {
    const input = { user_id: '123', created_at: '2026-01-01' }
    const result = toCamelCase(input)
    expect(result).toEqual({ userId: '123', createdAt: '2026-01-01' })
  })

  it('should handle nested objects', () => {
    const input = {
      user_id: '123',
      user_profile: {
        first_name: 'John',
        last_name: 'Doe',
      },
    }
    const result = toCamelCase(input)
    expect(result).toEqual({
      userId: '123',
      userProfile: {
        firstName: 'John',
        lastName: 'Doe',
      },
    })
  })

  it('should handle arrays of objects', () => {
    const input = [
      { user_id: '1', display_name: 'Alice' },
      { user_id: '2', display_name: 'Bob' },
    ]
    const result = toCamelCase(input)
    expect(result).toEqual([
      { userId: '1', displayName: 'Alice' },
      { userId: '2', displayName: 'Bob' },
    ])
  })

  it('should handle nested arrays within objects', () => {
    const input = {
      milestone_id: 'm1',
      submissions: [
        { submission_id: 's1', test_results: [{ test_name: 'a' }] },
      ],
    }
    const result = toCamelCase(input)
    expect(result).toEqual({
      milestoneId: 'm1',
      submissions: [
        { submissionId: 's1', testResults: [{ testName: 'a' }] },
      ],
    })
  })

  it('should return primitives unchanged', () => {
    expect(toCamelCase('hello')).toBe('hello')
    expect(toCamelCase(42)).toBe(42)
    expect(toCamelCase(null)).toBe(null)
    expect(toCamelCase(true)).toBe(true)
  })

  it('should handle keys with no underscores', () => {
    const input = { id: '123', name: 'test' }
    const result = toCamelCase(input)
    expect(result).toEqual({ id: '123', name: 'test' })
  })

  it('should handle keys with multiple underscores', () => {
    const input = { code_snapshot_id: 'cs1', is_auto_save: true }
    const result = toCamelCase(input)
    expect(result).toEqual({ codeSnapshotId: 'cs1', isAutoSave: true })
  })

  it('should handle empty objects', () => {
    expect(toCamelCase({})).toEqual({})
  })

  it('should handle empty arrays', () => {
    expect(toCamelCase([])).toEqual([])
  })

  it('should preserve null values in object fields', () => {
    const input = { user_id: '123', deleted_at: null }
    const result = toCamelCase(input)
    expect(result).toEqual({ userId: '123', deletedAt: null })
  })
})
