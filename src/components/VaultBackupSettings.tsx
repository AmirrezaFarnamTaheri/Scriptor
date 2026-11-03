import { memo, useEffect, useState } from 'react'
import { MutationConfirmation } from './chrome/MutationConfirmation'
import { HardDrive } from 'lucide-react'
import { createPendingBackupAction, matchesBackupActionScope, type PendingBackupAction } from '../lib/workspace/backupActionScope'
import { recoveryHistoryAvailability, type RecoveryHistoryReason } from '../lib/workspace/recoveryHistoryAvailability'
import { describeRestoreReceipt } from '../lib/workspace/restoreReceiptPresentation'
import { buildRecoveryInventory } from '../lib/workspace/recoveryInventory'
import { vaultListNoteHistory } from '../bridge/commands/vault'
import { gitStatus } from '../bridge/commands/git'
import { inspectGitConflictEvidence } from '../lib/workspace/gitConflictRecoveryEvidence'
import { inspectActiveExternalConflict } from '../lib/workspace/externalConflictRecoveryEvidence'
import { inspectCanvasRecoveryEvidence, type CanvasRecoveryEvidence } from '../lib/workspace/canvasRecoveryEvidence'
import { canvasListTemplateCheckpoints } from '../bridge/canvas'
import type { ExternalChangeConflict } from '../types/vault'

import type { useVaultBackup } from '../hooks/useVaultBackup'

type BackupHook = ReturnType<typeof useVaultBackup>
const BACKUP_PAGE_SIZE = 10

interface VaultBackupSettingsProps {
  backup: BackupHook
  vaultId: string | null
  activePath: string | null
  activeNoteVaultId: string | null
  externalChangeConflict: ExternalChangeConflict | null
  settingsDirty: boolean
  onOpenNoteHistory: () => void
  onOpenCanvas: () => void
  onOpenGitPanel: () => void
  onOpenExternalConflict: () => void
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
}

function formatDate(iso: string): string {
  if (!iso) return '—'
  try {
    const parsed = new Date(iso)
    return Number.isNaN(parsed.getTime()) ? iso : parsed.toLocaleString()
  } catch {
    return iso
  }
}

