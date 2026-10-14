import { expect, test } from '@playwright/test'
import { launchApp, waitForWorkspace } from './helpers'

type NativeBridge = {
  invoke: (command: string, args?: Record<string, unknown>) => Promise<unknown>
}

test('backup inventory and errors follow the selected directory, never a stale listing', async ({ page }) => {
  await launchApp(page)
  await waitForWorkspace(page)

  await page.evaluate(() => {
    const global = window as Window & {
      __TAURI_INTERNALS__?: NativeBridge
      __resolveOldBackupList?: () => void
      __oldBackupListStarted?: boolean
    }
    const native = global.__TAURI_INTERNALS__
    if (!native) throw new Error('Native test bridge unavailable')
    const original = native.invoke.bind(native)
    const entry = (name: string) => ({
      name,
      path: name,
      created_at: '2026-10-14T12:00:00Z',
      size_bytes: 500,
      storage_kind: 'external_backup',
      verified: true,
    })
    native.invoke = (command, args) => {
      if (command !== 'vault_list_backups') return original(command, args)
      const path = args?.backupPath
      if (path === 'C:/OldBackups') {
        global.__oldBackupListStarted = true
        return new Promise(resolve => {
          global.__resolveOldBackupList = () => resolve([entry('old-vault-backup')])
        })
      }
      if (path === 'C:/NewBackups') return Promise.resolve([entry('new-vault-backup')])
      if (path === 'C:/UnavailableBackups') return Promise.reject(new Error('Access denied'))
      return Promise.resolve([])
    }
  })

  await page.locator('header.topbar').getByRole('button', { name: 'Settings' }).click()
  const settings = page.getByRole('dialog', { name: 'Settings' })
  const pathInput = settings.getByRole('textbox', { name: /Disaster-recovery backup path/ })
  const backupPanel = settings.locator('[data-help-topic="backups"]')
  await expect(pathInput).toBeVisible()

  await pathInput.fill('C:/OldBackups')
  await expect.poll(() => page.evaluate(() => (window as Window & { __oldBackupListStarted?: boolean }).__oldBackupListStarted ?? false)).toBe(true)

  await pathInput.fill('C:/NewBackups')
  await expect(backupPanel).toContainText('new-vault-backup')
  await expect(backupPanel).not.toContainText('old-vault-backup')
  await page.evaluate(() => {
    (window as Window & { __resolveOldBackupList?: () => void }).__resolveOldBackupList?.()
  })
  await expect(backupPanel).toContainText('new-vault-backup')
  await expect(backupPanel).not.toContainText('old-vault-backup')

  await pathInput.fill('C:/UnavailableBackups')
  await expect(backupPanel.getByRole('alert')).toContainText('Could not load backups')
  await expect(backupPanel).not.toContainText('new-vault-backup')
  await expect(backupPanel).not.toContainText('No backups yet')
})
