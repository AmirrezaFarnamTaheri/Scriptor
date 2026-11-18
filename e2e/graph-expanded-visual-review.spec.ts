import { expect, test } from '@playwright/test'
import { launchApp, openCommandPalette, runCommand, settleLayout, waitForWorkspace } from './helpers'

/**
 * VIS-Graph-160: focused-graph acceptance does not establish that the full
 * 120-note/160-edge network is usable. Record the expanded canvas separately
 * without replacing the approved three-neighbor capture.
 */
test('dense Knowledge Graph includes an explicit all-160-links screenshot', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.addInitScript(() => {
    sessionStorage.setItem('e2e:dense-graph', '1')
  })
  await launchApp(page)
  await waitForWorkspace(page, { allowHiddenVaultList: true })
  await openCommandPalette(page)
  await runCommand(page, 'Open graph')

  const graph = page.getByRole('dialog', { name: 'Knowledge graph', exact: true })
  await expect(graph).toBeVisible()
  await expect(graph.locator('.graph-header')).toContainText('120 nodes')
  const view = graph.getByRole('combobox', { name: 'View' })
  await expect(view.locator('option:checked')).toHaveText('Connected notes')

  const expanded = graph.getByRole('button', { name: 'Show all links', exact: true })
  await expanded.click()
  await expect(graph.locator('.graph-focus-hint')).toBeHidden()
  await expect(view.locator('option:checked')).toHaveText('Nearby notes (2 steps)')
  await expect(graph.getByRole('button', { name: 'Highlight connected links', exact: true })).toHaveAttribute('aria-pressed', 'false')

  const canvas = graph.locator('.graph-canvas-accessible-shell canvas')
  await expect(canvas).toBeVisible({ timeout: 15_000 })
  await expect(canvas).toHaveAttribute('aria-label', /120 notes and 160 links/)
  await expect.poll(() => canvas.evaluate(element => (element as HTMLCanvasElement).width)).toBeGreaterThan(500)
  await settleLayout(page)
  await expect.poll(() => page.evaluate(() =>
    document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )).toBeLessThanOrEqual(1)
  await page.screenshot({
    path: test.info().outputPath('visual-graph-dense-120-all-links.png'),
    fullPage: false,
    animations: 'disabled',
    caret: 'hide',
  })
})
