import { expect, test } from '@playwright/test'

import { launchApp, openCommandPalette, runCommand, settleLayout } from './helpers'

test.describe('capability surfaces', () => {
  test.beforeEach(async ({ page }) => {
    await launchApp(page)
    await settleLayout(page)
  })

  test('opens the template picker from the registered global command', async ({ page }) => {
    await openCommandPalette(page)
    await runCommand(page, 'New note from template')

    const picker = page.getByRole('dialog', { name: 'Choose template' })
    await expect(picker).toBeVisible()
    await expect(picker.getByRole('option', { name: 'Blank note' })).toBeVisible()
  })

  test('exposes Obsidian import without hiding it in an implementation-only component', async ({ page }) => {
    await openCommandPalette(page)
    await runCommand(page, 'Import Obsidian vault')

    await expect(page.getByRole('dialog', { name: 'Import Obsidian vault' })).toBeVisible()
  })

  test('makes runtime controls and layout presets interactive in the canonical store', async ({ page }) => {
    await page.getByRole('tab', { name: 'Plugins' }).click()

    await page.getByRole('tab', { name: 'Features' }).click()
    const graphServices = page.getByRole('button', { name: 'Toggle Graph background services' })
    await expect(graphServices).toBeEnabled()
    await expect(graphServices).toHaveAttribute('aria-pressed', 'true')

    await page.getByRole('tab', { name: 'Layouts' }).click()
    const zenLayout = page.getByRole('button', { name: 'Apply Zen layout' })
    await expect(zenLayout).toBeEnabled()
    await zenLayout.click()
    await expect(zenLayout).toHaveAttribute('aria-current', 'true')
  })

  test('keeps the four-section store navigable at high text zoom', async ({ page }) => {
    await page.getByRole('tab', { name: 'Plugins' }).click()
    const storeTabs = page.getByRole('tablist', { name: 'Store sections' })

    await page.evaluate(() => {
      document.documentElement.style.fontSize = '200%'
      window.dispatchEvent(new Event('resize'))
    })
    await settleLayout(page)

    // The sections wrap at high zoom; assert reachability rather than a
    // particular scrolling implementation.
    for (const name of ['Plugins', 'MCP', 'Features', 'Layouts']) {
      await expect(storeTabs.getByRole('tab', { name, exact: true })).toBeInViewport()
    }
    const layoutsTab = storeTabs.getByRole('tab', { name: 'Layouts' })
    await layoutsTab.evaluate((element) => element.scrollIntoView({ inline: 'nearest', block: 'nearest' }))
    await layoutsTab.click()
    await expect(page.getByRole('button', { name: 'Apply Zen layout' })).toBeVisible()
  })
})
