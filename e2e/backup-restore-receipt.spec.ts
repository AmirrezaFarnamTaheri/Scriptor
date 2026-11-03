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
  // The backup hook loads on vault open, before this fixture override. Changing
  // its configured destination triggers the real re-fetch after the override.
  const options = settings.locator('details.backup-options')
  if (await options.getAttribute('open') === null) await options.locator('summary').click()
  await settings.getByRole('textbox', { name: /Backup folder outside this vault/ }).fill('C:/ReceiptFixture')
  await expect(backup.getByText('vault-backup-test-123')).toBeVisible()
  await backup.getByRole('button', { name: 'Restore backup vault-backup-test-123' }).click()
  await backup.getByRole('button', { name: 'Restore backup', exact: true }).click()

  const summary = backup.getByRole('region', { name: 'Last restore attempt (this session)' })
  await expect(summary).toBeVisible()
  await expect(summary.getByRole('status')).toContainText('Restore rolled back')
  await expect(summary).toContainText('original vault files are unchanged')
  await expect(summary).not.toContainText('Files restored')
})


test('restore and delete confirmations do not transfer to another backup folder', async ({ page }) => {
  await launchApp(page)
  await waitForWorkspace(page)
  await page.evaluate(() => {
    const host = window as Window & {
      __TAURI_INTERNALS__?: NativeBridge
      __scriptorBackupEffects?: Array<{ command: string; backupPath: string }>
    }
    const native = host.__TAURI_INTERNALS__
    if (!native) throw new Error('Native fixture bridge unavailable')
    const invoke = native.invoke.bind(native)
    host.__scriptorBackupEffects = []
    native.invoke = (command, args) => {
      if (command === 'vault_list_backups') return Promise.resolve([{
        name: 'same-backup-name',
        path: 'same-backup-name',
        created_at: '2026-10-27T00:00:00Z',
        size_bytes: 256,
        storage_kind: 'external_backup',
        verified: true,
      }])
      if (command === 'vault_restore_backup' || command === 'vault_delete_backup') {
        host.__scriptorBackupEffects?.push({
          command,
          backupPath: typeof args?.backupPath === 'string' ? args.backupPath : '',
        })
        return command === 'vault_restore_backup'
          ? Promise.resolve({ status: 'rolled-back', message: 'Native restore rolled back without changing files.' })
          : Promise.resolve()
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
  await folder.fill('C:/Backup-A')

  const restore = backup.getByRole('button', { name: 'Restore backup same-backup-name' })
  await expect(restore).toBeVisible()
  await restore.click()
  const restoreApproval = backup.getByRole('group', { name: 'Restore backup same-backup-name' })
  await expect(restoreApproval).toBeVisible()
  // The second folder returns the same backup name. Its new native identity
  // must not inherit approval granted to the first folder.
  await folder.fill('C:/Backup-B')
  await expect(restoreApproval).toHaveCount(0)
  await expect(restore).toBeVisible()

  const remove = backup.getByRole('button', { name: 'Delete backup same-backup-name' })
  await remove.click()
  const deleteApproval = backup.getByRole('group', { name: 'Delete backup same-backup-name' })
  await expect(deleteApproval).toBeVisible()
  await folder.fill('C:/Backup-C')
  await expect(deleteApproval).toHaveCount(0)
  const recordedEffects = () => page.evaluate(() =>
    (window as Window & { __scriptorBackupEffects?: Array<{ command: string; backupPath: string }> }).__scriptorBackupEffects ?? [])
  await expect.poll(recordedEffects).toEqual([])

  // A new, explicit confirmation for the new folder may still succeed.
  await expect(remove).toBeVisible()
  await remove.click()
  await backup.getByRole('group', { name: 'Delete backup same-backup-name' })
    .getByRole('button', { name: 'Delete backup', exact: true }).click()
  await expect.poll(recordedEffects).toEqual([
    { command: 'vault_delete_backup', backupPath: 'C:/Backup-C' },
  ])
})

test('older retained backups remain selectable instead of disappearing after the first ten', async ({ page }) => {
  await launchApp(page)
  await waitForWorkspace(page)
  await page.evaluate(() => {
    const host = window as Window & { __TAURI_INTERNALS__?: NativeBridge }
    const native = host.__TAURI_INTERNALS__
    if (!native) throw new Error('Native fixture bridge unavailable')
    const invoke = native.invoke.bind(native)
    native.invoke = (command, args) => command === 'vault_list_backups'
      ? Promise.resolve(Array.from({ length: 12 }, (_, index) => ({
          name: `retained-snapshot-${String(index + 1).padStart(2, '0')}`,
          path: `retained-snapshot-${String(index + 1).padStart(2, '0')}`,
          created_at: '2026-10-27T00:00:00Z',
          size_bytes: 256,
          storage_kind: 'external_backup',
          verified: true,
        })))
      : invoke(command, args)
  })
  await page.locator('header.topbar').getByRole('button', { name: 'Settings' }).click()
  const settings = page.getByRole('dialog', { name: 'Settings' })
  const backup = settings.locator('[data-help-topic="backups"]')
  const options = settings.locator('details.backup-options')
  if (await options.getAttribute('open') === null) await options.locator('summary').click()
  await settings.getByRole('textbox', { name: /Backup folder outside this vault/ }).fill('C:/OlderSnapshots')
  // Recovery Center has separate read-only diagnostic rows; count only the saved backups.
  await expect(backup.locator('#vault-backup-list .backup-entry')).toHaveCount(10)
  await expect(backup.getByRole('button', { name: 'Restore backup retained-snapshot-11' })).toHaveCount(0)
  const older = backup.getByRole('button', { name: 'Show 2 older backups' })
  await expect(older).toBeVisible()
  await older.click()
  await expect(backup.getByRole('button', { name: 'Show fewer backups' })).toBeFocused()
  await expect(backup.locator('#vault-backup-list .backup-entry')).toHaveCount(12)
  await expect(backup.getByRole('button', { name: 'Restore backup retained-snapshot-12' })).toBeVisible()
  await backup.getByRole('button', { name: 'Show fewer backups' }).click()
  await expect(backup.getByRole('button', { name: 'Show 2 older backups' })).toBeFocused()
  await expect(backup.locator('#vault-backup-list .backup-entry')).toHaveCount(10)
})

test('unverified backup is visible for inspection but never eligible for Restore', async ({ page }) => {
  await launchApp(page)
  await waitForWorkspace(page)
  await page.evaluate(() => {
    const host = window as Window & { __TAURI_INTERNALS__?: NativeBridge; __unverifiedRestoreCalls?: number }
    const native = host.__TAURI_INTERNALS__
    if (!native) throw new Error('Native fixture bridge unavailable')
    const invoke = native.invoke.bind(native)
    host.__unverifiedRestoreCalls = 0
    native.invoke = (command, args) => {
      if (command === 'vault_list_backups') return Promise.resolve([
        { name: 'vault-backup-corrupt', path: 'vault-backup-corrupt', created_at: '2026-10-27T00:00:00Z',
          size_bytes: 512, storage_kind: 'external_backup', verified: false },
        { name: 'vault-backup-valid', path: 'vault-backup-valid', created_at: '2026-10-27T00:00:00Z',
          size_bytes: 512, storage_kind: 'external_backup', verified: true },
      ])
      if (command === 'vault_restore_backup') {
        host.__unverifiedRestoreCalls = (host.__unverifiedRestoreCalls ?? 0) + 1
        return Promise.reject(new Error('Restore must not be submitted for unverified backup'))
      }
      return invoke(command, args)
    }
  })
  await page.locator('header.topbar').getByRole('button', { name: 'Settings' }).click()
  const settings = page.getByRole('dialog', { name: 'Settings' })
  const backup = settings.locator('[data-help-topic="backups"]')
  const options = settings.locator('details.backup-options')
  if (await options.getAttribute('open') === null) await options.locator('summary').click()
  await settings.getByRole('textbox', { name: /Backup folder outside this vault/ }).fill('C:/UnverifiedFixture')
  const bad = backup.locator('.backup-entry').filter({ hasText: 'vault-backup-corrupt' })
  await expect(bad.getByRole('button', { name: 'Restore backup vault-backup-corrupt' })).toBeDisabled()
  await expect(bad).toContainText('This backup could not be verified')
  await expect(bad.getByRole('button', { name: 'Delete backup vault-backup-corrupt' })).toBeEnabled()
  const good = backup.locator('.backup-entry').filter({ hasText: 'vault-backup-valid' })
  await expect(good.getByRole('button', { name: 'Restore backup vault-backup-valid' })).toBeEnabled()
  await expect.poll(() => page.evaluate(() =>
    (window as Window & { __unverifiedRestoreCalls?: number }).__unverifiedRestoreCalls ?? 0,
  )).toBe(0)
})

test('one hidden backup uses a singular, keyboard-accessible disclosure label', async ({ page }) => {
  await launchApp(page)
  await waitForWorkspace(page)
  await page.evaluate(() => {
    const host = window as Window & { __TAURI_INTERNALS__?: NativeBridge }
    const bridge = host.__TAURI_INTERNALS__
    if (!bridge) throw new Error('Native fixture bridge unavailable')
    const original = bridge.invoke.bind(bridge)
    bridge.invoke = (command, args) => command === 'vault_list_backups'
      ? Promise.resolve(Array.from({ length: 11 }, (_, i) => ({
          name: `vault-backup-single-${String(i + 1).padStart(2, '0')}`,
          path: `vault-backup-single-${String(i + 1).padStart(2, '0')}`,
          created_at: '2026-10-27T00:00:00Z',
          size_bytes: 128,
          storage_kind: 'external_backup',
          verified: true,
        })))
      : original(command, args)
  })
  await page.locator('header.topbar').getByRole('button', { name: 'Settings' }).click()
  const settings = page.getByRole('dialog', { name: 'Settings' })
  const backup = settings.locator('[data-help-topic="backups"]')
  const options = settings.locator('details.backup-options')
  if (await options.getAttribute('open') === null) await options.locator('summary').click()
  await settings.getByRole('textbox', { name: /Backup folder outside this vault/ }).fill('C:/SingleOlderBackup')
  await expect(backup.locator('#vault-backup-list .backup-entry')).toHaveCount(10)
  const disclosure = backup.getByRole('button', { name: 'Show 1 older backup', exact: true })
  await expect(disclosure).toBeVisible()
  await expect(disclosure).toHaveAttribute('aria-expanded', 'false')
  await disclosure.click()
  await expect(backup.locator('#vault-backup-list .backup-entry')).toHaveCount(11)
  const collapse = backup.getByRole('button', { name: 'Show fewer backups' })
  await expect(collapse).toBeFocused()
  await expect(collapse).toHaveAttribute('aria-expanded', 'true')
})

test('MAT-003: read-only Recovery Center reports native Git conflicts without treating other edits as safe', async ({ page }) => {
  await launchApp(page)
  await waitForWorkspace(page)
  await page.evaluate(() => {
    const host = window as Window & { __TAURI_INTERNALS__?: NativeBridge; __gitRecoveryWrites?: string[] }
    const native = host.__TAURI_INTERNALS__
    if (!native) throw new Error('Native fixture bridge unavailable')
    const invoke = native.invoke.bind(native)
    host.__gitRecoveryWrites = []
    native.invoke = (command, args) => {
      if (command === 'git_status_cmd') {
        const conflicted_files = [
          { path: 'Notes/Draft.md', status: 'conflict', conflict: true },
          { path: 'Research/Source.md', status: 'conflict', conflict: true },
        ]
        return Promise.resolve({
          is_repo: true, branch: 'main', has_conflicts: true,
          clean: false, changed_files: conflicted_files, ahead: 0, behind: 0, has_upstream: false,
          conflicted_files,
        })
      }
      if (/^git_(commit|pull|push|resolve|apply)/.test(command)) host.__gitRecoveryWrites?.push(command)
      return invoke(command, args)
    }
  })
  await page.locator('header.topbar').getByRole('button', { name: 'Settings' }).click()
  const settings = page.getByRole('dialog', { name: 'Settings' })
  const recovery = settings.locator('section.backup-recovery-tools').filter({ hasText: 'Recovery Center' })
  const git = recovery.locator('li').filter({ hasText: 'Git merge conflicts' })
  await expect(git).toContainText('available')
  await expect(git).toContainText('2 reported')
  await expect(git).toContainText('Non-Git external changes are not covered')
  await expect(git.getByRole('button')).toHaveCount(0)
  await expect(recovery.locator('li').filter({ hasText: 'External file conflicts' })).toContainText('unverified')
  expect(await page.evaluate(() => (window as Window & { __gitRecoveryWrites?: string[] }).__gitRecoveryWrites ?? [])).toEqual([])
})

test('MAT-003: Canvas Recovery Center uses current-vault native checkpoint counts and only navigates on review', async ({ page }) => {
  await launchApp(page)
  await waitForWorkspace(page)
  await page.evaluate(() => {
    const host = window as Window & { __TAURI_INTERNALS__?: NativeBridge; __canvasRecoveryMutations?: string[] }
    const native = host.__TAURI_INTERNALS__
    if (!native) throw new Error('Native bridge missing')
    const invoke = native.invoke.bind(native)
    host.__canvasRecoveryMutations = []
    native.invoke = (command, args) => {
      if (command === 'canvas_list_template_checkpoints') {
        return Promise.resolve({ vaultId: args?.expectedVaultId, checkpointCount: 2,
          invalidCount: 0, complete: true })
      }
      if (command === 'canvas_restore_template' || command === 'canvas_save_document') {
        host.__canvasRecoveryMutations?.push(command)
      }
      return invoke(command, args)
    }
  })
  await page.locator('header.topbar').getByRole('button', { name: 'Settings' }).click()
  const settings = page.getByRole('dialog', { name: 'Settings' })
  const recovery = settings.locator('section.backup-recovery-tools').filter({ hasText: 'Recovery Center' })
  const canvas = recovery.locator('li').filter({ hasText: 'Canvas recovery' })
  await expect(canvas).toContainText('available')
  await expect(canvas).toContainText('2 reported')
  await expect(canvas).toContainText('separate authorization')
  await canvas.getByRole('button', { name: 'Open Canvas workspace', exact: true }).click()
  await expect(settings).toBeHidden()
  await expect(page.getByRole('dialog', { name: 'Canvas board', exact: true })).toBeVisible()
  expect(await page.evaluate(() => (window as Window & { __canvasRecoveryMutations?: string[] }).__canvasRecoveryMutations ?? [])).toEqual([])
})

test('MAT-003: corrupt Canvas native checkpoint metadata never becomes a safe empty recovery status', async ({ page }) => {
  await launchApp(page)
  await waitForWorkspace(page)
  await page.evaluate(() => {
    const host = window as Window & { __TAURI_INTERNALS__?: NativeBridge }
    const native = host.__TAURI_INTERNALS__
    if (!native) throw new Error('Native bridge missing')
    const invoke = native.invoke.bind(native)
    native.invoke = (command, args) => command === 'canvas_list_template_checkpoints'
      ? Promise.resolve({ vaultId: args?.expectedVaultId, checkpointCount: 0,
          invalidCount: 1, complete: true })
      : invoke(command, args)
  })
  await page.locator('header.topbar').getByRole('button', { name: 'Settings' }).click()
  const recovery = page.getByRole('dialog', { name: 'Settings' })
    .locator('section.backup-recovery-tools').filter({ hasText: 'Recovery Center' })
  const canvas = recovery.locator('li').filter({ hasText: 'Canvas recovery' })
  await expect(canvas).toContainText('unverified')
  await expect(canvas).not.toContainText('0 reported')
  await expect(canvas.getByRole('button')).toHaveCount(0)
})

test('MAT-002: lost native delete reply blocks same-backup retry but not another destination', async ({ page }) => {
  await launchApp(page)
  await waitForWorkspace(page)
  await page.evaluate(() => {
    const host = window as Window & { __TAURI_INTERNALS__?: NativeBridge; __backupDeleteCalls?: number }
    const bridge = host.__TAURI_INTERNALS__
    if (!bridge) throw new Error('Native fixture bridge unavailable')
    const original = bridge.invoke.bind(bridge)
    host.__backupDeleteCalls = 0
    bridge.invoke = (command, args) => {
      if (command === 'vault_list_backups') return Promise.resolve([{
        name: 'delete-uncertain', path: 'delete-uncertain',
        created_at: '2026-11-03T00:00:00Z', size_bytes: 1024,
        storage_kind: 'external_backup', verified: true,
      }])
      if (command === 'vault_delete_backup') {
        host.__backupDeleteCalls = (host.__backupDeleteCalls ?? 0) + 1
        return Promise.reject(new Error('Native reply lost after delete submission'))
      }
      return original(command, args)
    }
  })

  await page.locator('header.topbar').getByRole('button', { name: 'Settings' }).click()
  const settings = page.getByRole('dialog', { name: 'Settings' })
  const backup = settings.locator('[data-help-topic="backups"]')
  const options = settings.locator('details.backup-options')
  if (await options.getAttribute('open') === null) await options.locator('summary').click()
  const folder = settings.getByRole('textbox', { name: /Backup folder outside this vault/ })
  await folder.fill('C:/NoReplyA')
  const deletion = backup.getByRole('button', { name: 'Delete backup delete-uncertain' })
  await expect(deletion).toBeEnabled()
  await deletion.click()
  await backup.getByRole('group', { name: 'Delete backup delete-uncertain' })
    .getByRole('button', { name: 'Delete backup', exact: true }).click()
  await expect(backup.getByRole('status')).toContainText('indeterminate')
  await expect(deletion).toBeDisabled()
  await expect(backup.locator('#vault-backup-list .backup-entry').getByRole('alert')).toContainText('same-session retry is blocked')
  await expect.poll(() => page.evaluate(() =>
    (window as Window & { __backupDeleteCalls?: number }).__backupDeleteCalls ?? 0,
  )).toBe(1)

  // The same filename in a different backup destination has another owner.
  await folder.fill('C:/NoReplyB')
  await expect(deletion).toBeEnabled()
  await folder.fill('C:/NoReplyA')
  await expect(deletion).toBeDisabled()
  // Windows aliases of the same physical destination must not bypass the hold.
  await folder.fill('c:/noreplya/')
  await expect(deletion).toBeDisabled()
  await expect.poll(() => page.evaluate(() =>
    (window as Window & { __backupDeleteCalls?: number }).__backupDeleteCalls ?? 0,
  )).toBe(1)
})

test('MAT-002: lost retention-delete reply disables blind pruning after a later backup', async ({ page }) => {
  await launchApp(page)
  await waitForWorkspace(page)
  await page.evaluate(() => {
    const host = window as Window & {
      __TAURI_INTERNALS__?: NativeBridge
      __mat002Retention?: { created: number; deleted: number }
    }
    const bridge = host.__TAURI_INTERNALS__
    if (!bridge) throw new Error('Native fixture bridge unavailable')
    const original = bridge.invoke.bind(bridge)
    const state = { created: 0, deleted: 0 }
    host.__mat002Retention = state
    const newest = 'vault-backup-abcdef123456-20261103-120000-123'
    const older = 'vault-backup-abcdef123456-20261102-120000-123'
    const entry = (name: string) => ({
      name, path: name, created_at: '2026-11-03T12:00:00Z',
      size_bytes: 512, storage_kind: 'external_backup', verified: true,
    })
    bridge.invoke = (command, args) => {
      if (command === 'authorize_sensitive_operation' &&
        (args?.operation === 'create_backup' || args?.operation === 'delete_backup')) {
        return Promise.resolve({ token: 'fixture-retention-approval', operation: args?.operation,
          scope: args?.scope, expiresAtMs: Date.now() + 30000 })
      }
      if (command === 'vault_list_backups' && args?.backupPath === 'C:/RetentionNoReply') {
        return Promise.resolve([entry(newest), entry(older)])
      }
      if (command === 'vault_create_backup') {
        state.created += 1
        return Promise.resolve(entry(newest))
      }
      if (command === 'vault_delete_backup') {
        state.deleted += 1
        return Promise.reject(new Error('native delete response lost after durable removal'))
      }
      return original(command, args)
    }
  })

  await page.locator('header.topbar').getByRole('button', { name: 'Settings' }).click()
  const settings = page.getByRole('dialog', { name: 'Settings' })
  const backup = settings.locator('[data-help-topic="backups"]')
  const options = settings.locator('details.backup-options')
  if (await options.getAttribute('open') === null) await options.locator('summary').click()
  await settings.getByRole('spinbutton', { name: 'Recovery copies to keep' }).fill('1')
  await settings.getByRole('textbox', { name: /Backup folder outside this vault/ }).fill('C:/RetentionNoReply')
  await expect(backup.getByRole('button', { name: 'Back up now' })).toBeEnabled()
  const counts = () => page.evaluate(() =>
    (window as Window & { __mat002Retention?: { created: number; deleted: number } }).__mat002Retention)
  await backup.getByRole('button', { name: 'Back up now' }).click()
  await expect.poll(counts).toEqual({ created: 1, deleted: 1 })
  await expect(backup.getByRole('alert').filter({ hasText: /retention.*unconfirmed|unconfirmed.*retention/i })).toBeVisible()
  await expect(backup.getByRole('button', { name: 'Delete backup vault-backup-abcdef123456-20261102-120000-123' })).toBeDisabled()

  // Native has not confirmed the effect. A second backup is allowed, but
  // automatic retention must NOT repeat the same uncertain deletion.
  await backup.getByRole('button', { name: 'Back up now' }).click()
  await expect.poll(counts).toEqual({ created: 2, deleted: 1 })
})
