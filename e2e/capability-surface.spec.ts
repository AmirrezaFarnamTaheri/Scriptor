import { expect, test } from '@playwright/test'

import { launchApp, openCommandPalette, runCommand, settleLayout } from './helpers'

test.describe('capability surfaces', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('scriptor:workspace-chrome', JSON.stringify({ schemaVersion: 1, data: { inspectorCollapsed: false } })))
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
    await page.getByRole('tab', { name: 'Tools' }).click()

    await page.getByRole('tab', { name: 'Features' }).click()
    const graphServices = page.getByRole('button', { name: 'Toggle Graph background services' })
    await expect(graphServices).toBeEnabled()
    await expect(graphServices).toHaveAttribute('aria-pressed', 'true')

    await page.getByRole('tab', { name: 'Layouts' }).click()
    await page.getByRole('radio', { name: 'Zen', exact: true }).check()
    const zenLayout = page.getByRole('button', { name: 'Apply Zen layout template' })
    await expect(zenLayout).toBeEnabled()
    await zenLayout.click()
    await expect(page.locator('html')).toHaveClass(/scriptor-distraction-free/)
    const editorToolbar = page.locator('.editor-toolbar')
    await expect(editorToolbar).toHaveCSS('pointer-events', 'auto')
    await expect(editorToolbar).toHaveCSS('opacity', '0.55')
    await editorToolbar.getByRole('button').first().focus()
    await expect(editorToolbar).toHaveCSS('opacity', '1')
  })

  test('layout selection previews a distinct workspace before one Apply action', async ({ page }) => {
    await page.getByRole('tab', { name: 'Tools' }).click()
    await page.getByRole('tab', { name: 'Layouts' }).click()
    const choices = page.getByRole('radio')
    await expect(choices).toHaveCount(8)
    const researcher = page.getByRole('radio', { name: 'Researcher' })
    await researcher.check()
    await expect(researcher).toBeChecked()
    await expect(page.getByRole('img', { name: /Researcher layout preview:/ })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Apply Researcher layout template' })).toBeEnabled()
    await expect(page.getByRole('button', { name: /^Apply .* layout template$/ })).toHaveCount(1)
  })

  test('layout galleries have separate native radio groups for Store and Settings', async ({ page }) => {
    await page.getByRole('tab', { name: 'Tools' }).click()
    await page.getByRole('tab', { name: 'Layouts' }).click()
    const storeGallery = page.locator('.store-root .settings-layout-presets')
    await expect(storeGallery).toBeVisible()
    const storeName = await storeGallery.getByRole('radio', { name: 'Zen', exact: true }).getAttribute('name')
    expect(storeName).toBeTruthy()

    await page.locator('header.topbar').getByRole('button', { name: 'Settings' }).click()
    const settings = page.getByRole('dialog', { name: 'Settings' })
    await expect(settings).toBeVisible()
    await settings.getByRole('tab', { name: 'Workspace', exact: true }).click()
    const settingsGallery = settings.locator('.settings-layout-presets')
    await expect(settingsGallery).toBeVisible()
    const settingsName = await settingsGallery.getByRole('radio', { name: 'Zen', exact: true }).getAttribute('name')
    expect(settingsName).toBeTruthy()
    expect(settingsName).not.toBe(storeName)
  })

  test('keeps populated knowledge repair rows separated at 200% text zoom', async ({ page }) => {
    await page.evaluate(() => window.sessionStorage.setItem('e2e:knowledge-repair-notes', '1'))
    await page.reload()
    await settleLayout(page)
    await page.evaluate(() => {
      document.documentElement.style.fontSize = '200%'
      window.dispatchEvent(new Event('resize'))
    })

    await openCommandPalette(page)
    await runCommand(page, 'Explore notes')
    const workbench = page.getByRole('dialog', { name: 'Explore notes' })
    const rows = workbench.locator('.virtual-knowledge-list > li')
    await expect(rows).toHaveCount(3)
    await expect.poll(async () => rows.first().evaluate((row) => row.getBoundingClientRect().height)).toBeGreaterThanOrEqual(140)
    const boxes = await rows.evaluateAll((items) => items.map((item) => {
      const box = item.getBoundingClientRect()
      return { top: box.top, bottom: box.bottom }
    }))
    for (let index = 1; index < boxes.length; index += 1) {
      expect(boxes[index]!.top).toBeGreaterThanOrEqual(boxes[index - 1]!.bottom)
    }
    await expect(workbench.getByText('daily/2026-08-26.md')).toBeVisible()
  })

  test('keeps the four-section store navigable at high text zoom', async ({ page }) => {
    await page.getByRole('tab', { name: 'Tools' }).click()
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
    await expect(page.getByRole('radio', { name: 'Zen', exact: true })).toBeVisible()
  })
})
