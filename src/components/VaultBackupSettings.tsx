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
    return new Date(iso).toLocaleString()
  } catch {
    return iso
  }
}

export function VaultBackupSettings({ backup }: VaultBackupSettingsProps) {
  const { settings, setSettings, backups, isBusy, lastError, lastMessage, triggerBackup, restoreBackup, deleteBackup } =
    backup

  return (
    <div className="settings-section">
      <h3>
        <HardDrive size={16} style={{ marginRight: 6, verticalAlign: 'text-bottom' }} />
        Backup
      </h3>
      <p className="health-subtitle">Verified recovery snapshots can stay inside the vault; disaster-recovery backups must use an absolute path on another disk or synced location.</p>

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
          value={settings.intervalMinutes}
          onChange={(event) => setSettings({ intervalMinutes: Math.max(5, Number(event.target.value) || 60) })}
        />
      </label>

      <label className="settings-field">
        Max snapshots to keep
        <input
          type="number"
          min={1}
          max={100}
          value={settings.maxSnapshots}
          onChange={(event) => setSettings({ maxSnapshots: Math.max(1, Number(event.target.value) || 10) })}
        />
      </label>

      <label className="settings-field">
        Disaster-recovery backup path (absolute, outside vault)
        <input
          value={settings.backupPath}
          placeholder="Leave empty for local recovery snapshots"
          onChange={(event) => setSettings({ backupPath: event.target.value })}
        />
      </label>

      <div className="settings-actions">
        <button type="button" className="toolbar-button" disabled={isBusy} onClick={() => void triggerBackup()}>
          {isBusy ? 'Backing up...' : 'Backup Now'}
        </button>
      </div>

      {lastMessage ? <p className="settings-status ok">{lastMessage}</p> : null}
      {lastError ? <p className="settings-status warn">{lastError}</p> : null}

      {backups.length > 0 ? (
        <>
          <h4 className="settings-subheading">Recent backups</h4>
          <ul className="backup-list">
            {backups.slice(0, 10).map((entry) => (
              <li key={entry.name} className="backup-entry">
                <span className="backup-name">{entry.name} · {entry.storage_kind === 'external_backup' ? 'DR backup' : 'local snapshot'}{entry.verified ? ' · verified' : ' · legacy/unverified'}</span>
                <span className="backup-meta">
                  {formatDate(entry.created_at)} · {formatBytes(entry.size_bytes)}
                </span>
                <div className="backup-actions">
                  <button
                    type="button"
                    className="toolbar-button"
                    disabled={isBusy}
                    onClick={() => void restoreBackup(entry.name)}
                  >
                    Restore
                  </button>
                  <button
                    type="button"
                    className="toolbar-button danger"
                    disabled={isBusy}
                    onClick={() => void deleteBackup(entry.name)}
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="health-subtitle">No backups yet. Click &quot;Backup Now&quot; to create one.</p>
      )}
    </div>
  )
}
