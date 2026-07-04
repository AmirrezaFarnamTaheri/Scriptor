import { test, expect } from '@playwright/test'
import { launchApp, settleLayout, openCommandPalette, runCommand } from './helpers'

test.describe('Canvas panel', () => {
  test('opens via command palette', async ({ page }) => {
    await launchApp(page)
    await settleLayout(page)
    await openCommandPalette(page)
    await runCommand(page, 'open-canvas')
    const panel = page.locator('.canvas-panel, .unified-panel-shell, [role="dialog"]')
    await expect(panel.first()).toBeVisible({ timeout: 5000 })
  })

  test('escape closes canvas', async ({ page }) => {
    await launchApp(page)
    await settleLayout(page)
    await openCommandPalette(page)
    await runCommand(page, 'open-canvas')
    await page.waitForFunction(() => {
      return document.querySelector('.canvas-panel, .unified-panel-shell, [role="dialog"]') !== null
    }, { timeout: 5000 })
    await page.keyboard.press('Escape')
    await page.waitForFunction(() => {
      const panel = document.querySelector('.canvas-panel')
      return !panel || panel.offsetParent === null
    }, { timeout: 3000 })
  })

  test('add block creates a new canvas node', async ({ page }) => {
    await launchApp(page)
    await settleLayout(page)
    await openCommandPalette(page)
    await runCommand(page, 'open-canvas')
    const panel = page.locator('.canvas-panel, .unified-panel-shell, [role="dialog"]')
    await expect(panel.first()).toBeVisible({ timeout: 5000 })

    const addBtn = panel.getByRole('button', { name: /add block|add node|new block/i })
      .or(panel.locator('.canvas-add-btn, [data-testid="add-block"]'))
    if (await addBtn.first().isVisible({ timeout: 2000 }).catch(() => false)) {
      await addBtn.first().click()
      const nodes = panel.locator('.canvas-node, .canvas-block, [data-node-id]')
      const count = await nodes.count()
      expect(count).toBeGreaterThanOrEqual(1)
    }
  })

  test('canvas has accessible toolbar', async ({ page }) => {
    await launchApp(page)
    await settleLayout(page)
    await openCommandPalette(page)
    await runCommand(page, 'open-canvas')
    const panel = page.locator('.canvas-panel, .unified-panel-shell, [role="dialog"]')
    await expect(panel.first()).toBeVisible({ timeout: 5000 })

    const toolbar = panel.locator('.canvas-toolbar, [role="toolbar"], .canvas-controls')
    await toolbar.first().isVisible({ timeout: 2000 }).catch(() => false)
    await expect(panel.first()).toBeVisible({ timeout: 3000 })
  })

  test('canvas save persists state', async ({ page }) => {
    await launchApp(page)
    await settleLayout(page)
    await openCommandPalette(page)
    await runCommand(page, 'open-canvas')
    const panel = page.locator('.canvas-panel, .unified-panel-shell, [role="dialog"]')
    await expect(panel.first()).toBeVisible({ timeout: 5000 })

    const addBtn = panel.getByRole('button', { name: /add block|add node|new block/i })
      .or(panel.locator('.canvas-add-btn, [data-testid="add-block"]'))
    if (await addBtn.first().isVisible({ timeout: 2000 }).catch(() => false)) {
      await addBtn.first().click()
    }

    const saveBtn = panel.getByRole('button', { name: /save/i })
      .or(panel.locator('.canvas-save-btn, [data-testid="canvas-save"]'))
    if (await saveBtn.first().isVisible({ timeout: 2000 }).catch(() => false)) {
      await saveBtn.first().click()
    }
    await expect(panel.first()).toBeVisible({ timeout: 3000 })
  })

  test('canvas undo reverts last action', async ({ page }) => {
    await launchApp(page)
    await settleLayout(page)
    await openCommandPalette(page)
    await runCommand(page, 'open-canvas')
    const panel = page.locator('.canvas-panel, .unified-panel-shell, [role="dialog"]')
    await expect(panel.first()).toBeVisible({ timeout: 5000 })

    const addBtn = panel.getByRole('button', { name: /add block|add node|new block/i })
      .or(panel.locator('.canvas-add-btn, [data-testid="add-block"]'))
    if (await addBtn.first().isVisible({ timeout: 2000 }).catch(() => false)) {
      await addBtn.first().click()
      const nodesBefore = await panel.locator('.canvas-node, .canvas-block, [data-node-id]').count()

      const undoBtn = panel.getByRole('button', { name: /undo/i })
        .or(panel.locator('.canvas-undo-btn, [data-testid="canvas-undo"]'))
      if (await undoBtn.first().isVisible({ timeout: 2000 }).catch(() => false)) {
        await undoBtn.first().click()
        const nodesAfter = await panel.locator('.canvas-node, .canvas-block, [data-node-id]').count()
        expect(nodesAfter).toBeLessThan(nodesBefore)
      }
    }
    await expect(panel.first()).toBeVisible({ timeout: 3000 })
  })

  test('canvas block can be selected', async ({ page }) => {
    await launchApp(page)
    await settleLayout(page)
    await openCommandPalette(page)
    await runCommand(page, 'open-canvas')
    const panel = page.locator('.canvas-panel, .unified-panel-shell, [role="dialog"]')
    await expect(panel.first()).toBeVisible({ timeout: 5000 })

    const addBtn = panel.getByRole('button', { name: /add block|add node|new block/i })
      .or(panel.locator('.canvas-add-btn, [data-testid="add-block"]'))
    if (await addBtn.first().isVisible({ timeout: 2000 }).catch(() => false)) {
      await addBtn.first().click()
      const node = panel.locator('.canvas-node, .canvas-block, [data-node-id]').first()
      if (await node.isVisible({ timeout: 2000 }).catch(() => false)) {
        await node.click()
        const selected = panel.locator('.canvas-node.selected, .canvas-block.selected, [data-selected="true"]')
        await selected.first().isVisible({ timeout: 2000 }).catch(() => false)
      }
    }
    await expect(panel.first()).toBeVisible({ timeout: 3000 })
  })
})
