import { expect, test } from '@playwright/test'
import { launchApp, openCommandPalette, runCommand } from './helpers'

for (const result of ['healthy', 'issues'] as const) {
  for (const focus of ['intro', 'close'] as const) {
    test(`delayed ${result} diagnostics preserve ${focus} focus`, async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 900 })
      await page.addInitScript(outcome => {
        localStorage.setItem('scriptor:ui-zoom', '2')
        sessionStorage.setItem('e2e:hold-health-diagnostics', '1')
        sessionStorage.setItem('e2e:health-diagnostics-result', outcome)
      }, result)
      await launchApp(page)
      await expect.poll(() => page.evaluate(() => sessionStorage.getItem('e2e:health-diagnostics-pending'))).toBe('1')
      await expect.poll(() => page.evaluate(() => Number(document.body.style.zoom))).toBe(2)
      await expect.poll(() => page.evaluate(() => document.body.style.getPropertyValue('--app-viewport-height').replace(/\s/g, ''))).toBe('calc(100dvh/2)')

      // Startup diagnostics run in the background after the workspace becomes
      // ready, so the real dashboard can open before the bridge response arrives.
      await openCommandPalette(page)
      await runCommand(page, 'Open vault health')
      const panel = page.getByRole('dialog', { name: 'Vault health', exact: true })
      const intro = panel.locator('.health-intro')
      const close = panel.getByRole('button', { name: /^Close/i })
      await expect(intro).toContainText('Vault diagnostics have not loaded yet.')
      await expect(intro).toBeFocused()
      if (focus === 'close') {
        await page.keyboard.press('Tab')
        await expect(close).toBeFocused()
      }

      await page.evaluate(() => window.dispatchEvent(new Event('e2e:release-health-diagnostics')))
      await expect(intro).toContainText(result === 'healthy' ? 'Vault looks healthy' : '1 issue')
      await expect(focus === 'intro' ? intro : close).toBeFocused()
      await expect.poll(() => panel.locator('.unified-panel-body').evaluate(element => element.scrollTop)).toBe(0)
      await expect(panel.locator('.health-metrics .metric')).toHaveCount(9)
      if (result === 'issues') await expect(intro.getByRole('button')).toContainText('Research Plan.md')
      await page.keyboard.press('Escape')
      await expect(panel).toHaveCount(0)
    })
  }
}
