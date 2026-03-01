import { describe, it, expect, vi, afterEach, beforeAll } from 'vitest'
import { render, screen, within, waitFor, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

beforeAll(() => {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  Element.prototype.scrollIntoView = vi.fn()
  Element.prototype.hasPointerCapture = vi.fn().mockReturnValue(false)
  Element.prototype.setPointerCapture = vi.fn()
  Element.prototype.releasePointerCapture = vi.fn()
})

const mockApiFetch = vi.fn()
vi.mock('../../lib/api-fetch', () => ({
  apiFetch: (...args: unknown[]) => mockApiFetch(...args),
}))

const { SkillFloorCheck } = await import('./SkillFloorCheck')

describe('SkillFloorCheck', () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('should render 3 code snippets with radio button groups', () => {
    render(<SkillFloorCheck onComplete={vi.fn()} />)

    const radioGroups = screen.getAllByRole('radiogroup')
    expect(radioGroups).toHaveLength(3)
    expect(screen.getByRole('radiogroup', { name: 'Question 1' })).toBeDefined()
    expect(screen.getByRole('radiogroup', { name: 'Question 2' })).toBeDefined()
    expect(screen.getByRole('radiogroup', { name: 'Question 3' })).toBeDefined()
  })

  it('should render Continue button disabled until all questions answered', () => {
    render(<SkillFloorCheck onComplete={vi.fn()} />)

    const button = screen.getByRole('button', { name: /^Continue$/ })
    expect(button.hasAttribute('disabled')).toBe(true)
  })

  it('should enable Continue button when all 3 questions have selections', async () => {
    render(<SkillFloorCheck onComplete={vi.fn()} />)
    const user = userEvent.setup()

    const q1 = screen.getByRole('radiogroup', { name: 'Question 1' })
    const q2 = screen.getByRole('radiogroup', { name: 'Question 2' })
    const q3 = screen.getByRole('radiogroup', { name: 'Question 3' })

    await user.click(within(q1).getByRole('radio', { name: '3' }))
    expect(screen.getByRole('button', { name: /^Continue$/ }).hasAttribute('disabled')).toBe(true)

    await user.click(within(q2).getByRole('radio', { name: '[4, 16]' }))
    expect(screen.getByRole('button', { name: /^Continue$/ }).hasAttribute('disabled')).toBe(true)

    await user.click(within(q3).getByRole('radio', { name: '35' }))
    expect(screen.getByRole('button', { name: /^Continue$/ }).hasAttribute('disabled')).toBe(false)
  })

  it('should call onComplete with true when 2+ answers are correct', async () => {
    mockApiFetch.mockResolvedValue({})
    const onComplete = vi.fn()
    render(<SkillFloorCheck onComplete={onComplete} />)
    const user = userEvent.setup()

    const q1 = screen.getByRole('radiogroup', { name: 'Question 1' })
    const q2 = screen.getByRole('radiogroup', { name: 'Question 2' })
    const q3 = screen.getByRole('radiogroup', { name: 'Question 3' })

    // Q1 correct (index 2 = '3'), Q2 correct (index 2 = '[4, 16]'), Q3 wrong (index 0 = '43')
    await user.click(within(q1).getByRole('radio', { name: '3' }))
    await user.click(within(q2).getByRole('radio', { name: '[4, 16]' }))
    await user.click(within(q3).getByRole('radio', { name: '43' }))

    await user.click(screen.getByRole('button', { name: /^Continue$/ }))

    await waitFor(() => {
      expect(onComplete).toHaveBeenCalledWith(true)
    })

    expect(mockApiFetch).toHaveBeenCalledWith('/api/account/skill-assessment', {
      method: 'POST',
      body: JSON.stringify({ passed: true }),
    })
  })

  it('should call onComplete with false when fewer than 2 answers correct', async () => {
    mockApiFetch.mockResolvedValue({})
    const onComplete = vi.fn()
    render(<SkillFloorCheck onComplete={onComplete} />)
    const user = userEvent.setup()

    const q1 = screen.getByRole('radiogroup', { name: 'Question 1' })
    const q2 = screen.getByRole('radiogroup', { name: 'Question 2' })
    const q3 = screen.getByRole('radiogroup', { name: 'Question 3' })

    // Q1 wrong (index 0 = '1'), Q2 wrong (index 0 = '[1, 4, 9, 16, 25]'), Q3 correct (index 1 = '35')
    await user.click(within(q1).getByRole('radio', { name: '1' }))
    await user.click(within(q2).getByRole('radio', { name: '[1, 4, 9, 16, 25]' }))
    await user.click(within(q3).getByRole('radio', { name: '35' }))

    await user.click(screen.getByRole('button', { name: /^Continue$/ }))

    await waitFor(() => {
      expect(onComplete).toHaveBeenCalledWith(false)
    })

    expect(mockApiFetch).toHaveBeenCalledWith('/api/account/skill-assessment', {
      method: 'POST',
      body: JSON.stringify({ passed: false }),
    })
  })

  it('should display error message on API failure', async () => {
    mockApiFetch.mockRejectedValue(new Error('Network error'))
    render(<SkillFloorCheck onComplete={vi.fn()} />)
    const user = userEvent.setup()

    const q1 = screen.getByRole('radiogroup', { name: 'Question 1' })
    const q2 = screen.getByRole('radiogroup', { name: 'Question 2' })
    const q3 = screen.getByRole('radiogroup', { name: 'Question 3' })

    await user.click(within(q1).getByRole('radio', { name: '3' }))
    await user.click(within(q2).getByRole('radio', { name: '[4, 16]' }))
    await user.click(within(q3).getByRole('radio', { name: '35' }))

    await user.click(screen.getByRole('button', { name: /^Continue$/ }))

    await waitFor(() => {
      expect(screen.getByText("Couldn't save your results. Try again.")).toBeDefined()
    })
  })

  it('should preserve selections on API failure', async () => {
    mockApiFetch.mockRejectedValue(new Error('Network error'))
    render(<SkillFloorCheck onComplete={vi.fn()} />)
    const user = userEvent.setup()

    const q1 = screen.getByRole('radiogroup', { name: 'Question 1' })
    const q2 = screen.getByRole('radiogroup', { name: 'Question 2' })
    const q3 = screen.getByRole('radiogroup', { name: 'Question 3' })

    await user.click(within(q1).getByRole('radio', { name: '3' }))
    await user.click(within(q2).getByRole('radio', { name: '[4, 16]' }))
    await user.click(within(q3).getByRole('radio', { name: '35' }))

    await user.click(screen.getByRole('button', { name: /^Continue$/ }))

    await waitFor(() => {
      expect(screen.getByText("Couldn't save your results. Try again.")).toBeDefined()
    })

    // Button should be re-enabled and selections preserved
    expect(screen.getByRole('button', { name: /^Continue$/ }).hasAttribute('disabled')).toBe(false)

    // Radio buttons should still be checked
    expect(within(q1).getByRole('radio', { name: '3' }).getAttribute('data-state')).toBe('checked')
    expect(within(q2).getByRole('radio', { name: '[4, 16]' }).getAttribute('data-state')).toBe('checked')
    expect(within(q3).getByRole('radio', { name: '35' }).getAttribute('data-state')).toBe('checked')
  })

  it('should disable form during submission', async () => {
    let resolveApiFetch: (value: unknown) => void
    mockApiFetch.mockReturnValue(
      new Promise((resolve) => {
        resolveApiFetch = resolve
      }),
    )
    render(<SkillFloorCheck onComplete={vi.fn()} />)
    const user = userEvent.setup()

    const q1 = screen.getByRole('radiogroup', { name: 'Question 1' })
    const q2 = screen.getByRole('radiogroup', { name: 'Question 2' })
    const q3 = screen.getByRole('radiogroup', { name: 'Question 3' })

    await user.click(within(q1).getByRole('radio', { name: '3' }))
    await user.click(within(q2).getByRole('radio', { name: '[4, 16]' }))
    await user.click(within(q3).getByRole('radio', { name: '35' }))

    await user.click(screen.getByRole('button', { name: /^Continue$/ }))

    await waitFor(() => {
      expect(screen.getByText('Saving...')).toBeDefined()
    })
    expect(screen.getByRole('button', { name: /^Saving\.\.\.$/ }).hasAttribute('disabled')).toBe(true)
    expect(screen.getByRole('button', { name: /^Saving\.\.\.$/ }).getAttribute('aria-disabled')).toBe('true')

    resolveApiFetch!({})
  })

  it('should be keyboard-accessible with aria-labels on radio groups', () => {
    render(<SkillFloorCheck onComplete={vi.fn()} />)

    expect(screen.getByRole('radiogroup', { name: 'Question 1' })).toBeDefined()
    expect(screen.getByRole('radiogroup', { name: 'Question 2' })).toBeDefined()
    expect(screen.getByRole('radiogroup', { name: 'Question 3' })).toBeDefined()
  })
})
