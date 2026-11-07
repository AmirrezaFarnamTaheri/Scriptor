import { expect, test } from '@playwright/test'
import { launchApp, waitForWorkspace } from './helpers'

test.describe('Compact writing chrome', () => {
  test('co-locates workspace navigation with note tabs in two rows without losing routes', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await launchApp(page)
    await waitForWorkspace(page)

    const writing = page.locator('.workspace-writing-leaf')
    const tabs = writing.locator('.tabs-row')
    const shortcuts = tabs.getByRole('navigation', { name: 'Workspaces', exact: true })
    await expect(tabs).toBeVisible()
    await expect(shortcuts).toBeVisible()
    await expect(page.locator('.workspace-leaf-dock > .workspace-activity-bar')).toHaveCount(0)
    await expect(tabs.getByRole('tab', { name: 'Research Plan', selected: true })).toBeVisible()

    const compact = shortcuts.getByRole('button', { name: 'Workspaces', exact: true })
    await expect(compact).toHaveAttribute('aria-haspopup', 'menu')
    await compact.click()
    const menu = page.getByRole('menu', { name: 'Workspaces', exact: true })
    for (const name of ['Writing', 'Source file', 'Note preview']) {
      await expect(menu.getByRole('menuitem', { name, exact: true })).toBeVisible()
    }
    await page.keyboard.press('Escape')
    await expect(compact).toBeFocused()

    const geometry = await page.evaluate(() => {
      const row = document.querySelector('.workspace-writing-leaf .tabs-row')!.getBoundingClientRect()
      const tools = document.querySelector('.workspace-writing-leaf .editor-toolbar-wrapper')!.getBoundingClientRect()
      const nav = document.querySelector('.workspace-writing-leaf .workspace-shortcut-bar')!.getBoundingClientRect()
      return {
        combinedHeight: tools.bottom - row.top,
        adjacent: Math.abs(tools.top - row.bottom),
        navFits: nav.top >= row.top - 1 && nav.bottom <= row.bottom + 1,
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      }
    })
    expect(geometry.combinedHeight).toBeLessThanOrEqual(112)
    expect(geometry.adjacent).toBeLessThanOrEqual(1)
    expect(geometry.navFits).toBe(true)
    expect(geometry.overflow).toBeLessThanOrEqual(1)

    await compact.click()
    await menu.getByRole('menuitem', { name: 'Note preview', exact: true }).click()
    await expect(page.locator('.workspace-leaf-content.secondary .workspace-note-preview')).toBeVisible()
  })

  test('RTL writing chrome and mobile remain bounded and keyboard reachable', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 })
    await page.addInitScript(() => localStorage.setItem('scriptor:locale', 'fa'))
    await launchApp(page)
    await waitForWorkspace(page)
    const tabs = page.locator('.workspace-writing-leaf .tabs-row')
    const bar = tabs.getByRole('navigation', { name: 'فضاهای کاری', exact: true })
    await expect(bar).toBeVisible()
    const menuButton = bar.getByRole('button', { name: 'فضاهای کاری', exact: true })
    await menuButton.focus()
    await menuButton.press('ArrowDown')
    await expect(page.getByRole('menuitem', { name: 'فایل منبع', exact: true })).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(menuButton).toBeFocused()
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1)

    await page.setViewportSize({ width: 320, height: 720 })
    await expect(page.locator('.workspace-activity-bar.is-default-layout')).toBeHidden()
    await expect(tabs.getByRole('tab', { name: /Research Plan|طرح/, selected: true })).toBeVisible()
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1)
  })
})
