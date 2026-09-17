import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const backupRsPath = new URL('../../apps/desktop/src-tauri/src/commands/backup.rs', import.meta.url)
const vaultRsPath = new URL('../../apps/desktop/src-tauri/src/commands/vault.rs', import.meta.url)
const useVaultBackupPath = new URL('../../src/hooks/useVaultBackup.ts', import.meta.url)
const useVaultWorkspacePath = new URL('../../src/hooks/useVaultWorkspace.ts', import.meta.url)

const backupRs = readFileSync(backupRsPath, 'utf8')
const vaultRs = readFileSync(vaultRsPath, 'utf8')
const useVaultBackup = readFileSync(useVaultBackupPath, 'utf8')
const useVaultWorkspace = readFileSync(useVaultWorkspacePath, 'utf8')

test('vault_open invokes recover_interrupted_restore before session initialization', () => {
  assert.ok(
    backupRs.includes('pub fn recover_interrupted_restore(vault_root: &Path)'),
    'backup.rs must export recover_interrupted_restore',
  )
  assert.ok(
    vaultRs.includes('super::backup::recover_interrupted_restore(path)'),
    'vault_open must invoke recover_interrupted_restore and propagate errors',
  )
  const vaultOpenIndex = vaultRs.indexOf('pub fn vault_open(')
  const recoverIndex = vaultRs.indexOf('super::backup::recover_interrupted_restore(path)', vaultOpenIndex)
  const openVaultIndex = vaultRs.indexOf('let session = open_vault(&root_path)', recoverIndex)
  assert.ok(
    vaultOpenIndex !== -1 && recoverIndex > vaultOpenIndex && openVaultIndex > recoverIndex,
    'recover_interrupted_restore must be called before open_vault in vault_open',
  )
})

test('recover_interrupted_restore handles promoting crash recovery and cleans journal', () => {
  assert.ok(
    backupRs.includes('if state == "promoting" {'),
    'recover_interrupted_restore must handle promoting state',
  )
  assert.ok(
    backupRs.includes('clear_persistent_vault_content(vault_root)'),
    'recover_interrupted_restore must clear corrupted vault state before rollback',
  )
  assert.ok(
    backupRs.includes('copy_tree(&rollback, vault_root, Path::new(""), &mut ignored)'),
    'recover_interrupted_restore must restore files from rollback snapshot',
  )
  assert.ok(
    backupRs.includes('fs::remove_dir_all(&journal)'),
    'recover_interrupted_restore must clean up the journal upon successful rollback',
  )
})

test('vault_restore_backup serializes exclusive access and refreshes session', () => {
  assert.ok(
    backupRs.includes('let _switch = crate::state::lock_recover(&state.vault_switch_lock, "vault switch");'),
    'vault_restore_backup must acquire vault_switch_lock',
  )
  assert.ok(
    backupRs.includes('let mut session_guard = write_recover(&state.session, "session");'),
    'vault_restore_backup must acquire exclusive write lock on session',
  )
  assert.ok(
    backupRs.includes('let refreshed_session = scriptor_vault::open_vault(&vault_root)'),
    'vault_restore_backup must reload session after restore',
  )
  assert.ok(
    backupRs.includes('crate::state::reset_git_queue(&state);'),
    'vault_restore_backup must reset Git queue handle',
  )
})

test('should_skip_backup_path excludes rename transactions and recovery journals', () => {
  assert.ok(
    backupRs.includes('second.starts_with("rename-txn")'),
    'should_skip_backup_path must exclude rename-txn directories',
  )
  assert.ok(
    backupRs.includes('"restore-journal"'),
    'should_skip_backup_path must exclude restore-journal',
  )
})

test('useVaultBackup rebuilds index, emits event, and fires callback on restore', () => {
  assert.ok(
    useVaultBackup.includes('await indexerRebuild()'),
    'useVaultBackup must trigger index rebuild upon restore',
  )
  assert.ok(
    useVaultBackup.includes("window.dispatchEvent(new CustomEvent('scriptor:vault-restored'"),
    'useVaultBackup must dispatch scriptor:vault-restored event',
  )
  assert.ok(
    useVaultBackup.includes('onRestored?.()'),
    'useVaultBackup must invoke optional onRestored callback',
  )
})

test('useVaultWorkspace listens for scriptor:vault-restored and triggers refreshVault', () => {
  assert.ok(
    useVaultWorkspace.includes("window.addEventListener('scriptor:vault-restored'"),
    'useVaultWorkspace must listen for scriptor:vault-restored',
  )
  assert.ok(
    useVaultWorkspace.includes('void refreshVault()'),
    'useVaultWorkspace must call refreshVault on vault restored event',
  )
  assert.ok(
    useVaultWorkspace.includes('void reloadActiveNoteFromDisk()'),
    'useVaultWorkspace must call reloadActiveNoteFromDisk on vault restored event',
  )
})
