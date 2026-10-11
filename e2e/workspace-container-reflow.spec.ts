import { expect, test, type Locator } from '@playwright/test'
import { launchApp, openCommandPalette, runCommand } from './helpers'

const surfaces = [
  { command: 'Asset deck', name: 'Asset deck', grid: '.asset-deck-split.has-reader', breakpoint: 800 },
  { command: 'Diagram studio', name: 'Diagram studio', grid: '.research-split', breakpoint: 768 },
  { command: 'Capture reviewer', name: 'Capture reviewer', grid: '.capture-reviewer-split', breakpoint: 768 },
] as const

async function layout(grid: Locator) {
  return grid.evaluate(element => {
    const bounds = element.getBoundingClientRect()
    const children = [...element.children].map(child => child.getBoundingClientRect())
    return {
      clientWidth: element.clientWidth, scrollWidth: element.scrollWidth,
      left: bounds.left, right: bounds.right,
      first: { left: children[0].left, top: children[0].top, bottom: children[0].bottom },
      second: { left: children[1].left, top: children[1].top },
    }
  })
}

for (const surface of surfaces) {
  test(`${surface.command} reflows against its pane while the desktop window stays wide`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.addInitScript(() => {
      sessionStorage.setItem('e2e:research', '1')
      sessionStorage.setItem('e2e:asset-media', '1')
    })
    await launchApp(page)
    await openCommandPalette(page)
    await runCommand(page, surface.command)
    const panel = surface.name === 'Asset deck'
      ? page.locator('.asset-deck-workspace[role="region"]')
      : page.getByRole('region', { name: surface.name, exact: true })
    await expect(panel).toBeVisible()
    if (surface.name === 'Asset deck') {
      await panel.locator('.research-asset-list > li').filter({ hasText: 'assets/pixel.png' }).getByRole('button', { name: 'Open source', exact: true }).click()
      await expect(panel.getByRole('img', { name: 'Vault source: assets/pixel.png', exact: true })).toBeVisible()
    }
    if (surface.name === 'Capture reviewer') {
      await panel.getByLabel('Article URL', { exact: true }).fill('https://example.org/article')
      await panel.getByRole('button', { name: 'Extract preview', exact: true }).click()
      await expect(panel.getByRole('textbox', { name: 'Reviewed Markdown', exact: true })).toHaveValue(/useful research/)
    }
    const grid = panel.locator(surface.grid)
    await expect(grid).toBeVisible()
    await expect(page.locator('.editor-panel[data-help-topic="editor"]')).toBeVisible()
    // Both window sizes exceed the old viewport breakpoint. Only the actual
    // pane width should decide whether these two bodies stack.
    for (const width of [1440, 2800]) {
      await page.setViewportSize({ width, height: 900 })
      await expect.poll(async () => {
        const current = await layout(grid)
        return width === 1440
          ? current.clientWidth <= surface.breakpoint
          : current.clientWidth > surface.breakpoint
      }).toBe(true)
      await expect.poll(async () => {
        const current = await layout(grid)
        return width === 1440
          ? current.second.top >= current.first.bottom - 1
          : Math.abs(current.second.top - current.first.top) <= 1
      }).toBe(true)
      const current = await layout(grid)
      expect(current.scrollWidth).toBeLessThanOrEqual(current.clientWidth + 1)
      const parent = await panel.boundingBox()
      expect(current.left).toBeGreaterThanOrEqual(parent!.x - 1)
      expect(current.right).toBeLessThanOrEqual(parent!.x + parent!.width + 1)
      await panel.screenshot({ path: testInfo.outputPath(`${surface.command.replaceAll(' ', '-')}-window-${width}.png`), animations: 'disabled' })
    }
  })
}
