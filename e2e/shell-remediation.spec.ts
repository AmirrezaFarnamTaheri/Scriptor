import { expect, test } from '@playwright/test'

import { launchApp, settleLayout, waitForWorkspace } from './helpers'

test.describe('workspace shell remediation contracts', () => {
  test('default top bar keeps secondary destinations out of the primary action strip', async ({ page }) => {
    await launchApp(page)
    await waitForWorkspace(page)
    await settleLayout(page)

    // Knowledge/Publish remain workspace modes, while Portal/Graph/Canvas and
    // other secondary destinations stay discoverable through the command
    // palette and top-bar customizer instead of competing with writing tools.
    const secondaryActions = page.locator('.top-actions .topbar-secondary-action')
    await expect(secondaryActions).toHaveCount(1)
    await expect(secondaryActions.first()).toHaveAccessibleName(/capture/i)
  })

  test('sidebar does not duplicate the active note in Recent or duplicate Settings', async ({ page }) => {
    await launchApp(page)
    await waitForWorkspace(page)
    await settleLayout(page)

    const recent = page.locator('.vault-recent-notes')
    if (await recent.count()) {
      await expect(recent.getByRole('button', { name: 'Research Plan', exact: true })).toHaveCount(0)
    }
    await expect(page.locator('.vault-sidebar-footer').getByRole('button', { name: 'Settings' })).toHaveCount(0)
    await expect(page.locator('header.topbar').getByRole('button', { name: 'Settings' })).toBeVisible()
  })

  test('completed indexing is compact and the status summary does not duplicate the Jobs tab label', async ({ page }) => {
    await launchApp(page)
    await waitForWorkspace(page)
    await settleLayout(page)

    const progress = page.locator('.job-progress')
    await expect(progress).toHaveClass(/is-done/)
    await expect(progress.locator('.progress-track')).toHaveCount(0)
    await expect(progress).not.toContainText('100%')

    const summaryAction = page.locator('.jobs-button')
    await expect(summaryAction).toBeVisible()
    await expect(summaryAction).not.toHaveText(/^\s*Jobs\s*$/)
  })
})