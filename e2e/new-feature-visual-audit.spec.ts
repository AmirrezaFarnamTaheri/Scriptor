import { test, expect } from '@playwright/test'
import { launchApp, openCommandPalette, runCommand } from './helpers'

test('new review workspaces expose usable geometry, focus and cancellation controls', async ({ page }, testInfo) => {
  await page.addInitScript(() => {
    sessionStorage.setItem('e2e:research', '1')
    sessionStorage.setItem('e2e:asset-media', '1')
  })
  await launchApp(page)
  const measurements: unknown[] = []
  for (const surface of [
    { command: 'Database studio', name: 'Database Studio' },
    { command: 'Capture reviewer', name: 'Capture reviewer' },
    { command: 'Browse bibliography', name: 'Bibliography' },
    { command: 'Asset deck', name: 'Asset deck' },
    { command: 'Publishing studio', name: 'Publishing studio' },
    { command: 'Drive collaboration', name: 'Drive collaboration' },
  ]) {
    await openCommandPalette(page)
    await runCommand(page, surface.command)
    const panel = page.getByRole('dialog', { name: surface.name, exact: true })
    await expect(panel).toBeVisible()
    if (surface.command === 'Drive collaboration') {
      const summary = panel.locator('summary').last()
      const close = panel.getByRole('button', { name: 'Close Drive collaboration', exact: true })
      await summary.focus(); await page.keyboard.press('Tab'); await expect(close).toBeFocused()
      await page.keyboard.press('Shift+Tab'); await expect(summary).toBeFocused()
    }
    for (const direction of ['ltr', 'rtl']) {
      await page.locator('html').evaluate((element, value) => element.setAttribute('dir', value), direction)
      for (const width of [1440, 768, 375, 320]) {
        await page.setViewportSize({ width, height: 900 })
        const geometry = await panel.evaluate(element => {
          const box = element.getBoundingClientRect()
          return { left: box.left, right: box.right, overflow: element.scrollWidth - element.clientWidth, background: getComputedStyle(element).backgroundColor,
            controls: Array.from(element.querySelectorAll('button,input,select')).filter(control => !control.hasAttribute('disabled')).map(control => {
              const rect = control.getBoundingClientRect()
              return { label: control.getAttribute('aria-label') ?? control.textContent?.trim() ?? '', width: rect.width, height: rect.height }
            }).filter(control => control.width > 0 && control.height > 0) }
        })
        measurements.push({ surface: surface.name, direction, width, ...geometry })
        expect(geometry.left).toBeGreaterThanOrEqual(0)
        expect(geometry.right).toBeLessThanOrEqual(width + 1)
        await testInfo.attach(`${surface.name}-${direction}-${width}`, { body: JSON.stringify(geometry, null, 2), contentType: 'application/json' })
        expect.soft(geometry.overflow, `${surface.name} ${direction} ${width}`).toBeLessThanOrEqual(1)
        if (surface.name === 'Asset deck' && width <= 375) {
          const closeTarget = geometry.controls.find(control => control.label === 'Close Asset deck')
          expect(closeTarget?.width).toBeGreaterThanOrEqual(43.9)
          expect(closeTarget?.height).toBeGreaterThanOrEqual(43.9)
          for (const button of await panel.locator('.embedded-panel-shell > header button').all()) {
            const target = await button.boundingBox()
            expect(target?.width).toBeGreaterThanOrEqual(43.9)
            expect(target?.height).toBeGreaterThanOrEqual(43.9)
          }
          const search = await panel.getByRole('searchbox', { name: 'Filter assets', exact: true }).boundingBox()
          expect(search?.height).toBeGreaterThanOrEqual(43.9)
          const checkboxLabel = panel.locator('label:has(input[type="checkbox"])')
          expect((await checkboxLabel.boundingBox())?.height).toBeGreaterThanOrEqual(43.9)
        }
        const beforeFocus = await page.evaluate(() => document.activeElement?.outerHTML.slice(0, 350))
        await page.keyboard.press('Tab')
        const afterFocus = await page.evaluate(() => document.activeElement?.outerHTML.slice(0, 350))
        expect.soft(await panel.evaluate(element => element.contains(document.activeElement)), `${surface.name} ${direction} ${width} Tab: ${beforeFocus} -> ${afterFocus}`).toBe(true)
        const close = panel.getByRole('button', { name: new RegExp('^Close', 'i') }).first()
        if (await close.count()) {
          await close.hover()
          expect.soft(await panel.evaluate(element => element.scrollWidth - element.clientWidth), `${surface.name} hovered close ${direction} ${width}`).toBeLessThanOrEqual(1)
          const tooltip = panel.locator('.unified-panel-header-actions .custom-tooltip').first()
          if (await tooltip.count()) {
            const box = await tooltip.boundingBox()
            if (box) { expect.soft(box.width, `${surface.name} readable tooltip ${direction} ${width}`).toBeGreaterThanOrEqual(80); expect.soft(box.x).toBeGreaterThanOrEqual(0); expect.soft(box.x + box.width).toBeLessThanOrEqual(width + 1) }
          }
        }
        if (width === 320) await panel.screenshot({ path: testInfo.outputPath(`${surface.name.replaceAll(' ', '-')}-${direction}-320.png`) })
      }
    }
    await page.setViewportSize({ width: 768, height: 900 })
    await page.locator('html').evaluate(element => { element.style.zoom = '2' })
    await page.keyboard.press('Escape')
    await expect(panel).toHaveCount(0)
    await page.locator('html').evaluate(element => { element.style.zoom = '1'; element.dir = 'ltr' })
    await page.setViewportSize({ width: 1440, height: 900 })
  }
  await testInfo.attach('new-workspace-measurements', { body: JSON.stringify(measurements, null, 2), contentType: 'application/json' })
  console.log(JSON.stringify(measurements.map(value => {
    const row = value as { surface: string; direction: string; width: number; overflow: number; controls: Array<{label: string; height: number; width: number}> }
    return { surface: row.surface, direction: row.direction, width: row.width, overflow: row.overflow, smallControls: row.controls.filter(control => control.height < 44 || control.width < 44) }
  })))
})
