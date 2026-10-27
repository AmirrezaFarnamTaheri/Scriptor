import { memo, useState } from 'react'
import { MutationConfirmation } from './chrome/MutationConfirmation'
import { HardDrive } from 'lucide-react'
import { createPendingBackupAction, matchesBackupActionScope, type PendingBackupAction } from '../lib/workspace/backupActionScope'
import { recoveryHistoryAvailability, type RecoveryHistoryReason } from '../lib/workspace/recoveryHistoryAvailability'
import { describeRestoreReceipt } from '../lib/workspace/restoreReceiptPresentation'

import type { useVaultBackup } from '../hooks/useVaultBackup'

type BackupHook = ReturnType<typeof useVaultBackup>
const BACKUP_PAGE_SIZE = 10

interface VaultBackupSettingsProps {
  backup: BackupHook
  vaultId: string | null
  activePath: string | null
  settingsDirty: boolean
  onOpenNoteHistory: () => void
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

export const VaultBackupSettings = memo(function VaultBackupSettings({ backup, vaultId, activePath, settingsDirty, onOpenNoteHistory }: VaultBackupSettingsProps) {
  const { settings, setSettings, backups, backupListError, backupListLoading, isBusy, recoveryRequired, lastError, lastMessage, lastRestoreReceipt, triggerBackup, restoreBackup, deleteBackup } =
    backup

  const receiptView = lastRestoreReceipt ? describeRestoreReceipt(lastRestoreReceipt) : null
  const [pendingAction, setPendingAction] = useState<PendingBackupAction | null>(null)
  const [visibleBackupCount, setVisibleBackupCount] = useState(BACKUP_PAGE_SIZE)
  const backupScope = { vaultId, backupPath: settings.backupPath }
  const [backupOptionsOpen, setBackupOptionsOpen] = useState(settings.enabled || Boolean(settings.backupPath))
  const historyAccess = recoveryHistoryAvailability({ vaultId, activePath, recoveryRequired, settingsDirty })
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
                    disabled={isBusy || recoveryRequired}
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
                    else if (selected?.action === 'delete') void deleteBackup(selected.name)
                  }}
                  busy={isBusy || recoveryRequired}
                /> : null}
              </li>
            ))}
          </ul>
          {(backups.length > visibleBackupCount || visibleBackupCount > BACKUP_PAGE_SIZE) ? (
            <div className="settings-actions">
              {backups.length > visibleBackupCount ? (
                <button type="button" className="toolbar-button" aria-controls="vault-backup-list"
                  onClick={() => {
                    // A paged-away Restore/Delete confirmation is not reusable.
                    setPendingAction(null)
                    setVisibleBackupCount((count) => Math.min(backups.length, count + BACKUP_PAGE_SIZE))
                  }}>
                  Show {Math.min(BACKUP_PAGE_SIZE, backups.length - visibleBackupCount)} older backups
                </button>
              ) : null}
              {visibleBackupCount > BACKUP_PAGE_SIZE ? (
                <button type="button" className="toolbar-button" aria-controls="vault-backup-list"
                  onClick={() => {
                    setPendingAction(null)
                    setVisibleBackupCount(BACKUP_PAGE_SIZE)
                  }}>
                  Show fewer backups
                </button>
              ) : null}
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

