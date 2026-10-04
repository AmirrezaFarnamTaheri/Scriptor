import { expect, test, type Locator, type Page } from '@playwright/test'
import { launchApp, openCommandPalette, runCommand } from './helpers'

async function tabGeometry(tab: Locator) {
  return tab.evaluate(element => {
    const rectangle = (target: Element) => {
      const box = target.getBoundingClientRect()
      return { left: box.left, right: box.right, top: box.top, bottom: box.bottom, centerY: (box.top + box.bottom) / 2 }
    }
    const parent = rectangle(element)
    const main = rectangle(element.querySelector('.tab-main > svg')!)
    const title = rectangle(element.querySelector('.tab-title')!)
    const pin = rectangle(element.querySelector('.tab-pin > svg')!)
    const close = rectangle(element.querySelector('.tab-close > svg')!)
    const rtl = getComputedStyle(element).direction === 'rtl'
    const scale = (parent.bottom - parent.top) / (element as HTMLElement).offsetHeight
    return {
      centers: [main, title, pin, close].map(item => Math.abs(item.centerY - parent.centerY) / scale),
      leadingInset: (rtl ? parent.right - main.right : main.left - parent.left) / scale,
      closingInset: (rtl ? close.left - parent.left : parent.right - close.right) / scale,
      controlGap: (rtl ? pin.left - close.right : close.left - pin.right) / scale,
      titleGap: (rtl ? title.left - pin.right : pin.left - title.right) / scale,
      controls: [...element.querySelectorAll<HTMLButtonElement>('button')].map(button => {
        const box = rectangle(button)
        return {
          height: (box.bottom - box.top) / scale,
          topInset: (box.top - parent.top) / scale,
          bottomInset: (parent.bottom - box.bottom) / scale,
        }
      }),
    }
  })
}

async function assertTabGeometry(tab: Locator) {
  await tab.scrollIntoViewIfNeeded()
  await expect.poll(async () => Math.max(...(await tabGeometry(tab)).centers)).toBeLessThanOrEqual(1)
  const geometry = await tabGeometry(tab)
  expect(Math.abs(geometry.leadingInset - geometry.closingInset)).toBeLessThanOrEqual(1)
  if (geometry.controls.some(control => control.height >= 44)) {
    expect(geometry.controlGap).toBeGreaterThanOrEqual(12)
    expect(geometry.controlGap).toBeLessThanOrEqual(32)
  } else {
    expect(Math.abs(geometry.controlGap - geometry.closingInset)).toBeLessThanOrEqual(2)
  }
  expect(geometry.closingInset).toBeGreaterThanOrEqual(12)
  expect(geometry.titleGap).toBeGreaterThanOrEqual(8)
  for (const control of geometry.controls) {
    expect(control.topInset).toBeGreaterThanOrEqual(0)
    expect(control.bottomInset).toBeGreaterThanOrEqual(0)
    expect(Math.abs(control.topInset - control.bottomInset)).toBeLessThanOrEqual(1)
  }
  return geometry
}

async function prepare(page: Page, zoom: number, direction: string) {
  await page.addInitScript(value => localStorage.setItem('scriptor:ui-zoom', String(value)), zoom)
  await launchApp(page)
  await page.locator('html').evaluate((element, value) => { element.dir = value }, direction)
  const tab = page.locator('.workspace-writing-leaf .tab-item.active')
  await expect(tab.locator('.tab-title')).toHaveText('Research Plan')
  return tab
}

for (const scenario of [
  { width: 1440, zoom: 1, direction: 'ltr' },
  { width: 320, zoom: 1, direction: 'rtl' },
  { width: 1440, zoom: 2, direction: 'ltr' },
  { width: 1440, zoom: 2, direction: 'rtl' },
]) {
  test(`note-tab spacing and health-divider clearance at ${scenario.width}px, ${scenario.zoom * 100}% and ${scenario.direction}`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: scenario.width, height: 900 })
    const tab = await prepare(page, scenario.zoom, scenario.direction)
    await assertTabGeometry(tab)
    await tab.screenshot({ path: testInfo.outputPath(`note-tab-${scenario.width}-${scenario.zoom}-${scenario.direction}.png`), animations: 'disabled' })

    await openCommandPalette(page)
    await runCommand(page, 'Open vault health')
    const panel = page.getByRole('dialog', { name: 'Vault health', exact: true })
    const badge = panel.locator('.health-issues.is-healthy > strong')
    await expect(badge).toBeVisible()
    const geometry = await panel.evaluate(element => {
      const header = element.querySelector('.unified-panel-header')!.getBoundingClientRect()
      const badge = element.querySelector('.health-issues.is-healthy > strong')!.getBoundingClientRect()
      const bounds = element.getBoundingClientRect()
      const scale = bounds.height / (element as HTMLElement).offsetHeight
      return { clearance: (badge.top - header.bottom) / scale, left: badge.left, right: badge.right, panelLeft: bounds.left, panelRight: bounds.right }
    })
    expect(geometry.clearance).toBeGreaterThanOrEqual(12)
    expect(geometry.clearance).toBeLessThanOrEqual(24)
    expect(geometry.left).toBeGreaterThanOrEqual(geometry.panelLeft)
    expect(geometry.right).toBeLessThanOrEqual(geometry.panelRight)
    await panel.screenshot({ path: testInfo.outputPath(`health-divider-${scenario.width}-${scenario.zoom}-${scenario.direction}.png`), animations: 'disabled' })
  })
}

test.describe('coarse-pointer note tabs', () => {
  test.use({ hasTouch: true, viewport: { width: 320, height: 900 } })
  test('larger targets remain centered inside the tab border', async ({ page }) => {
    const tab = await prepare(page, 1, 'ltr')
    const geometry = await assertTabGeometry(tab)
    expect(geometry.controls.every(control => control.height >= 44)).toBe(true)
  })
})
