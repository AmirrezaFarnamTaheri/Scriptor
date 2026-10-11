import { expect, test } from '@playwright/test'
import { closeWorkspacePanel, launchApp, openCommandPalette, runCommand } from './helpers'

for (const direction of ['ltr', 'rtl']) for (const width of [320, 375]) for (const steps of [8, 12]) {
  test(`app zoom keeps workspace chrome reachable at ${width} ${direction} with ${steps} zoom steps`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 1100 })
    await page.addInitScript(() => { sessionStorage.setItem('e2e:research', '1'); sessionStorage.setItem('e2e:asset-media', '1') })
    await launchApp(page)
    await page.evaluate(() => {
      const api = (window as Window & { __TAURI_INTERNALS__?: { invoke?: (command: string, args?: Record<string, unknown>, options?: unknown) => Promise<unknown> } }).__TAURI_INTERNALS__
      if (!api?.invoke) throw new Error('Native fixture unavailable')
      const original = api.invoke
      api.invoke = (command, args, options) => command.includes('webview_zoom')
        ? Promise.reject(new Error('Browser fixture uses the application CSS zoom fallback'))
        : original(command, args, options)
    })
    await page.locator('html').evaluate((element, value) => { element.dir = value }, direction)
    await page.keyboard.press('Control+0')
    for (let index = 0; index < steps; index++) await page.keyboard.press('Control+=')
    await expect(page.locator('html')).toHaveAttribute('data-ui-zoom', 'high')
    await expect.poll(() => page.evaluate(() => Number.parseFloat(document.body.style.zoom))).toBeGreaterThanOrEqual(2)
    await openCommandPalette(page)
    await runCommand(page, 'Asset deck')
    const panel = page.locator('.asset-deck-workspace[role="region"]')
    await expect(panel).toBeVisible()
    const layout = await page.evaluate(() => ({
      documentOverflow: document.documentElement.scrollWidth - window.innerWidth,
      topOverflow: document.querySelector('header.topbar')!.scrollWidth - document.querySelector('header.topbar')!.clientWidth,
    }))
    expect(layout.documentOverflow).toBeLessThanOrEqual(1)
    expect(layout.topOverflow).toBeLessThanOrEqual(1)
    const actions = page.locator('.workspace-leaf-compact-actions summary[aria-label="Actions for Asset deck"]')
    await actions.click()
    await expect(page.locator('.workspace-leaf-compact-actions[open]').getByRole('button', { name: 'Move tab to main workspace', exact: true })).toBeVisible()
    const menu = page.locator('.workspace-leaf-compact-actions[open] .workspace-leaf-compact-menu')
    const menuBox = (await menu.boundingBox())!
    expect(menuBox.x).toBeGreaterThanOrEqual(0)
    expect(menuBox.x + menuBox.width).toBeLessThanOrEqual(width + 1)
    expect(await menu.evaluate(element => {
      const canvas = document.createElement('canvas')
      canvas.width = canvas.height = 1
      const context = canvas.getContext('2d')!
      context.fillStyle = getComputedStyle(element).backgroundColor
      context.fillRect(0, 0, 1, 1)
      return context.getImageData(0, 0, 1, 1).data[3]
    })).toBe(255)
    await page.keyboard.press('Escape')
    await expect(page.locator('.workspace-leaf-compact-actions[open]')).toHaveCount(0)
    await expect(actions).toBeFocused()
    const body = panel.locator('.unified-panel-body').first()
    expect((await body.boundingBox())!.height).toBeGreaterThanOrEqual(250)
    await expect(page.getByRole('button', { name: 'Close Asset deck', exact: true })).toHaveCount(1)
    expect((await page.locator('header.topbar').boundingBox())!.height).toBeLessThanOrEqual(300)
    const filter = panel.getByRole('searchbox', { name: 'Filter assets', exact: true })
    await filter.scrollIntoViewIfNeeded()
    await filter.fill('pixel')
    await expect(filter).toHaveValue('pixel')
    const field = (await filter.boundingBox())!
    const visibleBody = (await body.boundingBox())!
    expect(field.y).toBeGreaterThanOrEqual(visibleBody.y)
    expect(field.y + field.height).toBeLessThanOrEqual(visibleBody.y + visibleBody.height + 1)
    const toggle = panel.getByRole('checkbox', { name: 'Unused assets only', exact: true })
    const text = toggle.locator('..').locator('span')
    expect(await text.evaluate(element => {
      const node = element.firstChild!
      const word = document.createRange()
      word.setStart(node, 0)
      word.setEnd(node, 'Unused'.length)
      return word.getClientRects().length
    })).toBe(1)
    await toggle.scrollIntoViewIfNeeded()
    await toggle.check()
    await expect(toggle).toBeChecked()
    const navigation = page.getByRole('navigation', { name: 'Mobile workspace navigation', exact: true })
    const buttons = await navigation.getByRole('button').all()
    const boxes = await Promise.all(buttons.map(button => button.boundingBox()))
    for (const [index, box] of boxes.entries()) {
      expect(box).not.toBeNull()
      expect(box!.x).toBeGreaterThanOrEqual(0)
      expect(box!.x + box!.width).toBeLessThanOrEqual(width + 1)
      expect(box!.width).toBeGreaterThanOrEqual(44)
      expect(box!.height).toBeGreaterThanOrEqual(44)
      await expect(buttons[index]).toHaveAccessibleName(/\S/)
      for (const other of boxes.slice(index + 1)) {
        const intersects = box!.x < other!.x + other!.width - 1 && other!.x < box!.x + box!.width - 1
          && box!.y < other!.y + other!.height - 1 && other!.y < box!.y + box!.height - 1
        expect(intersects).toBe(false)
      }
    }
    await page.screenshot({ path: testInfo.outputPath(`app-zoom-${width}-${direction}.png`), fullPage: true })
    await closeWorkspacePanel(page, panel)
    await expect(panel).toHaveCount(0)
  })
}
