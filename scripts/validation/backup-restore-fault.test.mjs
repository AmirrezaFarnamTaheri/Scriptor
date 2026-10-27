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
const vaultBridge = readFileSync(
  new URL('../../src/bridge/commands/vault.ts', import.meta.url),
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

test('restore lifecycle freezes persistence before replacement and refreshes derived state only after rebuild terminal state', () => {
  const startEvent = useVaultBackup.indexOf("dispatchVaultLifecycleEvent('scriptor:vault-restore-starting'")
  const nativeRestore = useVaultBackup.indexOf('await vaultRestoreBackup(', startEvent)
  const filesRestored = useVaultBackup.indexOf("dispatchVaultLifecycleEvent('scriptor:vault-files-restored'", nativeRestore)
  const rebuild = useVaultBackup.indexOf('await indexerRebuild()', filesRestored)
  const finished = useVaultBackup.indexOf("dispatchVaultLifecycleEvent('scriptor:vault-restored'", rebuild)
  assert.ok(startEvent !== -1 && nativeRestore > startEvent && filesRestored > nativeRestore && rebuild > filesRestored && finished > rebuild)

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

test('a rejected native restore reply keeps the editor frozen until reopen', () => {
  assert.match(vaultBridge, /return runVaultRestoreWithOutcomeBoundary\(/)
  assert.match(vaultBridge, /validateVaultRestoreResult\(await invoke<unknown>/)
  assert.match(useVaultBackup, /classifyVaultRestoreFailure\(caught, restoreApplied\)/)
  const freeze = useVaultBackup.indexOf("if (failure === 'freeze-and-reopen')")
  const resume = useVaultBackup.indexOf("if (failure === 'safe-to-resume')", freeze)
  assert.ok(freeze > 0 && resume > freeze)
  assert.match(useVaultBackup.slice(freeze, resume), /editing remains paused/)
  assert.doesNotMatch(useVaultBackup.slice(freeze, resume), /scriptor:vault-restore-aborted/)
})

test('unconfirmed restore never silently closes a suspended draft or switches vaults', () => {
  // Frozen draft exit approval must not be accepted as save permission.
  const flushStart = workspaceEditor.indexOf('const flushAllPendingSaves = useCallback')
  const flushEnd = workspaceEditor.indexOf('const scheduleSave = useCallback', flushStart)
  assert.ok(flushStart > 0 && flushEnd > flushStart)
  const flush = workspaceEditor.slice(flushStart, flushEnd)
  assert.match(flush, /if \(persistenceSuspendedRef\.current\) return false/)
  assert.doesNotMatch(flush, /requestFrozenDraftExit\(/)
  const closeStart = workspaceEditor.indexOf('appWindow.onCloseRequested(')
  const closeEnd = workspaceEditor.indexOf('await appWindow.destroy()', closeStart)
  assert.ok(closeStart > 0 && closeEnd > closeStart)
  const close = workspaceEditor.slice(closeStart, closeEnd)
  assert.match(close, /persistenceSuspendedRef\.current\s*\?\s*await requestFrozenDraftExitRef\.current\(\)\s*:\s*await flushAllPendingSavesRef\.current\(\)/)
  assert.match(workspaceEditor, /const requestFrozenDraftExitRef = useRef\(requestFrozenDraftExit\)/)
  assert.match(workspaceEditor, /return persistenceSuspendedRef\.current \|\| activeDirty/)
  assert.match(workspaceEditor, /Vault switching is blocked while a restore outcome is unknown/)
  assert.match(useVaultWorkspace, /if \(isEditorPersistenceSuspended\(\)\) \{/)
  assert.match(workspaceEditor, /Discard and close/)
})

test('indeterminate restore blocks repeated backup mutations in affected vault', () => {
  assert.match(useVaultBackup, /isVaultRestoreQuarantined\(recoveryHoldRef\.current, ownedVaultId\)/)
  assert.match(useVaultBackup, /recoveryHoldRef\.current\.add\(id\)/)
  assert.match(useVaultBackup, /quarantineRestore\(requestedVault\)/)
  assert.match(useVaultBackup, /recoveryRequired,/)
  const backupSettings = readFileSync(new URL('../../src/components/VaultBackupSettings.tsx', import.meta.url), 'utf8')
  assert.match(backupSettings, /disabled=\{isBusy \|\| recoveryRequired\}/)
  assert.match(backupSettings, /Restart Scriptor and reopen the vault/)
})

test('backup restore exposes vault-scoped receipts without replacing native outcomes', () => {
  const status = useVaultBackup.indexOf('const disposition = classifyVaultRestoreStatus(result.status)')
  const receipt = useVaultBackup.indexOf('setRestoreReceipt(buildRestoreOperationReceipt(', status)
  assert.ok(status >= 0 && receipt > status)
  assert.match(useVaultBackup, /const lastRestoreReceipt = visibleOperationReceipt\(restoreReceipt, ownedVaultId, settings\.backupPath\)/)
  assert.match(useVaultBackup, /outcome: \{ kind: 'reply-missing' \}/)
  assert.match(useVaultBackup, /outcome: \{ kind: 'not-submitted' \}/)
  assert.match(useVaultBackup, /outcome: \{ kind: 'post-commit-refresh-failed'/)
})
test('confirmed native reopen-required status and post-commit refresh failure quarantine the vault', () => {
  const nativeBranch = useVaultBackup.indexOf('if (!disposition.refreshWorkspace)')
  const refreshBranch = useVaultBackup.indexOf('// Reload authoritative', nativeBranch)
  assert.ok(nativeBranch >= 0 && refreshBranch > nativeBranch)
  assert.match(useVaultBackup.slice(nativeBranch, refreshBranch), /quarantineRestore\(requestedVault\)/)

  const postCommitComment = useVaultBackup.indexOf('durable operation as failed')
  const postCommitError = useVaultBackup.indexOf('Vault files were restored, but workspace resynchronization failed', postCommitComment)
  assert.ok(postCommitComment > 0 && postCommitError > postCommitComment)
  assert.match(useVaultBackup.slice(postCommitComment, postCommitError), /quarantineRestore\(requestedVault\)/)
})

test('recovery hold warning does not falsely assert a lost native reply', () => {
  const backupSettings = readFileSync(new URL('../../src/components/VaultBackupSettings.tsx', import.meta.url), 'utf8')
  assert.match(backupSettings, /This vault needs recovery before backup operations can continue/)
  assert.doesNotMatch(backupSettings, /An earlier restore did not return a confirmed result/)
})

test('backup Restore and Delete confirmations cannot transfer between vaults or folders', () => {
  const settings = readFileSync(new URL('../../src/components/VaultBackupSettings.tsx', import.meta.url), 'utf8')
  const parent = readFileSync(new URL('../../src/components/SettingsPanel.tsx', import.meta.url), 'utf8')
  assert.match(settings, /matchesBackupActionScope\(pendingAction, backupScope, entry\.name\)/)
  assert.match(settings, /setPendingAction\(createPendingBackupAction\(backupScope, entry\.name, 'restore'\)\)/)
  assert.match(settings, /setPendingAction\(createPendingBackupAction\(backupScope, entry\.name, 'delete'\)\)/)
  assert.match(settings, /if \(!matchesBackupActionScope\(selected, backupScope, entry\.name\)/)
  assert.match(settings, /setPendingAction\(null\)[\s\S]*setSettings\(\{ backupPath: event\.target\.value \}\)/)
  assert.match(parent, /<VaultBackupSettings key=\{vaultId \?\? 'closed'\}/)
})

test('older retained backups have an explicit bounded disclosure and cannot reuse hidden approvals', () => {
  const source = readFileSync(new URL('../../src/components/VaultBackupSettings.tsx', import.meta.url), 'utf8')
  assert.match(source, /backups\.slice\(0, visibleBackupCount\)/)
  assert.match(source, /Show .*older backups/)
  assert.match(source, /aria-expanded=\{visibleBackupCount > BACKUP_PAGE_SIZE\}/)
  assert.match(source, /Show fewer backups/)
  assert.match(source, /setPendingAction\(null\)[\s\S]*setVisibleBackupCount\(BACKUP_PAGE_SIZE\)/)
  assert.doesNotMatch(source, /backups\.slice\(0, 10\)/)
})

test('a backup with failed native integrity verification cannot enter the Restore confirmation', () => {
  const settings = readFileSync(new URL('../../src/components/VaultBackupSettings.tsx', import.meta.url), 'utf8')
  assert.match(settings, /disabled=\{isBusy \|\| recoveryRequired \|\| !entry\.verified\}/)
  assert.match(settings, /aria-describedby=\{!entry\.verified \?/)
  assert.match(settings, /This backup could not be verified, so it cannot be restored/)
  assert.match(settings, /Delete backup/)
})
