import { expect, test } from '@playwright/test'

import { launchApp, openCommandPalette, runCommand, settleLayout, waitForWorkspace } from './helpers'

test('note history compares current content before restore', async ({ page }) => {
  await launchApp(page)
  await waitForWorkspace(page)
  await settleLayout(page)

  await openCommandPalette(page)
  await runCommand(page, 'Note history timeline')

  const panel = page.getByRole('dialog', { name: 'Note history' })
  await expect(panel).toBeVisible()
  const comparison = panel.getByLabel('Current note and selected revision comparison')
  await expect(comparison).toBeVisible()
  await expect(comparison.getByRole('heading', { name: 'Current note' })).toBeVisible()
  await expect(comparison.getByRole('heading', { name: 'Selected revision' })).toBeVisible()
  await expect(comparison.locator('.note-history-markdown')).toHaveCount(2)
  await expect(comparison.locator('.note-history-markdown').first()).toContainText('Research Plan')
  await expect(comparison.locator('.note-history-markdown').nth(1)).toContainText('Previous revision')
  const activity = panel.getByRole('list', { name: 'Saved revisions per UTC day' })
  await expect(activity).toBeVisible()
  await expect(activity.locator('li')).not.toHaveCount(0)
  await expect(panel.getByText('Empty cells mean no retained revision;', { exact: false })).toBeVisible()
  await panel.getByText('Vocabulary comparison', { exact: true }).click()
  await expect(panel.getByRole('row', { name: /Distinct words/ })).toBeVisible()
  await expect(panel.getByText('it is not a readability or quality score.', { exact: false })).toBeVisible()

  const restore = panel.getByRole('button', { name: 'Restore revision' })
  await expect(restore).toBeEnabled()
  await restore.click()
  const confirmation = panel.getByRole('group', { name: 'Confirm revision restore' })
  await expect(confirmation).toBeVisible()
  await confirmation.getByRole('button', { name: 'Cancel' }).click()
  await expect(confirmation).toBeHidden()
  await expect(panel).toBeVisible()
})
