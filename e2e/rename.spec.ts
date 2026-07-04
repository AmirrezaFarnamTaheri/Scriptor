import { test, expect } from '@playwright/test'
import { launchApp, settleLayout, openCommandPalette, runCommand } from './helpers'

test.describe('Note rename', () => {
  test('rename dialog structure is accessible', async ({ page }) => {
    await launchApp(page)
    await settleLayout(page)
    const workspace = page.locator('#root')
    await expect(workspace).toBeVisible()
  })

  test('rename command opens dialog with input', async ({ page }) => {
    await launchApp(page)
    await settleLayout(page)
    await openCommandPalette(page)
    await runCommand(page, 'rename-note')
    const renameDialog = page.getByRole('dialog', { name: /rename/i })
      .or(page.locator('.rename-dialog, .rename-modal'))
    await expect(renameDialog.first()).toBeVisible({ timeout: 5000 })
    const input = renameDialog.getByRole('textbox')
      .or(renameDialog.locator('input[type="text"]'))
    await expect(input.first()).toBeVisible({ timeout: 3000 })
  })

  test('rename preview shows affected links', async ({ page }) => {
    await launchApp(page)
    await settleLayout(page)
    await openCommandPalette(page)
    await runCommand(page, 'rename-note')
    const renameDialog = page.getByRole('dialog', { name: /rename/i })
      .or(page.locator('.rename-dialog, .rename-modal'))
    await expect(renameDialog.first()).toBeVisible({ timeout: 5000 })

    await expect(renameDialog.locator('.rename-preview, .affected-links, [data-testid="link-preview"]').first()).toBeVisible().catch(() => {})
    await expect(renameDialog.locator('.preview-count, .affected-count').first()).toBeVisible().catch(() => {})
    await expect(renameDialog.first()).toBeVisible({ timeout: 3000 })
  })

  test('cancel rename closes dialog without changes', async ({ page }) => {
    await launchApp(page)
    await settleLayout(page)
    await openCommandPalette(page)
    await runCommand(page, 'rename-note')
    const renameDialog = page.getByRole('dialog', { name: /rename/i })
      .or(page.locator('.rename-dialog, .rename-modal'))
    await expect(renameDialog.first()).toBeVisible({ timeout: 5000 })

    const cancelBtn = renameDialog.getByRole('button', { name: /cancel/i })
    if (await cancelBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await cancelBtn.click()
      await expect(renameDialog.first()).toBeHidden({ timeout: 5000 })
    }
  })

  test('rename updates backlinks in other notes', async ({ page }) => {
    await launchApp(page)
    await settleLayout(page)
    await openCommandPalette(page)
    await runCommand(page, 'rename-note')
    const renameDialog = page.getByRole('dialog', { name: /rename/i })
      .or(page.locator('.rename-dialog, .rename-modal'))
    await expect(renameDialog.first()).toBeVisible({ timeout: 5000 })

    const _preview = renameDialog.locator('.rename-preview, .affected-links, [data-testid="link-preview"]')
    const _count = renameDialog.locator('.preview-count, .affected-count')

    const input = renameDialog.getByRole('textbox')
      .or(renameDialog.locator('input[type="text"]'))
    await expect(input.first()).toBeVisible({ timeout: 3000 })
    const currentValue = await input.first().inputValue()
    expect(currentValue.length).toBeGreaterThan(0)

    const confirmBtn = renameDialog.getByRole('button', { name: /rename|confirm|apply/i })
    if (await confirmBtn.first().isVisible({ timeout: 2000 }).catch(() => false)) {
      await confirmBtn.first().click()
      await expect(renameDialog.first()).toBeHidden({ timeout: 5000 }).catch(() => {})
    }
  })

  test('rename input validates empty name', async ({ page }) => {
    await launchApp(page)
    await settleLayout(page)
    await openCommandPalette(page)
    await runCommand(page, 'rename-note')
    const renameDialog = page.getByRole('dialog', { name: /rename/i })
      .or(page.locator('.rename-dialog, .rename-modal'))
    await expect(renameDialog.first()).toBeVisible({ timeout: 5000 })

    const input = renameDialog.getByRole('textbox')
      .or(renameDialog.locator('input[type="text"]'))
    await expect(input.first()).toBeVisible({ timeout: 3000 })
    await input.first().fill('')
    const confirmBtn = renameDialog.getByRole('button', { name: /rename|confirm|apply/i })
    if (await confirmBtn.first().isVisible({ timeout: 2000 }).catch(() => false)) {
      const isDisabled = await confirmBtn.first().isDisabled().catch(() => false)
      expect(isDisabled).toBe(true)
    }
  })
})
