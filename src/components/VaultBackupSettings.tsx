import { memo, useState } from 'react'
import { MutationConfirmation } from './chrome/MutationConfirmation'
import { HardDrive } from 'lucide-react'

import type { useVaultBackup } from '../hooks/useVaultBackup'

type BackupHook = ReturnType<typeof useVaultBackup>

interface VaultBackupSettingsProps {
  backup: BackupHook
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

export const VaultBackupSettings = memo(function VaultBackupSettings({ backup }: VaultBackupSettingsProps) {
  const { settings, setSettings, backups, backupListError, backupListLoading, isBusy, lastError, lastMessage, triggerBackup, restoreBackup, deleteBackup } =
    backup

  const [pendingAction, setPendingAction] = useState<{ name: string; action: 'restore' | 'delete' } | null>(null)
  return (
    <div className="settings-section" data-help-topic="backups">
      <h3>
        <HardDrive size={16} style={{ marginRight: 6, verticalAlign: 'text-bottom' }} />
        Backup
      </h3>
      <p className="health-subtitle">A recovery copy inside the vault cannot protect you if that folder is lost. Save important backups on another drive or backup location.</p>

      <div className="settings-actions">
        <button type="button" className="primary-button" disabled={isBusy} onClick={() => void triggerBackup()}>
          {isBusy ? 'Backing up…' : 'Back up now'}
        </button>
      </div>
      <details className="backup-options" defaultOpen={settings.enabled || Boolean(settings.backupPath)}>
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
            disabled={isBusy}
            placeholder="Leave empty to keep recovery copies in this vault"
            onChange={(event) => setSettings({ backupPath: event.target.value })}
          />
        </label>
        </div>
      </details>

      {lastMessage ? <p className="settings-status ok">{lastMessage}</p> : null}
      {lastError ? <p className="settings-status warn">{lastError}</p> : null}
      {backupListError ? <p className="settings-status warn" role="alert">{backupListError}</p> : null}

      {backups.length > 0 ? (
        <>
          <h4 className="settings-subheading">Recent backups</h4>
          <ul className="backup-list">
            {backups.slice(0, 10).map((entry) => (
              <li key={entry.name} className="backup-entry">
                <span className="backup-name">{entry.name} · {entry.storage_kind === 'external_backup' ? 'Backup outside vault' : 'Local recovery copy'}{entry.verified ? ' · verified' : ' · not verified'}</span>
                <span className="backup-meta">
                  {formatDate(entry.created_at)} · {formatBytes(entry.size_bytes)}
                </span>
                <div className="backup-actions">
                  <button
                    type="button"
                    className="toolbar-button"
                    disabled={isBusy}
                    aria-label={`Restore backup ${entry.name}`}
                    onClick={() => setPendingAction({ name: entry.name, action: 'restore' })}
                  >
                    Restore
                  </button>
                  <button
                    type="button"
                    className="toolbar-button danger"
                    disabled={isBusy}
                    aria-label={`Delete backup ${entry.name}`}
                    onClick={() => setPendingAction({ name: entry.name, action: 'delete' })}
                  >
                    Delete
                  </button>
                </div>
                {pendingAction?.name === entry.name ? <MutationConfirmation
                  ariaLabel={`${pendingAction.action === 'restore' ? 'Restore' : 'Delete'} backup ${entry.name}`}
                  message={pendingAction.action === 'restore'
                    ? `Restore ${entry.name}? This replaces the current vault files with the saved copy.`
                    : `Delete ${entry.name}? You will no longer be able to restore from this backup.`}
                  confirmLabel={pendingAction.action === 'restore' ? 'Restore backup' : 'Delete backup'}
                  onCancel={() => setPendingAction(null)}
                  onConfirm={() => {
                    const action = pendingAction.action
                    setPendingAction(null)
                    if (action === 'restore') void restoreBackup(entry.name)
                    else void deleteBackup(entry.name)
                  }}
                  busy={isBusy}
                /> : null}
              </li>
            ))}
          </ul>
        </>
      ) : !backupListError ? (
        backupListLoading
          ? <p role="status" className="health-subtitle">Loading backups…</p>
          : <p className="health-subtitle">No backups yet. Use &quot;Back up now&quot; to create one.</p>
      ) : null}
    </div>
  )
})

