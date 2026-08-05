import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

import { selectGitPanelState } from '../src/lib/gitPanelState'
import type { GitStatus } from '../src/types/vault'
import { launchApp, openCommandPalette, runCommand, settleLayout } from './helpers'

const OPEN_GIT = 'Open Git panel'

const READY_STATUS: GitStatus = {
  is_repo: true,
  branch: 'main',
  changed_files: [],
  clean: true,
  ahead: 0,
  behind: 0,
  has_upstream: true,
  has_conflicts: false,
  conflicted_files: [],
}

/** Opens the Git panel through the same command-palette flow used by users. */
async function openGitPanel(page: Page) {
  await launchApp(page)
  await settleLayout(page)
  await openCommandPalette(page)
  await runCommand(page, OPEN_GIT)
  const panel = page.getByRole('dialog', { name: 'Git status' })
  await expect(panel).toBeVisible({ timeout: 15_000 })
  return panel
}

test.describe('Git panel state selector', () => {
  test('distinguishes loading, idle, error, non-repository, and ready states', () => {
    expect(selectGitPanelState(null, null, true)).toBe('loading')
    expect(selectGitPanelState(null, null, false)).toBe('not-repository')
    expect(selectGitPanelState(null, 'bridge unavailable', false)).toBe('error')
    expect(selectGitPanelState(READY_STATUS, 'bridge unavailable', true)).toBe('loading')
    expect(selectGitPanelState({ ...READY_STATUS, is_repo: false }, null, false)).toBe('not-repository')
    expect(selectGitPanelState(READY_STATUS, null, false)).toBe('ready')
  })
})

test.describe('Frontend polish regressions', () => {
  test('Git file actions are not nested inside the checkbox label', async ({ page }) => {
    const panel = await openGitPanel(page)
    const row = panel.locator('.git-changes li').first()
    await expect(row.locator('.git-file-selection label button')).toHaveCount(0)
    await expect(row.locator('.git-file-row-actions button')).toHaveCount(2)
  })

  test('Git shortcut is exposed in the accessible name and visual tooltip is hidden', async ({ page }) => {
    await launchApp(page)
    await settleLayout(page)

    const gitButton = page.getByRole('button', { name: /Git.*(?:⌘G|Ctrl\+G)/i })
    await expect(gitButton).toBeVisible()
    await expect(gitButton.locator('.custom-tooltip')).toHaveAttribute('aria-hidden', 'true')

    await page.keyboard.press('Control+Alt+KeyG')
    await expect(page.getByRole('dialog', { name: 'Git status' })).toBeVisible()
  })

  test('configured sidebar and inspector shortcuts execute their advertised actions', async ({ page }) => {
    await launchApp(page)
    await settleLayout(page)
    const workspace = page.locator('.workspace-grid')

    await expect(workspace).toHaveAttribute('data-vault-collapsed', 'false')
    await page.keyboard.press('Control+Alt+KeyB')
    await expect(workspace).toHaveAttribute('data-vault-collapsed', 'true')

    await expect(workspace).toHaveAttribute('data-inspector-collapsed', 'false')
    await page.keyboard.press('Control+Alt+KeyL')
    await expect(workspace).toHaveAttribute('data-inspector-collapsed', 'true')
  })

  test('global shortcuts ignore explicit, plaintext-only, empty, and inherited editable targets', async ({ page }) => {
    await launchApp(page)
    await settleLayout(page)
    const workspace = page.locator('.workspace-grid')

    await expect(workspace).toHaveAttribute('data-vault-collapsed', 'false')
    for (const variant of ['true', 'plaintext-only', 'empty', 'inherited']) {
      await page.evaluate((editableVariant) => {
        document.querySelector('#shortcut-edit-fixture')?.remove()
        const fixture = document.createElement('div')
        fixture.id = 'shortcut-edit-fixture'

        const target = document.createElement('span')
        target.id = 'shortcut-edit-target'
        target.tabIndex = 0
        target.textContent = 'Editable shortcut fixture'

        if (editableVariant === 'inherited') {
          fixture.setAttribute('contenteditable', 'true')
          fixture.append(target)
        } else {
          target.setAttribute('contenteditable', editableVariant === 'empty' ? '' : editableVariant)
          fixture.append(target)
        }

        document.body.append(fixture)
        target.focus()
      }, variant)

      await expect(page.locator('#shortcut-edit-target')).toBeFocused()
      await page.keyboard.press('Control+Alt+KeyB')
      await expect(workspace).toHaveAttribute('data-vault-collapsed', 'false')
    }

    await page.evaluate(() => document.querySelector('#shortcut-edit-fixture')?.remove())
  })

  test('explicitly clearing Git selection leaves commit disabled', async ({ page }) => {
    const panel = await openGitPanel(page)
    const checkbox = panel.locator('.git-file-selection input[type="checkbox"]').first()
    await expect(checkbox).toBeChecked()
    await checkbox.uncheck()
    await expect(checkbox).not.toBeChecked()
    await expect(panel.getByRole('button', { name: 'Commit selected' })).toBeDisabled()
  })

  test('Git status failure is distinct from non-repository and retry recovers', async ({ page }) => {
    await page.addInitScript(() => window.sessionStorage.setItem('e2e:git-status-failure', '1'))
    await launchApp(page)
    await settleLayout(page)
    await openCommandPalette(page)
    await runCommand(page, OPEN_GIT)

    const panel = page.getByRole('dialog', { name: 'Git status' })
    await expect(panel).toContainText('Git status unavailable')
    await expect(panel).toContainText('E2E Git bridge unavailable')
    const retry = panel.getByRole('button', { name: 'Retry' })
    await expect(retry).toBeEnabled()

    await page.evaluate(() => window.sessionStorage.removeItem('e2e:git-status-failure'))
    await retry.click()
    await expect(panel).toContainText(/Working tree|changed file/i)
  })
})
