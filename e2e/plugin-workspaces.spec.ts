import { expect, test, type Page } from '@playwright/test'
import { launchApp, openCommandPalette, runCommand } from './helpers'

async function openManager(page: Page) {
  await openCommandPalette(page)
  await runCommand(page, 'Open built-in modules')
  const manager = page.getByRole('dialog', { name: 'Built-in modules', exact: true })
  await expect(manager).toBeVisible()
  await manager.getByRole('searchbox').fill('Runtime workspace overview')
  return manager
}

test('module workspace launch remains disabled without reviewed consent', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('scriptor:plugins:consent', JSON.stringify({ schemaVersion: 1, savedAt: new Date().toISOString(), data: {} })))
  await launchApp(page)
  const manager = await openManager(page)
  await expect(manager.getByRole('button', { name: 'Open Runtime workspace overview', exact: true })).toBeDisabled()
  await expect(manager.getByText('Review this plugin’s permissions in the marketplace first.', { exact: true })).toBeVisible()
})

test('reviewed module opens its registered workspace and disabling revokes launch immediately', async ({ page }, testInfo) => {
  await page.addInitScript(() => localStorage.setItem('scriptor:plugins:consent', JSON.stringify({
    schemaVersion: 1, savedAt: new Date().toISOString(), data: {
      'scriptor.runtime-console': { grantedPermissions: ['read'], allowedVaultIds: ['screenshot-vault'], networkAccess: 'blocked', allowlistedHosts: [], reviewedAt: new Date().toISOString() },
    },
  })))
  await launchApp(page)
  let manager = await openManager(page)
  const toggle = manager.getByRole('button', { name: 'Toggle Runtime workspace overview', exact: true })
  await expect(toggle).toHaveAttribute('aria-pressed', 'false')
  await toggle.click()
  await expect(toggle).toHaveAttribute('aria-pressed', 'true')
  await expect(manager.getByRole('button', { name: 'Open Runtime workspace overview', exact: true })).toBeEnabled()
  await manager.getByRole('button', { name: 'Open Runtime workspace overview', exact: true }).click()
  await expect(manager).not.toBeVisible()
  const overview = page.getByRole('region', { name: 'Runtime workspace overview', exact: true })
  await expect(overview.getByRole('heading', { name: 'Runtime workspace overview', exact: true })).toHaveCount(1)
  await expect(overview.getByRole('heading', { name: 'Runtime workspace overview', exact: true })).toBeVisible()
  await expect(overview.locator('.plugin-workspace > header')).toHaveCount(0)
  for (const appearance of ['light', 'dark']) for (const direction of ['ltr', 'rtl']) for (const width of [1440, 375, 320]) {
    await page.setViewportSize({ width, height: 900 })
    await page.locator('html').evaluate((element, values) => { element.dir = values.direction; element.setAttribute('data-appearance', values.appearance) }, { direction, appearance })
    const boxes = await overview.evaluate(element => {
      const title = element.querySelector('.unified-panel-header h2')!
      const description = element.querySelector('.plugin-workspace-description')!
      return { title: title.getBoundingClientRect().toJSON(), titleWidth: title.parentElement!.getBoundingClientRect().width, description: description.getBoundingClientRect().toJSON(), body: description.parentElement!.getBoundingClientRect().toJSON(), overflow: element.scrollWidth - element.clientWidth }
    })
    expect(boxes.title.width).toBeGreaterThanOrEqual(boxes.titleWidth - 1)
    expect(boxes.description.x).toBeGreaterThanOrEqual(boxes.body.x)
    expect(boxes.description.right).toBeLessThanOrEqual(boxes.body.right + 1)
    expect(boxes.overflow).toBeLessThanOrEqual(1)
    await overview.screenshot({ path: testInfo.outputPath(`overview-${appearance}-${direction}-${width}.png`) })
  }
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.locator('html').evaluate(element => { element.dir = 'ltr'; element.setAttribute('data-appearance', 'light') })
  await overview.getByRole('button', { name: 'Return to writing', exact: true }).click()
  await expect(overview).toHaveCount(0)
  manager = await openManager(page)
  const enabledToggle = manager.getByRole('button', { name: 'Toggle Runtime workspace overview', exact: true })
  await enabledToggle.click()
  await expect(enabledToggle).toHaveAttribute('aria-pressed', 'false')
  await expect(manager.getByRole('button', { name: 'Open Runtime workspace overview', exact: true })).toBeDisabled()
  await expect(manager.getByText('Plugin is disabled.', { exact: true })).toBeVisible()
})

test('safe mode explains why module workspaces cannot open', async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem('scriptor.plugins.safeMode', 'true'))
  await launchApp(page)
  const manager = await openManager(page)
  await expect(manager.getByRole('button', { name: 'Open Runtime workspace overview', exact: true })).toBeDisabled()
  await expect(manager.getByText('Plugin workspaces are unavailable in safe mode.', { exact: true })).toBeVisible()
})
