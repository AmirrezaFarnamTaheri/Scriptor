import { expect, test } from '@playwright/test'
import { waitForWorkspace, WORKSPACE_CHROME_PREFS } from './helpers'

test.beforeEach(async ({ page }) => {
  await page.addInitScript((prefs) => {
    localStorage.setItem('scriptor:onboarding-complete', 'true')
    localStorage.setItem('scriptor:workspace-chrome', JSON.stringify(prefs))
  }, WORKSPACE_CHROME_PREFS)
  await page.goto('/')
  await waitForWorkspace(page)
})

test('toolbar tools can be removed, resized, reordered and restored after reload', async ({ page }) => {
  await page.getByRole('button', { name: 'Customize toolbar', exact: true }).click()
  const customizer = page.getByRole('dialog', { name: 'Customize toolbar' })
  const row = customizer.locator('.toolbar-customize-row').filter({ hasText: 'Bold' }).first()
  await row.getByRole('checkbox').uncheck()
  // Customization is staged until Apply so Cancel never mutates the live toolbar.
  await expect(page.locator('.toolbar-pinned').getByRole('button', { name: 'Bold', exact: true })).toBeVisible()
  await row.getByRole('checkbox').check()
  await row.getByRole('spinbutton').fill('76')
  await row.getByRole('button', { name: /Move .* earlier/ }).click()
  await customizer.getByRole('button', { name: 'Apply', exact: true }).click()
  await expect(customizer).toBeHidden()
  await expect(page.locator('.toolbar-pinned').getByRole('button', { name: 'Bold', exact: true })).toHaveCSS('width', '76px')
  const savedOrder = await page.locator('.toolbar-pinned .toolbar-tool').evaluateAll((tools) => tools.map((tool) => tool.getAttribute('data-tool-id')))
  await page.reload()
  await waitForWorkspace(page)
  await expect(page.locator('.toolbar-pinned').getByRole('button', { name: 'Bold', exact: true })).toHaveCSS('width', '76px')
  expect(await page.locator('.toolbar-pinned .toolbar-tool').evaluateAll((tools) => tools.map((tool) => tool.getAttribute('data-tool-id')))).toEqual(savedOrder)
})

test('collapsed status dock stays one compact row at narrow widths', async ({ page }) => {
  for (const width of [1440, 1024, 768, 375, 320]) {
    await page.setViewportSize({ width, height: 900 })
    const footer = page.locator('.status-strip')
    await expect(footer).toHaveClass(/is-dock-collapsed/)
    const box = await footer.boundingBox()
    if (box) {
      expect(box.height).toBeLessThanOrEqual(60)
    }
  }
})


