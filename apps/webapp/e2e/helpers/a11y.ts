import type { Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

export interface A11yResult {
  readonly violations: ReadonlyArray<{
    readonly id: string
    readonly impact: string | undefined
    readonly description: string
    readonly nodes: ReadonlyArray<{ readonly html: string }>
  }>
}

/**
 * Run axe-core accessibility scan on a page.
 * Configured for WCAG 2.1 AA compliance.
 *
 * Usage:
 *   const results = await scanPage(page)
 *   expect(results.violations).toEqual([])
 */
export async function scanPage(page: Page): Promise<A11yResult> {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze()

  return {
    violations: results.violations.map((v) => ({
      id: v.id,
      impact: v.impact ?? undefined,
      description: v.description,
      nodes: v.nodes.map((n) => ({ html: n.html })),
    })),
  }
}

/**
 * Format axe violations into a readable string for test output.
 */
export function formatViolations(violations: A11yResult['violations']): string {
  if (violations.length === 0) return 'No accessibility violations found'
  return violations
    .map(
      (v) =>
        `[${v.impact ?? 'unknown'}] ${v.id}: ${v.description}\n` +
        v.nodes.map((n) => `  - ${n.html}`).join('\n')
    )
    .join('\n\n')
}
