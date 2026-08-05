import { test, expect } from '@playwright/test'
import { launchApp, settleLayout, openCommandPalette, runCommand } from './helpers'

test.describe('Graph panel', () => {
  test('opens via command palette', async ({ page }) => {
    await launchApp(page)
    await settleLayout(page)
    await openCommandPalette(page)
    await runCommand(page, 'Open graph')
    const panel = page.getByRole('dialog', { name: 'Knowledge graph' })
    await expect(panel).toBeVisible({ timeout: 15_000 })
  })

  test('has accessible graph container', async ({ page }) => {
    await launchApp(page)
    await settleLayout(page)
    await openCommandPalette(page)
    await runCommand(page, 'Open graph')
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
    await runCommand(page, 'Open graph')
    const panel = page.getByRole('dialog', { name: 'Knowledge graph' })
    await expect(panel).toBeVisible({ timeout: 15_000 })

    const graphContainer = page.locator('svg[role="application"], canvas[role="img"], .graph-canvas')
    await expect(graphContainer.first()).toBeVisible({ timeout: 5000 })
    const keyboardSurface = graphContainer.first()
    await keyboardSurface.focus()
    await expect(keyboardSurface).toBeFocused()

    const announcement = panel.locator('[aria-live="polite"]')
    await page.keyboard.press('ArrowRight')
    await expect(announcement).toContainText('Field Notes, 2 connections')
    await expect(panel.locator('.graph-node-focus-ring')).toHaveCount(1)

    await page.keyboard.press('ArrowDown')
    await expect(announcement).toContainText('Research Plan, 4 connections')
    await expect(keyboardSurface).toBeFocused()
  })

  test('enter key activates focused node', async ({ page }) => {
    await launchApp(page)
    await settleLayout(page)
    await openCommandPalette(page)
    await runCommand(page, 'Open graph')
    const panel = page.getByRole('dialog', { name: 'Knowledge graph' })
    await expect(panel).toBeVisible({ timeout: 15_000 })

    const graphContainer = page.locator('svg[role="application"], canvas[role="img"], .graph-canvas')
    await expect(graphContainer.first()).toBeVisible({ timeout: 5000 })
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
    await launchApp(page)
    await settleLayout(page)
    await openCommandPalette(page)
    await runCommand(page, 'Open graph')
    const panel = page.getByRole('dialog', { name: 'Knowledge graph' })
    await expect(panel).toBeVisible({ timeout: 15_000 })
    await page.keyboard.press('Escape')
    await expect(panel).not.toBeVisible({ timeout: 5000 })
  })

  test('depth slider controls graph depth', async ({ page }) => {
    await launchApp(page)
    await settleLayout(page)
    await openCommandPalette(page)
    await runCommand(page, 'Open graph')
    const panel = page.getByRole('dialog', { name: 'Knowledge graph' })
    await expect(panel).toBeVisible({ timeout: 15_000 })

    // The depth control is a plain range input in `.graph-controls`; require it
    // rather than skipping silently when it cannot be found.
    const slider = panel.getByRole('slider', { name: 'Graph depth' })
    await expect(slider).toBeVisible({ timeout: 10_000 })
    const initialValue = await slider.inputValue()
    const target = initialValue === '3' ? '4' : '3'

    await slider.fill(target)
    await expect(slider).toHaveValue(target)
    expect(target).not.toBe(initialValue)
    // The panel echoes the current depth next to the slider.
    await expect(panel.locator('.graph-controls label span')).toHaveText(target)
  })

  // Renamed from "graph zoom controls are accessible": the graph panel has no
  // zoom in/out buttons (src/components/GraphPanel.tsx) — the old test called
  // isVisible() on two locators that never match and discarded both results.
  // Assert the view controls that do exist instead.
  test('graph view controls are accessible', async ({ page }) => {
    await launchApp(page)
    await settleLayout(page)
    await openCommandPalette(page)
    await runCommand(page, 'Open graph')
    const panel = page.getByRole('dialog', { name: 'Knowledge graph' })
    await expect(panel).toBeVisible({ timeout: 15_000 })

    const controls = panel.locator('.graph-controls')
    await expect(controls.getByRole('button', { name: 'Neighborhood (depth 2)' })).toBeVisible()
    await expect(controls.getByRole('button', { name: 'Full vault' })).toBeVisible()
    await expect(panel.getByRole('button', { name: 'Close graph' })).toBeVisible()

    // Switching to the full-vault view flips the toggle button's label.
    const viewToggle = controls.getByRole('button', { name: 'vault view' })
    await expect(viewToggle).toBeVisible()
    await viewToggle.click()
    await expect(controls.getByRole('button', { name: 'vault view' })).toHaveCount(0)
  })
})
