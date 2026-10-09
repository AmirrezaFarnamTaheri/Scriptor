import { expect, type Locator, type Page } from '@playwright/test'
import { createRequire } from 'node:module'

const nodeRequire = createRequire(import.meta.url)
const axeScript = createRequire(nodeRequire.resolve('@axe-core/cli')).resolve('axe-core/axe.min.js')

/** Check the actual rendered alert against its composed background. */
export async function expectReadableError(page: Page, alert: Locator) {
  await expect(alert).toBeVisible()
  await page.addScriptTag({ path: axeScript })
  const violations = await alert.evaluate(async element => {
    const axe = (window as Window & { axe: { run: (root: Element, options: unknown) => Promise<{ violations: Array<{ id: string; nodes: Array<{ failureSummary?: string }> }> }> } }).axe
    const result = await axe.run(element, { runOnly: ['color-contrast'] })
    return result.violations.map(violation => ({ id: violation.id, details: violation.nodes.map(node => node.failureSummary) }))
  })
  expect(violations).toEqual([])
}
