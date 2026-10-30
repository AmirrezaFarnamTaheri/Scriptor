import { expect, test } from '@playwright/test'
import { launchApp, waitForWorkspace } from './helpers'

test('Backup settings opens the current note history without restoring anything', async ({ page }) => {
  await launchApp(page)
  await waitForWorkspace(page)
  await page.locator('header.topbar').getByRole('button', { name: 'Settings' }).click()
  const settings = page.getByRole('dialog', { name: 'Settings' })
  const backup = settings.locator('[data-help-topic="backups"]')
  const openHistory = backup.getByRole('button', { name: 'Review selected note history' })
  await expect(openHistory).toBeEnabled()
  await openHistory.click()
  await expect(settings).toBeHidden()
  const history = page.getByRole('dialog', { name: 'Note history' })
  await expect(history).toBeVisible()
  await expect(history.getByLabel('Current note and selected revision comparison')).toBeVisible()
  await expect(history.getByRole('group', { name: 'Confirm revision restore' })).toHaveCount(0)
})
