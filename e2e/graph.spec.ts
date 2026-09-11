import { test, expect } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'
import {
  launchApp,
  settleLayout,
  openCommandPalette,
  runCommand,
  waitForWorkspace,
} from './helpers'

async function openGraph(page: Page): Promise<Locator> {
  await launchApp(page)
  await waitForWorkspace(page)
  await settleLayout(page)

  const panel = page.getByRole('dialog', { name: 'Knowledge graph' })
  for (let attempt = 0; attempt < 2; attempt += 1) {
    await openCommandPalette(page)
    const navigationTimeOrigin = await page.evaluate(() => performance.timeOrigin)
    await runCommand(page, 'Open graph')

    try {
      await expect(panel).toBeVisible({ timeout: 15_000 })
      return panel
    } catch (error) {
      // A parallel worker can trigger Vite's lazy-dependency optimizer after
      // the command click has already completed. If that replaces the document,
      // the graph's in-memory open state disappears. Replay only when the time
      // origin proves navigation occurred; ordinary graph failures still fail.
      await page.waitForLoadState('domcontentloaded', { timeout: 10_000 }).catch(() => undefined)
      const currentTimeOrigin = await page
        .evaluate(() => performance.timeOrigin)
        .catch(() => navigationTimeOrigin)
      if (attempt === 0 && currentTimeOrigin !== navigationTimeOrigin) {
        await waitForWorkspace(page)
        await settleLayout(page)
        continue
      }
      throw error
    }
  }

  throw new Error('Graph did not open after the Vite navigation retry')
}

test.describe('Graph panel', () => {
  test('opens via command palette', async ({ page }) => {
    await openGraph(page)
  })

  test('has accessible graph container', async ({ page }) => {
    await openGraph(page)
    const svg = page.locator('svg[role="application"], canvas[role="img"]')
    await expect(svg.first()).toBeVisible({ timeout: 30_000 })
  })

  test('keyboard navigation moves focus between nodes', async ({ page }) => {
    const panel = await openGraph(page)

    const graphContainer = page.locator('svg[role="application"], canvas[role="img"], .graph-canvas')
    await expect(graphContainer.first()).toBeVisible({ timeout: 30_000 })
    const keyboardSurface = graphContainer.first()
    await keyboardSurface.focus()
    await expect(keyboardSurface).toBeFocused()

    const announcement = panel.locator('[aria-live="polite"]')
    await page.keyboard.press('ArrowRight')
    await expect(announcement).toContainText('Field Notes, 2 connections')
    await expect(panel.locator('.graph-node-focus-ring')).toHaveCount(1)

    await page.keyboard.press('ArrowDown')
    await expect(announcement).toContainText('Research Plan, 4 connections')
    await expect(panel.locator('.graph-node-focus-ring')).toHaveCount(1)
    await expect(keyboardSurface).toBeFocused()
  })

  test('enter key activates focused node', async ({ page }) => {
    const panel = await openGraph(page)

    const graphContainer = page.locator('svg[role="application"], canvas[role="img"], .graph-canvas')
    await expect(graphContainer.first()).toBeVisible({ timeout: 30_000 })
    const keyboardSurface = graphContainer.first()
    await keyboardSurface.focus()
    await expect(keyboardSurface).toBeFocused()

    await page.keyboard.press('ArrowRight')
    await expect(panel.locator('[aria-live="polite"]')).toContainText('Field Notes, 2 connections')
    await page.keyboard.press('Enter')

    await expect(page.getByRole('tab', { name: 'Field Notes', selected: true })).toBeVisible()
    await expect(panel.locator('.graph-header')).toContainText('focus Field Notes.md')
  })

  test('escape closes graph panel', async ({ page }) => {
    const panel = await openGraph(page)
    await page.keyboard.press('Escape')
    await expect(panel).not.toBeVisible({ timeout: 5000 })
  })

  test('depth slider controls graph depth', async ({ page }) => {
    const panel = await openGraph(page)

    const slider = panel.getByRole('slider', { name: 'Graph depth' })
    await expect(slider).toBeVisible({ timeout: 10_000 })
    const initialValue = await slider.inputValue()
    const target = initialValue === '3' ? '4' : '3'

    await slider.fill(target)
    await expect(slider).toHaveValue(target)
    expect(target).not.toBe(initialValue)
    await expect(slider.locator('xpath=following-sibling::span')).toHaveText(target)
  })

  test('graph view controls are accessible', async ({ page }) => {
    const panel = await openGraph(page)

    const controls = panel.locator('.graph-controls')
    const view = controls.getByRole('combobox', { name: 'View' })
    await expect(view).toBeVisible()
    await expect(view.getByRole('option', { name: 'Neighborhood' })).toHaveCount(1)
    await expect(view.getByRole('option', { name: 'Full vault' })).toHaveCount(1)
    await expect(panel.getByRole('button', { name: 'Close graph' })).toBeVisible()

    await view.selectOption({ label: 'Full vault' })
    await expect(view).toHaveValue('vault')
    await expect(panel.getByRole('slider', { name: 'Graph depth' })).toHaveCount(0)

    await view.selectOption({ label: 'Neighborhood' })
    await expect(view).toHaveValue('local')
    await expect(panel.getByRole('slider', { name: 'Graph depth' })).toBeVisible()
  })
})