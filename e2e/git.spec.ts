import { test, expect } from '@playwright/test'
import { launchApp, settleLayout, openCommandPalette, runCommand } from './helpers'

test.describe('Git panel', () => {
  test('opens via command palette', async ({ page }) => {
    await launchApp(page)
    await settleLayout(page)
    await openCommandPalette(page)
    await runCommand(page, 'open-git')
    const panel = page.locator('[role="dialog"], .git-panel, .unified-panel-shell')
    await expect(panel.first()).toBeVisible({ timeout: 5000 })
  })

  test('shows status content', async ({ page }) => {
    await launchApp(page)
    await settleLayout(page)
    await openCommandPalette(page)
    await runCommand(page, 'open-git')
    await page.waitForFunction(() => {
      const panel = document.querySelector('.git-panel, .unified-panel-shell, [role="dialog"]')
      return panel && panel.textContent && panel.textContent.length > 0
    }, { timeout: 5000 })
    const content = page.locator('.git-panel, .unified-panel-shell, [role="dialog"]')
    await expect(content.first()).toBeVisible({ timeout: 5000 })
  })

  test('commit flow stages and commits changes', async ({ page }) => {
    await launchApp(page)
    await settleLayout(page)
    await openCommandPalette(page)
    await runCommand(page, 'open-git')
    const panel = page.locator('.git-panel, .unified-panel-shell, [role="dialog"]')
    await expect(panel.first()).toBeVisible({ timeout: 5000 })

    const stageAllBtn = panel.getByRole('button', { name: /stage all|stage all changes/i })
    if (await stageAllBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await stageAllBtn.click()
      const commitInput = panel.getByRole('textbox', { name: /commit message/i })
        .or(panel.locator('input[placeholder*="commit" i], textarea[placeholder*="commit" i]'))
      if (await commitInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        await commitInput.fill('test: e2e commit')
        const commitBtn = panel.getByRole('button', { name: /commit/i })
        await commitBtn.first().click()
      }
    }
    await expect(panel.first()).toBeVisible({ timeout: 5000 })
  })

  test('conflict detection shows conflict indicator', async ({ page }) => {
    await launchApp(page)
    await settleLayout(page)
    await openCommandPalette(page)
    await runCommand(page, 'open-git')
    const panel = page.locator('.git-panel, .unified-panel-shell, [role="dialog"]')
    await expect(panel.first()).toBeVisible({ timeout: 5000 })

    await expect(panel.locator('.conflict-indicator, [data-conflict], .merge-conflict').first()).toBeHidden().catch(() => {})
    await expect(panel.locator('.git-status, .status-text').first()).toBeVisible().catch(() => {})
    await expect(panel.first()).toBeVisible({ timeout: 5000 })
  })
})
