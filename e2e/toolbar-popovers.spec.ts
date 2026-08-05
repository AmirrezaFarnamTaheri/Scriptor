import { expect, test } from '@playwright/test'

import { settleLayout, waitForWorkspace, WORKSPACE_CHROME_PREFS } from './helpers.ts'

test.describe('editor toolbar popovers', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript((chromePrefs) => {
      window.localStorage.setItem('scriptor:app-theme', 'light')
      window.localStorage.setItem('scriptor:onboarding-complete', 'true')
      window.localStorage.setItem('scriptor:editor-mode', 'monaco')
      window.localStorage.setItem('scriptor:workspace-mode', 'writing')
      window.localStorage.setItem('scriptor:workspace-chrome', JSON.stringify(chromePrefs))
    }, WORKSPACE_CHROME_PREFS)
    await page.goto('/', { waitUntil: 'networkidle' })
    await waitForWorkspace(page)
  })

  for (const menuName of ['Typography', 'Insert']) {
    test(`${menuName} menu escapes toolbar clipping and restores keyboard focus`, async ({ page }) => {
      const toolbar = page.locator('.editor-toolbar')
      const trigger = toolbar.getByRole('button', { name: new RegExp(menuName, 'i') })
      await trigger.focus()
      await page.keyboard.press('ArrowDown')

      const menu = page.getByRole('menu', { name: new RegExp(menuName, 'i') })
      await expect(menu).toBeVisible()
      await expect(menu).toHaveCSS('position', 'fixed')
      const firstItem = menu.getByRole('menuitem').first()
      await expect(firstItem).toBeFocused()

      const menuBox = await menu.boundingBox()
      const toolbarBox = await toolbar.boundingBox()
      const viewport = page.viewportSize()
      expect(menuBox).not.toBeNull()
      expect(toolbarBox).not.toBeNull()
      expect(viewport).not.toBeNull()
      expect(menuBox?.y).toBeGreaterThan((toolbarBox?.y ?? 0) + (toolbarBox?.height ?? 0) - 2)
      expect((menuBox?.y ?? 0) + (menuBox?.height ?? 0)).toBeLessThanOrEqual((viewport?.height ?? 0) - 7)

      await page.keyboard.press('End')
      await expect(menu.getByRole('menuitem').last()).toBeFocused()
      await page.keyboard.press('Escape')
      await expect(menu).toBeHidden()
      await expect(trigger).toBeFocused()
      await settleLayout(page)
    })
  }
})
