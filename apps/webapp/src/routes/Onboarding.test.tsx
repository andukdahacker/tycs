import { describe, it, expect, vi, afterEach, beforeAll } from 'vitest'
import { render, screen, waitFor, cleanup, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router'

// Radix UI Select requires these DOM APIs that jsdom doesn't provide
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
vi.mock('../lib/api-fetch', () => ({
  apiFetch: (...args: unknown[]) => mockApiFetch(...args),
  ApiError: class ApiError extends Error {
    readonly status: number
    readonly code: string
    constructor(status: number, code: string, message: string) {
      super(message)
      this.status = status
      this.code = code
    }
  },
}))

const mockCurrentUser = {
  email: 'test@example.com',
  displayName: 'Test User',
}
vi.mock('../lib/firebase', () => ({
  auth: {
    get currentUser() {
      return mockCurrentUser
    },
  },
}))

const { Onboarding } = await import('./Onboarding')

function renderOnboarding(): ReturnType<typeof render> {
  return render(
    <MemoryRouter initialEntries={['/onboarding']}>
      <Routes>
        <Route path="/onboarding" element={<Onboarding />} />
        <Route path="/overview" element={<div>Overview Page</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

async function selectOption(triggerName: string, optionName: string): Promise<void> {
  const trigger = screen.getByRole('combobox', { name: triggerName })
  // Radix UI Select opens on pointerDown with specific event properties
  fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false, pointerType: 'mouse' })
  const option = await screen.findByRole('option', { name: optionName })
  fireEvent.click(option)
}

describe('Onboarding', () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('should render three select dropdowns for role, experience, and language', () => {
    renderOnboarding()

    expect(screen.getByRole('combobox', { name: 'Your role' })).toBeDefined()
    expect(screen.getByRole('combobox', { name: 'Your experience level' })).toBeDefined()
    expect(screen.getByRole('combobox', { name: 'Your primary programming language' })).toBeDefined()
  })

  it('should disable Continue button until all selects have values', async () => {
    renderOnboarding()

    const button = screen.getByRole('button', { name: /^Continue$/ })
    expect(button.hasAttribute('disabled')).toBe(true)

    await selectOption('Your role', 'Backend Engineer')
    expect(button.hasAttribute('disabled')).toBe(true)

    await selectOption('Your experience level', '1-3 years')
    expect(button.hasAttribute('disabled')).toBe(true)

    await selectOption('Your primary programming language', 'Go')
    expect(button.hasAttribute('disabled')).toBe(false)
  })

  it('should submit onboarding data and navigate to overview on success', async () => {
    mockApiFetch.mockResolvedValue({
      id: 'test-uid',
      email: 'test@example.com',
      displayName: 'Test User',
      role: 'backend-engineer',
      experienceLevel: '1-to-3',
      primaryLanguage: 'go',
      onboardingCompletedAt: '2026-02-28T00:00:00.000Z',
      createdAt: '2026-02-28T00:00:00.000Z',
      updatedAt: '2026-02-28T00:00:00.000Z',
    })
    renderOnboarding()
    const user = userEvent.setup()

    await selectOption('Your role', 'Backend Engineer')
    await selectOption('Your experience level', '1-3 years')
    await selectOption('Your primary programming language', 'Go')
    await user.click(screen.getByRole('button', { name: /^Continue$/ }))

    await waitFor(() => {
      expect(screen.getByText('Overview Page')).toBeDefined()
    })

    expect(mockApiFetch).toHaveBeenCalledWith('/api/account/onboarding', {
      method: 'POST',
      body: JSON.stringify({
        email: 'test@example.com',
        displayName: 'Test User',
        role: 'backend-engineer',
        experienceLevel: '1-to-3',
        primaryLanguage: 'go',
      }),
    })
  })

  it('should display error message on submission failure', async () => {
    mockApiFetch.mockRejectedValue(new Error('Network error'))
    renderOnboarding()
    const user = userEvent.setup()

    await selectOption('Your role', 'Student')
    await selectOption('Your experience level', 'Less than 1 year')
    await selectOption('Your primary programming language', 'Python')
    await user.click(screen.getByRole('button', { name: /^Continue$/ }))

    await waitFor(() => {
      expect(screen.getByText("Couldn't save preferences, try again.")).toBeDefined()
    })
  })

  it('should preserve selections on submission failure', async () => {
    mockApiFetch.mockRejectedValue(new Error('Network error'))
    renderOnboarding()
    const user = userEvent.setup()

    await selectOption('Your role', 'Student')
    await selectOption('Your experience level', 'Less than 1 year')
    await selectOption('Your primary programming language', 'Python')
    await user.click(screen.getByRole('button', { name: /^Continue$/ }))

    await waitFor(() => {
      expect(screen.getByText("Couldn't save preferences, try again.")).toBeDefined()
    })

    // Button should be re-enabled after failure (selections preserved)
    expect(screen.getByRole('button', { name: /^Continue$/ }).hasAttribute('disabled')).toBe(false)
  })

  it('should disable form during submission', async () => {
    let resolveApiFetch: (value: unknown) => void
    mockApiFetch.mockReturnValue(
      new Promise((resolve) => {
        resolveApiFetch = resolve
      }),
    )
    renderOnboarding()
    const user = userEvent.setup()

    await selectOption('Your role', 'Backend Engineer')
    await selectOption('Your experience level', '1-3 years')
    await selectOption('Your primary programming language', 'Go')
    await user.click(screen.getByRole('button', { name: /^Continue$/ }))

    await waitFor(() => {
      expect(screen.getByText('Saving...')).toBeDefined()
    })
    expect(screen.getByRole('button', { name: /^Saving\.\.\.$/ }).hasAttribute('disabled')).toBe(true)
    expect(screen.getByRole('button', { name: /^Saving\.\.\.$/ }).getAttribute('aria-disabled')).toBe('true')

    resolveApiFetch!({})
  })

  it('should send current user email and displayName in request body', async () => {
    mockApiFetch.mockResolvedValue({})
    renderOnboarding()
    const user = userEvent.setup()

    await selectOption('Your role', 'Other')
    await selectOption('Your experience level', '5+ years')
    await selectOption('Your primary programming language', 'Rust')
    await user.click(screen.getByRole('button', { name: /^Continue$/ }))

    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalled()
    })

    const callArgs = mockApiFetch.mock.calls[0] as [string, { body: string }]
    const callBody = JSON.parse(callArgs[1].body) as Record<string, unknown>
    expect(callBody.email).toBe('test@example.com')
    expect(callBody.displayName).toBe('Test User')
  })
})