export const VaultBackupSettings = memo(function VaultBackupSettings({ backup, vaultId, activePath, activeNoteVaultId, externalChangeConflict, settingsDirty, onOpenNoteHistory, onOpenCanvas, onOpenGitPanel, onOpenExternalConflict }: VaultBackupSettingsProps) {
  const { settings, setSettings, backups, backupListError, backupListLoading, isBusy, recoveryRequired, lastError, lastMessage, lastRestoreReceipt, lastDeleteOutcome, isBackupDeleteUnconfirmed, triggerBackup, restoreBackup, deleteBackup } =
    backup

  const receiptView = lastRestoreReceipt ? describeRestoreReceipt(lastRestoreReceipt) : null
  const [pendingAction, setPendingAction] = useState<PendingBackupAction | null>(null)
  const [visibleBackupCount, setVisibleBackupCount] = useState(BACKUP_PAGE_SIZE)
  const backupScope = { vaultId, backupPath: settings.backupPath }
  const [backupOptionsOpen, setBackupOptionsOpen] = useState(settings.enabled || Boolean(settings.backupPath))
  const historyAccess = recoveryHistoryAvailability({ vaultId, activePath, recoveryRequired, settingsDirty })
  const [historyView, setHistoryView] = useState<{
    vaultId: string; notePath: string; state: 'loading' | 'ready' | 'error'; count: number
  } | null>(null)
  useEffect(() => {
    const originVault = vaultId
    const notePath = activePath?.trim()
    if (!originVault || !notePath || recoveryRequired || settingsDirty) return
    let current = true
    // React effects must not synchronously set state; unobserved owner keys
    // render as loading until this read-only native request settles.
    void vaultListNoteHistory(notePath, originVault).then((revisions) => {
      if (!Array.isArray(revisions) || revisions.length > 10_000) {
        throw new Error('Invalid native note history inventory.')
      }
      if (current) setHistoryView({ vaultId: originVault, notePath, state: 'ready', count: revisions.length })
    }).catch(() => {
      if (current) setHistoryView({ vaultId: originVault, notePath, state: 'error', count: 0 })
    })
    return () => { current = false }
  }, [vaultId, activePath, recoveryRequired, settingsDirty])
  const [gitConflictView, setGitConflictView] = useState<{
    vaultId: string; state: 'ready' | 'loading' | 'error' | 'unverified'; count: number
  } | null>(null)
  useEffect(() => {
    const originVault = vaultId
    if (!originVault || recoveryRequired) return
    let current = true
    // The native read validates its initiating vault. A late response from the
    // old vault must never become evidence for the newly selected vault.
    void gitStatus(originVault).then((result) => {
      if (!current) return
      setGitConflictView(inspectGitConflictEvidence(originVault, result) ??
        { vaultId: originVault, state: 'unverified', count: 0 })
    }).catch(() => {
      if (current) setGitConflictView({ vaultId: originVault, state: 'error', count: 0 })
    })
    return () => { current = false }
  }, [vaultId, recoveryRequired])
  const [canvasRecoveryView, setCanvasRecoveryView] = useState<CanvasRecoveryEvidence | null>(null)
  useEffect(() => {
    const originVault = vaultId
    if (!originVault || recoveryRequired) return
    let current = true
    // Native authority checks the active session and the initiating vault ID.
    // Do not let a late inspection from an older vault certify the new owner.
    void canvasListTemplateCheckpoints(originVault).then((reported) => {
      if (current) {
        setCanvasRecoveryView(inspectCanvasRecoveryEvidence(originVault, reported) ??
          { vaultId: originVault, state: 'unverified', count: 0 })
      }
    }).catch(() => {
      if (current) setCanvasRecoveryView({ vaultId: originVault, state: 'error', count: 0 })
    })
    return () => { current = false }
  }, [vaultId, recoveryRequired])
  const scopedCanvasRecovery = vaultId && !recoveryRequired
    ? canvasRecoveryView?.vaultId === vaultId
      ? canvasRecoveryView
      : { vaultId, state: 'loading' as const, count: 0 }
    : undefined
  const scopedGitConflicts = vaultId && !recoveryRequired
    ? gitConflictView?.vaultId === vaultId
      ? gitConflictView
      : { vaultId, state: 'loading' as const, count: 0 }
    : undefined
  const scopedHistory = historyView?.vaultId === vaultId && historyView.notePath === activePath?.trim()
    ? historyView
    : vaultId && activePath?.trim() && historyAccess.allowed
      ? { vaultId, notePath: activePath.trim(), state: 'loading' as const, count: 0 }
      : undefined
  const scopedExternalConflicts = !recoveryRequired
    ? inspectActiveExternalConflict(vaultId, activePath, activeNoteVaultId, externalChangeConflict)
    : undefined
  // Read-only inventory: missing native sources remain unverified, not empty.
  const recoveryEntries = buildRecoveryInventory({
    vaultId, backupPath: settings.backupPath, recoveryRequired,
    selectedNote: activePath, settingsDirty, lastRestoreReceipt,
    history: scopedHistory, canvas: scopedCanvasRecovery, gitConflicts: scopedGitConflicts,
    externalConflicts: scopedExternalConflicts,
    backups: vaultId ? {
      vaultId, backupPath: settings.backupPath,
      state: backupListLoading ? 'loading' : backupListError ? 'error' : 'ready',
      count: backups.length, verifiedCount: backups.filter(entry => entry.verified).length,
    } : undefined,
  })
  const recoveryLabels: Record<string, string> = {
    backups: 'Backup snapshots', 'note-history': 'Selected note history',
    'last-restore': 'Last restore result', canvas: 'Canvas recovery',
    'git-conflicts': 'Git merge conflicts',
    'external-conflicts': 'External file conflicts',
  }
  const reasons: Record<Exclude<RecoveryHistoryReason, null>, string> = {
    'open-vault': 'Open a vault to review note history.',
    'restart-vault': 'Restart Scriptor and reopen this vault before reviewing note history.',
    'save-settings': 'Save or discard unsaved Settings changes before opening note history.',
    'select-note': 'Select a note to review its saved revisions.',
  }
  return (
    <div className="settings-section" data-help-topic="backups">
      <h3>
        <HardDrive size={16} style={{ marginRight: 6, verticalAlign: 'text-bottom' }} />
        Backup
      </h3>
      <p className="health-subtitle">A recovery copy inside the vault cannot protect you if that folder is lost. Save important backups on another drive or backup location.</p>

      <div className="settings-actions">
        <button type="button" className="primary-button" disabled={isBusy || recoveryRequired} onClick={() => void triggerBackup()}>
          {isBusy ? 'Backing up…' : 'Back up now'}
        </button>
      </div>
      <details className="backup-options" open={backupOptionsOpen} onToggle={(event) => setBackupOptionsOpen(event.currentTarget.open)}>
        <summary>Schedule and backup location{settings.enabled ? ' · automatic backups on' : ''}</summary>
        <div className="backup-options-fields">
        <label className="diagnostics-opt-in">
          <input
            type="checkbox"
            checked={settings.enabled}
            onChange={(event) => setSettings({ enabled: event.target.checked })}
          />
          <span>Enable scheduled backups</span>
        </label>
  
        <label className="settings-field">
          Backup interval (minutes)
          <input
            type="number"
            min={5}
            max={10080}
            disabled={!settings.enabled}
            value={settings.intervalMinutes}
            onChange={(event) => setSettings({ intervalMinutes: Math.max(5, Number(event.target.value) || 60) })}
          />
        </label>
  
        <label className="settings-field">
          Recovery copies to keep
          <input
            type="number"
            min={1}
            max={100}
            value={settings.maxSnapshots}
            onChange={(event) => setSettings({ maxSnapshots: Math.max(1, Number(event.target.value) || 10) })}
          />
        </label>
  
        <label className="settings-field">
          Backup folder outside this vault
          <input
            value={settings.backupPath}
            disabled={isBusy || recoveryRequired}
            placeholder="Leave empty to keep recovery copies in this vault"
            onChange={(event) => {
              setPendingAction(null)
              setVisibleBackupCount(BACKUP_PAGE_SIZE)
              setSettings({ backupPath: event.target.value })
            }}
          />
        </label>
        </div>
      </details>

      {lastDeleteOutcome ? (
        <p role="status" className={lastDeleteOutcome.commit === 'indeterminate' ? 'settings-status warn' : 'settings-status'}>
          Last observed backup deletion: {lastDeleteOutcome.commit}; retry: {lastDeleteOutcome.retry}.
          {lastDeleteOutcome.commit === 'indeterminate' ? ' Native deletion may have committed. Reopen and inspect before taking further action.' : ''}
        </p>
      ) : null}
      {recoveryRequired ? <p className="settings-status warn" role="alert">This vault needs recovery before backup operations can continue. Backup, restore and delete are paused. Restart Scriptor and reopen the vault before editing or retrying.</p> : null}
      {lastMessage ? <p className="settings-status ok">{lastMessage}</p> : null}
      {lastError ? <p className="settings-status warn" role="alert">{lastError}</p> : null}
      {backupListError ? <p className="settings-status warn" role="alert">{backupListError}</p> : null}
      {receiptView ? (
        <section aria-labelledby="backup-last-restore-title">
          <h4 id="backup-last-restore-title" className="settings-subheading">Last restore attempt (this session)</h4>
          <p className="backup-name">Backup: {lastRestoreReceipt?.target}</p>
          <p role="status" className={['settings-status', receiptView.tone === 'success' ? 'ok' : receiptView.tone === 'warning' ? 'warn' : ''].join(' ')}>
            <strong>{receiptView.heading}.</strong> {receiptView.explanation}
          </p>
        </section>
      ) : null}

      {vaultId ? <section className="backup-recovery-tools" aria-labelledby="recovery-center-title">
        <h4 id="recovery-center-title" className="settings-subheading">Recovery Center · read-only</h4>
        <p className="health-subtitle">This overview never restores files. Counts appear only when the current vault's source has been inspected. Unverified sources are not empty.</p>
        <ul className="backup-list">
          {recoveryEntries.map(entry => <li key={entry.source} className="backup-entry">
            <strong>{recoveryLabels[entry.source]}</strong> · {entry.status}
            {entry.count !== null ? ` · ${entry.count} reported` : null}
            <p className="backup-meta">{entry.explanation}</p>
            {entry.route === 'canvas' ? <button type="button" className="toolbar-button"
              onClick={onOpenCanvas}>Open Canvas workspace</button> : null}
            {entry.route === 'git' ? <button type="button" className="toolbar-button"
              onClick={onOpenGitPanel}>Open Git panel</button> : null}
            {entry.route === 'external-conflict' ? <button type="button" className="toolbar-button"
              onClick={onOpenExternalConflict}>Show editor conflict warning</button> : null}
          </li>)}
        </ul>
      </section> : null}
      <section className="backup-recovery-tools" aria-label="Other recovery options">
        <h4 className="settings-subheading">Other recovery options</h4>
        <p className="health-subtitle">You can preview earlier revisions of the selected note without replacing the entire vault. Opening history does not modify files; restoring a revision requires separate review and approval.</p>
        <button type="button" className="toolbar-button"
          disabled={!historyAccess.allowed}
          onClick={onOpenNoteHistory}>
          Review selected note history
        </button>
        {historyAccess.reason ? <p className="health-subtitle">{reasons[historyAccess.reason]}</p> : null}
      </section>

      {backups.length > 0 ? (
        <>
          <h4 className="settings-subheading">Recent backups</h4>
          <ul id="vault-backup-list" className="backup-list">
            {backups.slice(0, visibleBackupCount).map((entry) => (
              <li key={entry.name} className="backup-entry">
                <span className="backup-name">{entry.name} · {entry.storage_kind === 'external_backup' ? 'Backup outside vault' : 'Local recovery copy'}{entry.verified ? ' · verified' : ' · not verified'}</span>
                <span className="backup-meta">
                  {formatDate(entry.created_at)} · {formatBytes(entry.size_bytes)}
                </span>
                {!entry.verified ? (
                  <p id={`backup-verification-${entry.name}`} className="backup-meta">
                    This backup could not be verified, so it cannot be restored. Keep it for investigation or delete it after reviewing the consequences.
                  </p>
                ) : null}
                {isBackupDeleteUnconfirmed(entry.name) ? (
                  <p className="settings-status warn" role="alert">
                    Deletion of this backup was submitted but not confirmed. Automatic or same-session retry is blocked; restart Scriptor and inspect this destination before reviewing another deletion.
                  </p>
                ) : null}
                <div className="backup-actions">
                  <button
                    type="button"
                    className="toolbar-button"
                    disabled={isBusy || recoveryRequired || !entry.verified}
                    aria-label={`Restore backup ${entry.name}`}
                    aria-describedby={!entry.verified ? `backup-verification-${entry.name}` : undefined}
                    onClick={() => setPendingAction(createPendingBackupAction(backupScope, entry.name, 'restore'))}
                  >
                    Restore
                  </button>
                  <button
                    type="button"
                    className="toolbar-button danger"
                    disabled={isBusy || recoveryRequired || isBackupDeleteUnconfirmed(entry.name)}
                    aria-label={`Delete backup ${entry.name}`}
                    onClick={() => setPendingAction(createPendingBackupAction(backupScope, entry.name, 'delete'))}
                  >
                    Delete
                  </button>
                </div>
                {pendingAction && matchesBackupActionScope(pendingAction, backupScope, entry.name) ? <MutationConfirmation
                  ariaLabel={`${pendingAction.action === 'restore' ? 'Restore' : 'Delete'} backup ${entry.name}`}
                  message={pendingAction.action === 'restore'
                    ? `Restore ${entry.name}? This replaces the current vault files with the saved copy.`
                    : `Delete ${entry.name}? You will no longer be able to restore from this backup.`}
                  confirmLabel={pendingAction.action === 'restore' ? 'Restore backup' : 'Delete backup'}
                  onCancel={() => setPendingAction(null)}
                  onConfirm={() => {
                    const selected = pendingAction
                    setPendingAction(null)
                    // Never transfer an approval to a different vault or backup location.
                    if (!matchesBackupActionScope(selected, backupScope, entry.name) || isBusy || recoveryRequired) return
                    if (selected?.action === 'restore') void restoreBackup(selected.name)
                    else if (selected?.action === 'delete' && !isBackupDeleteUnconfirmed(selected.name)) void deleteBackup(selected.name)
                  }}
                  busy={isBusy || recoveryRequired}
                /> : null}
              </li>
            ))}
          </ul>
          {(backups.length > visibleBackupCount || visibleBackupCount > BACKUP_PAGE_SIZE) ? (
            <div className="settings-actions">
              <button type="button" className="toolbar-button" aria-controls="vault-backup-list"
                aria-expanded={visibleBackupCount > BACKUP_PAGE_SIZE}
                onClick={() => {
                  // Keep one focusable control while its label switches between
                  // expand/collapse; paged-away destructive approval is invalid.
                  setPendingAction(null)
                  setVisibleBackupCount((count) => backups.length > count
                    ? Math.min(backups.length, count + BACKUP_PAGE_SIZE)
                    : BACKUP_PAGE_SIZE)
                }}>
                {backups.length > visibleBackupCount
                  ? (backups.length - visibleBackupCount === 1
                    ? 'Show 1 older backup'
                    : `Show ${Math.min(BACKUP_PAGE_SIZE, backups.length - visibleBackupCount)} older backups`)
                  : 'Show fewer backups'}
              </button>
            </div>
          ) : null}
        </>
      ) : !backupListError ? (
        backupListLoading
          ? <p role="status" className="health-subtitle">Loading backups…</p>
          : <p className="health-subtitle">No backups yet. Use &quot;Back up now&quot; to create one.</p>
      ) : null}
    </div>
  )
})

