import { test, expect } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'
import {
  launchApp,
  settleLayout,
  openCommandPalette,
  runCommand,
  waitForWorkspace,
} from './helpers'

/**
 * Grant Canvas Kit's manifest permissions for the E2E fixture vault before the
 * app boots. `PluginRegistry` only reads consents once, at construction, so the
 * grant has to exist in storage before the first render; the store panel no
 * longer exposes a consent-review affordance to click through.
 */
async function grantCanvasKitConsent(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const reviewedAt = new Date(0).toISOString()
    window.localStorage.setItem(
      'scriptor:plugins:consent',
      JSON.stringify({
        schemaVersion: 1,
        savedAt: reviewedAt,
        data: {
          'scriptor.canvas-kit': {
            grantedPermissions: ['read'],
            allowedVaultIds: ['screenshot-vault'],
            allowlistedHosts: [],
            networkAccess: 'blocked',
            reviewedAt,
          },
        },
      }),
    )
  })
}

async function enableCanvasKit(page: Page): Promise<void> {
  // Bundled manifests are preinstalled in E2E; contributions appear only after activation.
  await page.getByRole('tab', { name: 'Plugins' }).click()
  const storePlugins = page.getByRole('tabpanel', { name: 'Plugins' }).last()
  await expect(storePlugins.getByRole('heading', { name: /^Installed \(\d+\)$/ })).toBeVisible({
    timeout: 15_000,
  })

  // The toggle exposes activation as state (`aria-pressed`), not just as a
  // label, so wait on the attribute instead of the transient button text.
  const canvasKitRow = storePlugins
    .locator('div')
    .filter({ hasText: /^Canvas Kit\s*v/ })
    .filter({ has: page.locator('button[aria-pressed]') })
    .last()
  const canvasKitToggle = canvasKitRow.locator('button[aria-pressed]')
  await expect(canvasKitToggle).toBeVisible({ timeout: 15_000 })
  await expect(canvasKitToggle).toBeEnabled({ timeout: 15_000 })

  if ((await canvasKitToggle.getAttribute('aria-pressed')) === 'true') return

  await canvasKitToggle.click()
  await expect(canvasKitToggle).toHaveAttribute('aria-pressed', 'true', { timeout: 15_000 })
}

async function openCanvas(page: Page): Promise<Locator> {
  await grantCanvasKitConsent(page)
  await launchApp(page)
  await waitForWorkspace(page)
  await settleLayout(page)
  await enableCanvasKit(page)
  await openCommandPalette(page)
  await runCommand(page, 'Open canvas')
  const panel = page.getByRole('dialog', { name: 'Canvas board' })
  await expect(panel).toBeVisible({ timeout: 15_000 })
  return panel
}

async function addTableBlock(panel: Locator): Promise<Locator> {
  await panel.getByRole('button', { name: 'Table' }).click()
  const stage = panel.locator('.canvas-svg')
  const bounds = await stage.boundingBox()
  if (!bounds) throw new Error('canvas stage has no bounding box')
  await stage.click({ position: { x: bounds.width * 0.55, y: bounds.height * 0.5 } })
  const block = panel.locator('.canvas-block')
  await expect(block).toHaveCount(1)
  return block
}

test.describe('Canvas panel', () => {
  test('opens via command palette', async ({ page }) => {
    const panel = await openCanvas(page)
    await expect(panel.locator('.canvas-stage')).toBeVisible()
    await expect(panel.getByRole('img', { name: 'Canvas blocks' })).toBeVisible()
  })

  test('escape closes canvas', async ({ page }) => {
    const panel = await openCanvas(page)
    await page.keyboard.press('Escape')
    await expect(panel).toBeHidden({ timeout: 5000 })
  })

  test('add block creates a new canvas node', async ({ page }) => {
    const panel = await openCanvas(page)
    const block = await addTableBlock(panel)
    await expect(block).toHaveAttribute('aria-label', /table:/)
    await expect(panel.locator('.canvas-header')).toContainText('1 blocks')
  })

  test('canvas has accessible toolbar', async ({ page }) => {
    const panel = await openCanvas(page)
    const toolbar = panel.getByRole('toolbar', { name: 'Canvas tools' })
    await expect(toolbar).toBeVisible()
    await expect(toolbar.getByRole('button', { name: 'Undo', exact: true })).toBeVisible()
    await expect(toolbar.getByRole('button', { name: 'Redo', exact: true })).toBeVisible()
    await expect(toolbar.getByRole('button', { name: 'Select', exact: true })).toBeVisible()
    await expect(toolbar.getByRole('button', { name: 'Ink', exact: true })).toBeVisible()
    await expect(toolbar.getByRole('button', { name: 'Table', exact: true })).toBeVisible()
    await expect(panel.getByRole('button', { name: 'Close canvas' })).toBeVisible()
  })

  test('canvas reports an empty board for the E2E fixture', async ({ page }) => {
    const panel = await openCanvas(page)
    await expect(panel.locator('.canvas-block')).toHaveCount(0)
    await expect(panel.locator('.canvas-header')).toContainText('0 blocks')
  })

  test('canvas viewport controls are accessible', async ({ page }) => {
    const panel = await openCanvas(page)
    await expect(panel.getByRole('button', { name: 'Reset view' })).toBeVisible()
    await expect(panel.locator('.canvas-zoom-label')).toHaveText(/^\d+%$/)
  })

  test('canvas save persists state', async ({ page }) => {
    const panel = await openCanvas(page)
    await addTableBlock(panel)
    await expect
      .poll(
        () =>
          page.evaluate(() => {
            const latest = window.__scriptorE2eCanvasSaves?.at(-1)
            if (!latest) return 0
            return (JSON.parse(latest) as { blocks: unknown[] }).blocks.length
          }),
        { timeout: 5000 },
      )
      .toBe(1)
    await expect(panel.getByRole('status')).toContainText('Saved to .scriptor/canvas/')
  })

  test('canvas undo reverts last action and redo restores it', async ({ page }) => {
    const panel = await openCanvas(page)
    await addTableBlock(panel)
    await panel.getByRole('button', { name: 'Undo' }).click()
    await expect(panel.locator('.canvas-block')).toHaveCount(0)
    await panel.getByRole('button', { name: 'Redo' }).click()
    await expect(panel.locator('.canvas-block')).toHaveCount(1)
  })

  test('canvas block can be selected', async ({ page }) => {
    const panel = await openCanvas(page)
    const block = await addTableBlock(panel)
    await panel.getByRole('button', { name: 'Select' }).click()
    const stage = panel.locator('.canvas-svg')
    await stage.click({ position: { x: 8, y: 8 } })
    await expect(panel.locator('.canvas-block.selected')).toHaveCount(0)
    await block.click()
    await expect(block).toHaveClass(/selected/)
    await expect(panel.getByRole('status')).toContainText('Selected 1 block')
  })
})
