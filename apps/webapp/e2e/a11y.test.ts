import { test as it, expect } from '@playwright/test'
import { scanPage, formatViolations } from './helpers/a11y'

const describe = it.describe

describe('Accessibility (WCAG 2.1 AA)', () => {
  // TODO(story-2.2): Add login page accessibility test
  // TODO(story-3.5): Add workspace page accessibility test

  it.skip('should have no WCAG 2.1 AA violations on login page', async ({ page }) => {
    // TODO(story-2.2): Implement when login UI exists
    await page.goto('/')
    const results = await scanPage(page)
    expect(results.violations, formatViolations(results.violations)).toEqual([])
  })
})