test('individual menu actions can be pinned and unpinned groups remain keyboard accessible', async ({ page }) => {
  await page.getByRole('button', { name: 'Customize toolbar', exact: true }).click()
  const customizer = page.getByRole('dialog', { name: 'Customize toolbar' })
  await customizer.getByRole('checkbox', { name: 'Task list item', exact: true }).check()
  await customizer.getByRole('checkbox', { name: 'Insert', exact: true }).uncheck()
  await customizer.getByRole('checkbox', { name: 'Typography', exact: true }).uncheck()
  await customizer.getByRole('button', { name: 'Apply', exact: true }).click()
  await expect(page.locator('.toolbar-pinned').getByRole('button', { name: 'Task list item', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Tools', exact: true }).click()
  await page.getByRole('menuitem', { name: 'Insert', exact: true }).focus()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('menuitem', { name: 'Back to tools', exact: true })).toBeVisible()
  await expect(page.getByRole('menuitem', { name: 'Task list item', exact: true })).toHaveCount(0)
  const insertMenu = page.getByRole('menu', { name: 'Tools', exact: true })
  const firstInsertAction = insertMenu.getByRole('menuitem').filter({ hasNotText: 'Back to tools' }).first()
  await expect(firstInsertAction).toBeEnabled()
  await firstInsertAction.focus()
  await expect(firstInsertAction).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(insertMenu).toHaveCount(0)
  await page.reload()
  await waitForWorkspace(page)
  await expect(page.locator('.toolbar-pinned').getByRole('button', { name: 'Task list item', exact: true })).toBeVisible()
  await expect(page.locator('.toolbar-pinned').getByRole('button', { name: 'Insert', exact: true })).toHaveCount(0)
})

test('toolbar validates persisted widths and ignores duplicate and unknown tools', async ({ page }) => {
  await page.evaluate(() => localStorage.setItem('scriptor:editor-toolbar', JSON.stringify([
    { id: 'bold', pinned: true, width: 9999 },
    { id: 'bold', pinned: false, width: 32 },
    { id: 'italic', pinned: true, width: -10 },
    { id: 'unknown-tool', pinned: true, width: 100 },
  ])))
  await page.reload()
  await waitForWorkspace(page)
  await expect(page.locator('.toolbar-pinned [data-tool-id="bold"]')).toHaveCount(1)
  await expect(page.locator('.toolbar-pinned [data-tool-id="bold"]')).toHaveCSS('width', '240px')
  await expect.poll(() => page.locator('.toolbar-pinned [data-tool-id="italic"]').evaluate((element) => (element as HTMLElement).style.width)).toBe('')
  await expect(page.locator('[data-tool-id="unknown-tool"]')).toHaveCount(0)
  await page.evaluate(() => localStorage.setItem('scriptor:editor-toolbar', '{broken json'))
  await page.reload()
  await waitForWorkspace(page)
  await expect(page.locator('.toolbar-pinned [data-tool-id="bold"]')).toHaveCount(1)
})


test('toolbar tools popover keeps wheel scrolling inside the menu', async ({ page }) => {
  await page.setViewportSize({ width: 1180, height: 420 })
  await page.getByRole('button', { name: 'Tools', exact: true }).click()

  const menu = page.getByRole('menu', { name: 'Tools', exact: true })
  await expect(menu).toBeVisible()
  await expect.poll(() => menu.evaluate((element) => element.scrollHeight > element.clientHeight + 1)).toBe(true)

  await menu.hover()
  await page.mouse.wheel(0, 600)
  await expect.poll(() => menu.evaluate((element) => element.scrollTop)).toBeGreaterThan(0)
  const scrolled = await menu.evaluate((element) => element.scrollTop)

  // Scrolling the portal must not be treated as viewport movement and trigger
  // a reposition pass that resets the menu's own scroll state.
  await page.waitForTimeout(100)
  await expect.poll(() => menu.evaluate((element) => element.scrollTop)).toBeGreaterThanOrEqual(Math.max(1, scrolled - 1))
})

test('toolbar and top-bar customize surfaces retain their own scroll position', async ({ page }) => {
  await page.setViewportSize({ width: 1180, height: 420 })

  await page.getByRole('button', { name: 'Customize toolbar', exact: true }).click()
  const toolbarCustomizer = page.getByRole('dialog', { name: 'Customize toolbar' })
  const toolList = toolbarCustomizer.locator('.toolbar-customizer-list')
  await expect.poll(() => toolList.evaluate((element) => element.scrollHeight > element.clientHeight + 1)).toBe(true)
  await toolList.hover()
  await page.mouse.wheel(0, 500)
  await expect.poll(() => toolList.evaluate((element) => element.scrollTop)).toBeGreaterThan(0)
  await toolbarCustomizer.getByRole('button', { name: 'Cancel', exact: true }).click()

  await page.getByRole('button', { name: 'Customize top bar actions', exact: true }).click()
  const topBarCustomizer = page.getByRole('dialog', { name: 'Customize top bar actions' })
  await expect.poll(() => topBarCustomizer.evaluate((element) => element.scrollHeight > element.clientHeight + 1)).toBe(true)
  await topBarCustomizer.hover()
  await page.mouse.wheel(0, 500)
  await expect.poll(() => topBarCustomizer.evaluate((element) => element.scrollTop)).toBeGreaterThan(0)
  const scrolled = await topBarCustomizer.evaluate((element) => element.scrollTop)
  await page.waitForTimeout(100)
  await expect.poll(() => topBarCustomizer.evaluate((element) => element.scrollTop)).toBeGreaterThanOrEqual(Math.max(1, scrolled - 1))
})
