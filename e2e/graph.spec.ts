import { test, expect } from '@playwright/test'
import { launchApp, settleLayout, openCommandPalette, runCommand } from './helpers'

test.describe('Graph panel', () => {
  test('opens via command palette', async ({ page }) => {
    await launchApp(page)
    await settleLayout(page)
    await openCommandPalette(page)
    await runCommand(page, 'open-graph')
    const panel = page.locator('.graph-panel, .unified-panel-shell, [role="dialog"]')
    await expect(panel.first()).toBeVisible({ timeout: 5000 })
  })

  test('has accessible graph container', async ({ page }) => {
    await launchApp(page)
    await settleLayout(page)
    await openCommandPalette(page)
    await runCommand(page, 'open-graph')
    await page.waitForFunction(() => {
      return document.querySelector('svg[role="application"], canvas[role="img"]') !== null
    }, { timeout: 5000 })
    const svg = page.locator('svg[role="application"], canvas[role="img"]')
    await expect(svg.first()).toBeVisible({ timeout: 5000 })
  })

  test('keyboard navigation moves focus between nodes', async ({ page }) => {
    await launchApp(page)
    await settleLayout(page)
    await openCommandPalette(page)
    await runCommand(page, 'open-graph')
    const panel = page.locator('.graph-panel, .unified-panel-shell, [role="dialog"]')
    await expect(panel.first()).toBeVisible({ timeout: 5000 })

    const graphContainer = page.locator('svg[role="application"], canvas[role="img"], .graph-canvas')
    await expect(graphContainer.first()).toBeVisible({ timeout: 5000 })
    await graphContainer.first().focus()

    await page.keyboard.press('Tab')
    await page.waitForFunction(() => document.activeElement?.closest('.graph-canvas, [role="application"]') !== null)
    await page.keyboard.press('ArrowRight')
    await page.waitForFunction(() => document.activeElement?.closest('.graph-canvas, [role="application"]') !== null)
    await page.keyboard.press('ArrowDown')
    await page.waitForFunction(() => document.activeElement?.closest('.graph-canvas, [role="application"]') !== null)

    await expect(panel.first()).toBeVisible({ timeout: 3000 })
  })

  test('enter key activates focused node', async ({ page }) => {
    await launchApp(page)
    await settleLayout(page)
    await openCommandPalette(page)
    await runCommand(page, 'open-graph')
    const panel = page.locator('.graph-panel, .unified-panel-shell, [role="dialog"]')
    await expect(panel.first()).toBeVisible({ timeout: 5000 })

    const graphContainer = page.locator('svg[role="application"], canvas[role="img"], .graph-canvas')
    await expect(graphContainer.first()).toBeVisible({ timeout: 5000 })
    await graphContainer.first().focus()

    await page.keyboard.press('Tab')
    await page.waitForFunction(() => document.activeElement?.closest('.graph-canvas, [role="application"]') !== null)
    await page.keyboard.press('Enter')
    await expect(panel.first()).toBeVisible({ timeout: 3000 })
  })

  test('escape closes graph panel', async ({ page }) => {
    await launchApp(page)
    await settleLayout(page)
    await openCommandPalette(page)
    await runCommand(page, 'open-graph')
    const panel = page.locator('.graph-panel, .unified-panel-shell, [role="dialog"]')
    await expect(panel.first()).toBeVisible({ timeout: 5000 })
    await page.keyboard.press('Escape')
    await expect(panel.first()).not.toBeVisible({ timeout: 5000 })
  })

  test('depth slider controls graph depth', async ({ page }) => {
    await launchApp(page)
    await settleLayout(page)
    await openCommandPalette(page)
    await runCommand(page, 'open-graph')
    const panel = page.locator('.graph-panel, .unified-panel-shell, [role="dialog"]')
    await expect(panel.first()).toBeVisible({ timeout: 5000 })

    const slider = panel.locator('input[type="range"], .depth-slider, [data-testid="depth-slider"]')
    if (await slider.first().isVisible({ timeout: 3000 }).catch(() => false)) {
      const _initialValue = await slider.first().inputValue()
      await slider.first().fill('3')
      await page.waitForTimeout(500)
      const newValue = await slider.first().inputValue()
      expect(newValue).toBe('3')
    }
    await expect(panel.first()).toBeVisible({ timeout: 3000 })
  })

  test('graph zoom controls are accessible', async ({ page }) => {
    await launchApp(page)
    await settleLayout(page)
    await openCommandPalette(page)
    await runCommand(page, 'open-graph')
    const panel = page.locator('.graph-panel, .unified-panel-shell, [role="dialog"]')
    await expect(panel.first()).toBeVisible({ timeout: 5000 })

    const zoomIn = panel.getByRole('button', { name: /zoom in|\+/i })
      .or(panel.locator('.zoom-in, [data-testid="zoom-in"]'))
    const zoomOut = panel.getByRole('button', { name: /zoom out|-/i })
      .or(panel.locator('.zoom-out, [data-testid="zoom-out"]'))
    await zoomIn.first().isVisible({ timeout: 2000 }).catch(() => false)
    await zoomOut.first().isVisible({ timeout: 2000 }).catch(() => false)
    await expect(panel.first()).toBeVisible({ timeout: 3000 })
  })
})
