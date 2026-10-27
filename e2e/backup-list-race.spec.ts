import { expect, test } from '@playwright/test'
import { launchApp, waitForWorkspace } from './helpers'

type NativeBridge = { invoke: (command: string, args?: Record<string, unknown>) => Promise<unknown> }

test('an older backup list reply cannot overwrite a newer list for the same vault and destination', async ({ page }) => {
  await launchApp(page)
  await waitForWorkspace(page)

  await page.evaluate(() => {
    type BackupEntry = {
      name: string
      path: string
      created_at: string
      size_bytes: number
      storage_kind: string
      verified: boolean
    }
    const host = window as Window & {
      __TAURI_INTERNALS__?: NativeBridge
      __mat005ListRace?: {
        aRequests: number
        bRequests: number
        resolveOld?: (entries: BackupEntry[]) => void
      }
    }
    const bridge = host.__TAURI_INTERNALS__
    if (!bridge) throw new Error('Native fixture bridge unavailable')
    const invoke = bridge.invoke.bind(bridge)
    const race: NonNullable<typeof host.__mat005ListRace> = { aRequests: 0, bRequests: 0 }
    host.__mat005ListRace = race
    const entry = (name: string): BackupEntry => ({
      name, path: name, created_at: '2026-10-27T00:00:00Z',
      size_bytes: 64, storage_kind: 'external_backup', verified: true,
    })
    bridge.invoke = (command, args) => {
      if (command !== 'vault_list_backups') return invoke(command, args)
      const path = args?.backupPath
      if (path === 'C:/MAT005-A') {
        race.aRequests++
        if (race.aRequests === 1) {
          return new Promise<BackupEntry[]>(resolve => { race.resolveOld = resolve })
        }
        return Promise.resolve([entry('vault-backup-fresh')])
      }
      if (path === 'C:/MAT005-B') {
        race.bRequests++
        return Promise.resolve([])
      }
      return invoke(command, args)
    }
  })

  await page.locator('header.topbar').getByRole('button', { name: 'Settings' }).click()
  const settings = page.getByRole('dialog', { name: 'Settings' })
  const backup = settings.locator('[data-help-topic="backups"]')
  const options = settings.locator('details.backup-options')
  if (await options.getAttribute('open') === null) await options.locator('summary').click()
  const folder = settings.getByRole('textbox', { name: /Backup folder outside this vault/ })

  await folder.fill('C:/MAT005-A')
  await expect.poll(() => page.evaluate(() =>
    (window as Window & { __mat005ListRace?: { aRequests: number } }).__mat005ListRace?.aRequests ?? 0,
  )).toBe(1)
  await folder.fill('C:/MAT005-B')
  await expect.poll(() => page.evaluate(() =>
    (window as Window & { __mat005ListRace?: { bRequests: number } }).__mat005ListRace?.bRequests ?? 0,
  )).toBe(1)
  await folder.fill('C:/MAT005-A')
  await expect.poll(() => page.evaluate(() =>
    (window as Window & { __mat005ListRace?: { aRequests: number } }).__mat005ListRace?.aRequests ?? 0,
  )).toBe(2)
  await expect(backup.getByText('vault-backup-fresh', { exact: false })).toBeVisible()

  await page.evaluate(() => {
    const host = window as Window & {
      __mat005ListRace?: { resolveOld?: (entries: unknown[]) => void }
    }
    host.__mat005ListRace?.resolveOld?.([{
      name: 'vault-backup-stale', path: 'vault-backup-stale', created_at: '2026-10-27T00:00:00Z',
      size_bytes: 64, storage_kind: 'external_backup', verified: true,
    }])
  })
  await expect(backup.getByText('vault-backup-fresh', { exact: false })).toBeVisible()
  await expect(backup.getByText('vault-backup-stale', { exact: false })).toHaveCount(0)
})
