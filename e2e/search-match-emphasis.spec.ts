import { expect, test } from '@playwright/test'
import { launchApp } from './helpers'

test('search results visibly emphasize a literal match and preserve inert surrounding text', async ({ page }) => {
  await launchApp(page)
  await page.evaluate(() => {
    const internals = (window as unknown as { __TAURI_INTERNALS__: { invoke(command: string, args?: Record<string, unknown>, options?: unknown): Promise<unknown> } }).__TAURI_INTERNALS__
    const original = internals.invoke.bind(internals)
    internals.invoke = async (command, args = {}, options) => {
      if (command === 'indexer_search') return [{ path: 'Methodology.md', title: 'Methodology', snippet: 'Surrounding context [Methodology] <script>literal()</script> after.', score: 1 }]
      return original(command, args, options)
    }
  })
  await page.getByRole('searchbox', { name: 'Search notes', exact: true }).fill('Methodology')
  const results = page.locator('#dock-panel-search')
  await expect(results).toBeVisible()
  await expect(results.locator('small mark')).toHaveText('Methodology')
  await expect(results.locator('small')).toContainText('Surrounding context')
  await expect(results.locator('small')).toContainText('<script>literal()</script>')
  await expect(results.locator('small script')).toHaveCount(0)
  const cards = results.locator('.dock-list > li')
  await expect(cards).toHaveCount(1)
  const geometry = await cards.first().evaluate(node => {
    const bounds = node.getBoundingClientRect()
    const snippet = node.querySelector('small')!
    return { width: bounds.width, fontSize: Number.parseFloat(getComputedStyle(snippet).fontSize), lineHeight: Number.parseFloat(getComputedStyle(snippet).lineHeight) }
  })
  expect(geometry.width).toBeGreaterThan(230)
  expect(geometry.fontSize).toBeGreaterThanOrEqual(13)
  expect(geometry.lineHeight).toBeGreaterThanOrEqual(19)
})
