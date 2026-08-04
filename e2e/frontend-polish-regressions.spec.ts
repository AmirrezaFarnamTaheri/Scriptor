import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

import { selectGitPanelState } from '../src/lib/gitPanelState'
import type { WorkspaceGitStatus } from '../src/hooks/useWorkspaceGit'
import { launchApp, openCommandPalette, runCommand, settleLayout } from './helpers'

const OPEN_GIT = 'Open Git panel'

const READY_STATUS: WorkspaceGitStatus = {
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
  test('distinguishes loading, error, non-repository, and ready states', () => {
    expect(selectGitPanelState(null, true)).toBe('loading')
    expect(selectGitPanelState({ ...READY_STATUS, is_repo: false, loadError: 'bridge unavailable' }, false)).toBe('error')
    expect(selectGitPanelState({ ...READY_STATUS, is_repo: false }, false)).toBe('not-repository')
    expect(selectGitPanelState(READY_STATUS, false)).toBe('ready')
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
  })
})
