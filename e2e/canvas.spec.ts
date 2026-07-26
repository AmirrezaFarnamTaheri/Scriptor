import { test, expect } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'
import { launchApp, settleLayout, openCommandPalette, runCommand } from './helpers'

/**
 * The canvas has no "add block" control: blocks are created by gestures bound to
 * plugin-contributed canvas tools (`plugins.contributions.canvasTools`), and the
 * E2E fixture loads no plugins and mocks `canvas_load_document` with an empty
 * block list. Every test below that needed an existing block used to hide that
 * behind `if (await addBtn.isVisible().catch(() => false))`, so it passed while
 * asserting nothing. Those are now explicit, visible skips.
 */
const NO_ADD_BLOCK_REASON =
  'Canvas blocks can only be created by plugin-contributed tools; the E2E fixture loads no plugins, so there is no way to add a block.'

async function openCanvas(page: Page): Promise<Locator> {
  await launchApp(page)
  await settleLayout(page)
  await openCommandPalette(page)
  await runCommand(page, 'Open canvas')
  const panel = page.getByRole('dialog', { name: 'Canvas board' })
  await expect(panel).toBeVisible({ timeout: 15_000 })
  return panel
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
    test.skip(true, NO_ADD_BLOCK_REASON)
    void page
  })

  test('canvas has accessible toolbar', async ({ page }) => {
    const panel = await openCanvas(page)
    const toolbar = panel.getByRole('toolbar', { name: 'Canvas tools' })
    await expect(toolbar).toBeVisible()
    await expect(toolbar.getByRole('button', { name: 'Undo' })).toBeVisible()
    await expect(toolbar.getByRole('button', { name: 'Redo' })).toBeVisible()
    await expect(panel.getByRole('button', { name: 'Close canvas' })).toBeVisible()
  })

  test('canvas reports an empty board for the E2E fixture', async ({ page }) => {
    const panel = await openCanvas(page)
    // `canvas_load_document` is mocked with `blocks: []`; assert the panel says
    // so rather than probing for nodes that can never exist.
    await expect(panel.locator('.canvas-block')).toHaveCount(0)
    await expect(panel.locator('.canvas-header')).toContainText('0 blocks')
  })

  test('canvas viewport controls are accessible', async ({ page }) => {
    const panel = await openCanvas(page)
    await expect(panel.getByRole('button', { name: 'Reset view' })).toBeVisible()
    await expect(panel.locator('.canvas-zoom-label')).toHaveText(/^\d+%$/)
  })

  test('canvas save persists state', async ({ page }) => {
    test.skip(true, NO_ADD_BLOCK_REASON)
    void page
  })

  test('canvas undo reverts last action', async ({ page }) => {
    test.skip(true, NO_ADD_BLOCK_REASON)
    void page
  })

  test('canvas block can be selected', async ({ page }) => {
    test.skip(true, NO_ADD_BLOCK_REASON)
    void page
  })
})
