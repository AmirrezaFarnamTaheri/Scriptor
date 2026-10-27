import { expect, test } from '@playwright/test'
import { launchApp, waitForWorkspace } from './helpers'

type NativeBridge = { invoke: (command: string, args?: Record<string, unknown>) => Promise<unknown> }

test('pending same-scope backup list cannot resurrect stale entries after a completed manual backup', async ({ page }) => {
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
      __mat005ListRace?: { requests: number; resolveOld?: (entries: BackupEntry[]) => void }
    }
    const bridge = host.__TAURI_INTERNALS__
    if (!bridge) throw new Error('Native fixture bridge unavailable')
    const invoke = bridge.invoke.bind(bridge)
    const race: NonNullable<typeof host.__mat005ListRace> = { requests: 0 }
    host.__mat005ListRace = race
    const entry = (name: string): BackupEntry => ({
      name, path: name, created_at: '2026-10-27T00:00:00Z',
      size_bytes: 64, storage_kind: 'external_backup', verified: true,
    })
    const current = entry('vault-backup-abcdef123456-20261027-143000-9999')
    bridge.invoke = (command, args) => {
      if (command === 'authorize_sensitive_operation' && args?.operation === 'create_backup') {
        return Promise.resolve({ token: 'fixture-backup-approval', operation: 'create_backup',
          scope: 'C:/MAT005-A', expiresAtMs: Date.now() + 30000 })
      }
      if (command === 'vault_create_backup') return Promise.resolve(current)
      if (command === 'vault_list_backups' && args?.backupPath === 'C:/MAT005-A') {
        race.requests++
        if (race.requests === 1) {
          // The initial effect-owned list starts before the backup is created.
          // Its response remains pending while the manual backup lists again.
          return new Promise<BackupEntry[]>(resolve => { race.resolveOld = resolve })
        }
        return Promise.resolve([current])
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
    (window as Window & { __mat005ListRace?: { requests: number } }).__mat005ListRace?.requests ?? 0,
  )).toBe(1)

  await backup.getByRole('button', { name: 'Back up now' }).click()
  await expect.poll(() => page.evaluate(() =>
    (window as Window & { __mat005ListRace?: { requests: number } }).__mat005ListRace?.requests ?? 0,
  )).toBe(2)
  await expect(backup.getByText('vault-backup-abcdef123456-20261027-143000-9999', { exact: false })).toBeVisible()

  await page.evaluate(() => {
    const host = window as Window & {
      __mat005ListRace?: { resolveOld?: (entries: unknown[]) => void }
    }
    host.__mat005ListRace?.resolveOld?.([{
      name: 'vault-backup-abcdef123456-20261027-142000-9999',
      path: 'vault-backup-abcdef123456-20261027-142000-9999',
      created_at: '2026-10-27T00:00:00Z',
      size_bytes: 64, storage_kind: 'external_backup', verified: true,
    }])
  })
  // Original code accepted the older effect response because its vault/path
  // still matched. The mutation's newer inventory must remain authoritative.
  await expect(backup.getByText('vault-backup-abcdef123456-20261027-143000-9999', { exact: false })).toBeVisible()
  await expect(backup.getByText('vault-backup-abcdef123456-20261027-142000-9999', { exact: false })).toHaveCount(0)
})

test('late same-scope list error cannot replace a successful post-create inventory', async ({ page }) => {
  await launchApp(page)
  await waitForWorkspace(page)
  await page.evaluate(() => {
    const host = window as Window & {
      __TAURI_INTERNALS__?: NativeBridge
      __mat005ErrorRace?: { requests: number; rejectOld?: (error: Error) => void }
    }
    const native = host.__TAURI_INTERNALS__
    if (!native) throw new Error('Native fixture bridge unavailable')
    const original = native.invoke.bind(native)
    const race: NonNullable<typeof host.__mat005ErrorRace> = { requests: 0 }
    host.__mat005ErrorRace = race
    const entry = {
      name: 'vault-backup-abcdef123456-20261027-151500-9999',
      path: 'vault-backup-abcdef123456-20261027-151500-9999',
      created_at: '2026-10-27T15:15:00Z',
      size_bytes: 64, storage_kind: 'external_backup', verified: true,
    }
    native.invoke = (command, args) => {
      if (command === 'authorize_sensitive_operation' && args?.operation === 'create_backup') {
        return Promise.resolve({
          token: 'fixture-backup-approval',
          operation: 'create_backup',
          scope: 'C:/MAT005-Error',
          expiresAtMs: Date.now() + 30000,
        })
      }
      if (command === 'vault_create_backup') return Promise.resolve(entry)
      if (command === 'vault_list_backups' && args?.backupPath === 'C:/MAT005-Error') {
        race.requests++
        if (race.requests === 1) {
          return new Promise((_, reject) => { race.rejectOld = reject })
        }
        return Promise.resolve([entry])
      }
      return original(command, args)
    }
  })
  await page.locator('header.topbar').getByRole('button', { name: 'Settings' }).click()
  const settings = page.getByRole('dialog', { name: 'Settings' })
  const backup = settings.locator('[data-help-topic="backups"]')
  const options = settings.locator('details.backup-options')
  if (await options.getAttribute('open') === null) await options.locator('summary').click()
  await settings.getByRole('textbox', { name: /Backup folder outside this vault/ }).fill('C:/MAT005-Error')
  await expect.poll(() => page.evaluate(() =>
    (window as Window & { __mat005ErrorRace?: { requests: number } }).__mat005ErrorRace?.requests ?? 0,
  )).toBe(1)
  await backup.getByRole('button', { name: 'Back up now' }).click()
  await expect.poll(() => page.evaluate(() =>
    (window as Window & { __mat005ErrorRace?: { requests: number } }).__mat005ErrorRace?.requests ?? 0,
  )).toBe(2)
  await expect(backup.getByText('vault-backup-abcdef123456-20261027-151500-9999')).toBeVisible()
  await page.evaluate(() => {
    (window as Window & { __mat005ErrorRace?: { rejectOld?: (error: Error) => void } })
      .__mat005ErrorRace?.rejectOld?.(new Error('Outdated access denied'))
  })
  // Give React the opportunity to process the deliberately late rejection.
  await page.waitForTimeout(100)
  await expect(backup.getByText('vault-backup-abcdef123456-20261027-151500-9999')).toBeVisible()
  await expect(backup.getByRole('alert')).toHaveCount(0)
})
