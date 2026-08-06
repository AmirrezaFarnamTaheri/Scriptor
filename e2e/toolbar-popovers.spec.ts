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
      const trigger = toolbar.getByRole('button', { name: menuName, exact: true })
      await trigger.focus()
      await page.keyboard.press('ArrowDown')

      const menu = page.getByRole('menu', { name: new RegExp(menuName, 'i') })
      await expect(trigger).toHaveAttribute('aria-expanded', 'true')
      await expect(menu).toBeVisible()
      await expect(menu).toHaveAttribute('data-positioned', 'true')
      await expect(menu).toHaveCSS('position', 'fixed')
      expect(await menu.evaluate((element) => element.parentElement === document.body)).toBe(true)

      const firstItem = menu.getByRole('menuitem').first()
      await expect(firstItem).toBeFocused()

      const menuBox = await menu.boundingBox()
      const triggerBox = await trigger.boundingBox()
      const viewport = page.viewportSize()
      expect(menuBox).not.toBeNull()
      expect(triggerBox).not.toBeNull()
      expect(viewport).not.toBeNull()
      expect(menuBox?.y).toBeGreaterThanOrEqual((triggerBox?.y ?? 0) + (triggerBox?.height ?? 0))
      expect((menuBox?.y ?? 0) + (menuBox?.height ?? 0)).toBeLessThanOrEqual((viewport?.height ?? 0) - 7)

      await page.keyboard.press('End')
      await expect(menu.getByRole('menuitem').last()).toBeFocused()
      await page.keyboard.press('Escape')
      await expect(menu).toBeHidden()
      await expect(trigger).toHaveAttribute('aria-expanded', 'false')
      await expect(trigger).toBeFocused()

      await page.keyboard.press('ArrowDown')
      await expect(menu).toBeVisible()
      await page.keyboard.press('Tab')
      await expect(menu).toBeHidden()
      await expect(trigger).toHaveAttribute('aria-expanded', 'false')
      await expect(toolbar.locator('button:focus')).toHaveCount(1)
      await expect(page.locator('body')).not.toBeFocused()
      await settleLayout(page)
    })
  }
})
