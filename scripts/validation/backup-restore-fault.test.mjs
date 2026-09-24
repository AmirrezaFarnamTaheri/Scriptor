import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const backupRs = readFileSync(
  new URL('../../apps/desktop/src-tauri/src/commands/backup.rs', import.meta.url),
  'utf8',
)
const vaultRs = readFileSync(
  new URL('../../apps/desktop/src-tauri/src/commands/vault.rs', import.meta.url),
  'utf8',
)
const useVaultBackup = readFileSync(
  new URL('../../src/hooks/useVaultBackup.ts', import.meta.url),
  'utf8',
)
const useVaultWorkspace = readFileSync(
  new URL('../../src/hooks/useVaultWorkspace.ts', import.meta.url),
  'utf8',
)
const workspaceEditor = readFileSync(
  new URL('../../src/hooks/useWorkspaceEditor.ts', import.meta.url),
  'utf8',
)

test('vault_open blocks session initialization until interrupted restore recovery succeeds', () => {
  const vaultOpenIndex = vaultRs.indexOf('pub fn vault_open(')
  const recoverIndex = vaultRs.indexOf('super::backup::recover_interrupted_restore(path)', vaultOpenIndex)
  const openVaultIndex = vaultRs.indexOf('let session = open_vault(&root_path)', recoverIndex)
  assert.ok(vaultOpenIndex !== -1 && recoverIndex > vaultOpenIndex && openVaultIndex > recoverIndex)
  assert.ok(vaultRs.includes('.map_err(|error| format!("Failed to recover interrupted restore: {error}"))?'))
})

test('restore recovery preserves unresolved journals and has executable Rust failure-path coverage', () => {
  assert.ok(backupRs.includes('rollback snapshot is missing. Journal preserved for manual inspection.'))
  assert.ok(backupRs.includes('Unrecognized restore journal state'))
  assert.ok(backupRs.includes('fn interrupted_restore_missing_rollback_preserves_journal()'))
  assert.ok(backupRs.includes('fn unrecognized_restore_state_is_preserved()'))
  assert.ok(backupRs.includes('fn interrupted_restore_in_promoting_state_rolls_back_cleanly()'))
  assert.ok(backupRs.includes('fn complete_restore_journal_is_safe_to_finalize_on_restart()'))
})

test('backup listing owns its namespace and never surfaces arbitrary sibling directories', () => {
  assert.ok(backupRs.includes('fn list_backup_entries('))
  assert.ok(/if validate_backup_name\(&name\)\.is_err\(\)\s*\{\s*continue;\s*\}/.test(backupRs))
  assert.ok(backupRs.includes('fn backup_listing_ignores_unowned_directories_but_keeps_owned_corrupt_entries_visible()'))
})

test('backup creation and restore serialize against vault session mutation', () => {
  const createStart = backupRs.indexOf('pub fn vault_create_backup(')
  const restoreStart = backupRs.indexOf('pub fn vault_restore_backup(')
  assert.ok(
    backupRs.indexOf('lock_recover(&state.vault_switch_lock, "vault backup")', createStart) > createStart,
  )
  assert.ok(backupRs.indexOf('write_recover(&state.session, "session")', createStart) > createStart)
  assert.ok(
    backupRs.indexOf('lock_recover(&state.vault_switch_lock, "vault switch")', restoreStart) > restoreStart,
  )
  assert.ok(backupRs.indexOf('write_recover(&state.session, "session")', restoreStart) > restoreStart)
})

test('restore lifecycle freezes persistence only after authorization and fails closed on ambiguous invoke rejection', () => {
  const authorization = useVaultBackup.indexOf('await authorizeVaultRestoreBackup(backupName)')
  const startEvent = useVaultBackup.indexOf("dispatchVaultLifecycleEvent('scriptor:vault-restore-starting'", authorization)
  const nativeRestore = useVaultBackup.indexOf('await vaultRestoreBackupAuthorized(', startEvent)
  const filesRestored = useVaultBackup.indexOf("dispatchVaultLifecycleEvent('scriptor:vault-files-restored'", nativeRestore)
  const rebuild = useVaultBackup.indexOf('await indexerRebuild()', filesRestored)
  const finished = useVaultBackup.indexOf("dispatchVaultLifecycleEvent('scriptor:vault-restored'", rebuild)
  assert.ok(authorization !== -1 && startEvent > authorization && nativeRestore > startEvent && filesRestored > nativeRestore && rebuild > filesRestored && finished > rebuild)
  assert.ok(useVaultBackup.includes('else if (!nativeInvocationStarted)'))
  assert.ok(useVaultBackup.includes('Editor persistence remains paused; reopen the vault before editing'))
  assert.ok(useVaultBackup.includes("dispatchVaultLifecycleEvent('scriptor:vault-restore-aborted'"))

  assert.ok(workspaceEditor.includes('persistenceGenerationRef.current += 1'))
  assert.ok(workspaceEditor.includes('saveTimersByDocRef.current.clear()'))
  assert.ok(workspaceEditor.includes('pendingRequestsByDocRef.current.clear()'))
  assert.ok(workspaceEditor.includes('await saveTailRef.current'))

  assert.ok(useVaultWorkspace.includes("window.addEventListener('scriptor:vault-restore-starting'"))
  assert.ok(useVaultWorkspace.includes("window.addEventListener('scriptor:vault-files-restored'"))
  assert.ok(useVaultWorkspace.includes("window.addEventListener('scriptor:vault-restored'"))
  assert.ok(useVaultWorkspace.includes('if (detail?.indexReady !== false)'))
  assert.ok(useVaultWorkspace.includes('await refreshVault()'))
  assert.ok(useVaultWorkspace.includes('setNoteSummaries([])'))
  assert.ok(useVaultWorkspace.includes('refreshVaultConfig()'))
  assert.ok(useVaultWorkspace.includes('refreshVaultSnippets()'))
})
