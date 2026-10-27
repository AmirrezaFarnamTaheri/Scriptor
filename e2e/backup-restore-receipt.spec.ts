import { expect, test } from '@playwright/test'
import { launchApp, waitForWorkspace } from './helpers'

type NativeBridge = { invoke: (command: string, args?: Record<string, unknown>) => Promise<unknown> }

test('backup settings shows the native confirmed restore outcome without inventing success', async ({ page }) => {
  await launchApp(page)
  await waitForWorkspace(page)
  await page.evaluate(() => {
    const host = window as Window & { __TAURI_INTERNALS__?: NativeBridge }
    const native = host.__TAURI_INTERNALS__
    if (!native) throw new Error('Native fixture bridge unavailable')
    const invoke = native.invoke.bind(native)
    native.invoke = (command, args) => {
      if (command === 'vault_list_backups') return Promise.resolve([{
        name: 'vault-backup-test-123',
        path: 'vault-backup-test-123',
        created_at: '2026-10-27T00:00:00Z',
        size_bytes: 1024,
        storage_kind: 'local_snapshot',
        verified: true,
      }])
      if (command === 'vault_restore_backup') return Promise.resolve({
        status: 'rolled-back',
        message: 'Restore was safely rolled back by the native service.',
      })
      return invoke(command, args)
    }
  })

  await page.locator('header.topbar').getByRole('button', { name: 'Settings' }).click()
  const settings = page.getByRole('dialog', { name: 'Settings' })
  const backup = settings.locator('[data-help-topic="backups"]')
  await expect(backup.getByRole('region', { name: 'Last restore attempt (this session)' })).toHaveCount(0)
  await expect(backup.getByText('vault-backup-test-123')).toBeVisible()
  await backup.getByRole('button', { name: 'Restore backup vault-backup-test-123' }).click()
  await backup.getByRole('button', { name: 'Restore backup', exact: true }).click()

  const summary = backup.getByRole('region', { name: 'Last restore attempt (this session)' })
  await expect(summary).toBeVisible()
  await expect(summary.getByRole('status')).toContainText('Restore rolled back')
  await expect(summary).toContainText('original vault files are unchanged')
  await expect(summary).not.toContainText('Files restored')
})
