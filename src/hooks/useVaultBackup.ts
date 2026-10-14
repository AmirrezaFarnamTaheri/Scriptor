import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'

import {
  indexerRebuild,
  vaultCreateBackup,
  vaultDeleteBackup,
  vaultListBackups,
  vaultRestoreBackup,
} from '../bridge/commands'
import type { VaultBackupEntry } from '../bridge/commands'
import { DEFAULT_VAULT_BACKUP_SETTINGS, validateVaultBackupSettings, type VaultBackupSettings } from '../lib/vaultBackupPolicy'
import { readVersionedStorage, writeVersionedStorage } from '../lib/versionedStorage'

const STORAGE_KEY = 'scriptor:vault-backup-settings'

interface VaultLifecycleEventDetail {
  backupName: string
  indexReady?: boolean
  waitUntil: (promise: Promise<unknown>) => void
}

/** Dispatches a restore lifecycle event and waits for registered consumers. */
async function dispatchVaultLifecycleEvent(
  name: string,
  detail: Omit<VaultLifecycleEventDetail, 'waitUntil'>,
): Promise<void> {
  const waits: Promise<unknown>[] = []
  const eventDetail: VaultLifecycleEventDetail = {
    ...detail,
    waitUntil: (promise) => waits.push(Promise.resolve(promise)),
  }
  window.dispatchEvent(new CustomEvent<VaultLifecycleEventDetail>(name, { detail: eventDetail }))
  if (waits.length > 0) await Promise.all(waits)
}

function loadSettings(): VaultBackupSettings {
  return readVersionedStorage({
    key: STORAGE_KEY,
    schemaVersion: 1,
    fallback: DEFAULT_VAULT_BACKUP_SETTINGS,
    validate: validateVaultBackupSettings,
  })
}

function saveSettings(settings: VaultBackupSettings): void {
  writeVersionedStorage(STORAGE_KEY, 1, settings)
}

/** Manages scheduled backups, retention, restore lifecycle events, and status. */
export function useVaultBackup(vaultOpen: boolean, vaultId: string | null) {
  const ownedVaultId = vaultOpen ? vaultId : null
  const [settings, setSettingsState] = useState<VaultBackupSettings>(loadSettings)
  const [backups, setBackups] = useState<VaultBackupEntry[]>([])
  const [isBusy, setIsBusy] = useState(false)
  const [lastError, setLastError] = useState<string | null>(null)
  const [lastMessage, setLastMessage] = useState<string | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const setSettings = useCallback((patch: Partial<VaultBackupSettings>) => {
    setSettingsState((prev) => {
      const next = validateVaultBackupSettings({ ...prev, ...patch })
      saveSettings(next)
      return next
    })
  }, [])

  const listBackups = useCallback(async () => {
    if (!vaultOpen) {
      setBackups([])
      return
    }
    try {
      const list = await vaultListBackups(settings.backupPath || undefined)
      setBackups(list || [])
    } catch {
      setBackups([])
    }
  }, [vaultOpen, settings.backupPath])

  const triggerBackup = useCallback(async () => {
    if (!vaultOpen) return
    setIsBusy(true)
    setLastError(null)
    setLastMessage(null)
    try {
      const entry = await vaultCreateBackup(settings.backupPath || undefined)
      setLastMessage(`Backup created: ${entry.name}`)

      const allBackups = (await vaultListBackups(settings.backupPath || undefined)) || []
      const sorted = [...allBackups].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      )
      const deleted = new Set<string>()
      const failedDeletes: string[] = []
      for (const old of sorted.slice(settings.maxSnapshots)) {
        try {
          await vaultDeleteBackup(old.name, settings.backupPath || undefined)
          deleted.add(old.name)
        } catch {
          failedDeletes.push(old.name)
        }
      }
      setBackups(sorted.filter((backup) => !deleted.has(backup.name)))
      if (failedDeletes.length > 0) {
        setLastError(`Could not delete ${failedDeletes.length} old backup(s): ${failedDeletes.join(', ')}`)
      }
    } catch (caught) {
      setLastError(caught instanceof Error ? caught.message : 'Backup failed')
    } finally {
      setIsBusy(false)
    }
  }, [vaultOpen, settings.backupPath, settings.maxSnapshots])

  const triggerBackupRef = useRef(triggerBackup)
  useEffect(() => {
    triggerBackupRef.current = triggerBackup
  }, [triggerBackup])

  const restoreBackup = useCallback(
    async (backupName: string, onRestored?: () => void) => {
      if (!vaultOpen) return
      setIsBusy(true)
      setLastError(null)
      setLastMessage(null)
      let restoreApplied = false
      try {
        // Flush acknowledged edits, then freeze editor persistence before the
        // native transaction starts replacing authoritative vault files.
        await dispatchVaultLifecycleEvent('scriptor:vault-restore-starting', { backupName })
        const result = await vaultRestoreBackup(backupName, settings.backupPath || undefined)
        // Only an explicitly rolled-back restore is safe to resume editor
        // persistence over. Every other status means vault files were already
        // replaced, so resuming the superseded draft would overwrite them.
        restoreApplied = result.status !== 'rolled-back'

        if (result.status === 'rolled-back') {
          // Native replacement never mutated vault files, or promoted nothing
          // and rolled back cleanly. Resume the original editor persistence
          // generation and re-arm any still-dirty in-memory draft.
          try {
            await dispatchVaultLifecycleEvent('scriptor:vault-restore-aborted', { backupName })
          } catch (resumeError) {
            setLastError(`${result.message}; editor persistence could not resume: ${resumeError instanceof Error ? resumeError.message : String(resumeError)}`)
            return
          }
          setLastError(result.message)
          return
        }

        if (result.status !== 'committed-ready') {
          // `committed-needs-reopen` and `recovery-required` both leave the
          // pre-restore session in place: it never ran rename-transaction
          // recovery on the restored tree. The replacement is authoritative,
          // so persistence must stay frozen, but the restored lifecycle and
          // index rebuild must not run against that session. The native
          // message already tells the user to reopen the vault, which
          // reconciles the journal and reloads everything.
          setLastError(result.message)
          return
        }

        // Reload authoritative editor/config/snippet state before allowing any
        // persistence to resume. Derived index consumers intentionally wait.
        await dispatchVaultLifecycleEvent('scriptor:vault-files-restored', { backupName })

        let indexReady = true
        try {
          await indexerRebuild()
          setLastMessage(result.message)
        } catch (indexerErr) {
          indexReady = false
          console.warn('Post-restore indexer rebuild failed:', indexerErr)
          setLastMessage(`${result.message} (Index rebuild failed; search may be outdated until next rebuild)`)
        }

        // Refresh summaries/health/graph-dependent state only after the rebuild
        // attempt has reached a terminal result. Consumers can deliberately
        // remain stale/empty when `indexReady` is false.
        await dispatchVaultLifecycleEvent('scriptor:vault-restored', { backupName, indexReady })
        onRestored?.()
      } catch (caught) {
        const message = caught instanceof Error ? caught.message : 'Restore failed'
        if (!restoreApplied) {
          // The invoke rejected before a committed outcome was returned: a
          // transport error, or a pre-transaction failure such as authorization
          // or manifest verification. Nothing on disk was replaced, so it is
          // safe to resume the original editor persistence generation.
          try {
            await dispatchVaultLifecycleEvent('scriptor:vault-restore-aborted', { backupName })
          } catch (resumeError) {
            setLastError(`${message}; editor persistence could not resume: ${resumeError instanceof Error ? resumeError.message : String(resumeError)}`)
            return
          }
          setLastError(message)
        } else {
          // The filesystem restore is already authoritative. Never label that
          // durable operation as failed merely because UI/index resynchronizing
          // encountered an error afterward.
          setLastError(`Vault files were restored, but workspace resynchronization failed: ${message}`)
        }
      } finally {
        setIsBusy(false)
      }
    },
    [vaultOpen, settings.backupPath],
  )

  const deleteBackup = useCallback(
    async (backupName: string) => {
      if (!vaultOpen) return
      setIsBusy(true)
      setLastError(null)
      try {
        await vaultDeleteBackup(backupName, settings.backupPath || undefined)
        await listBackups()
      } catch (caught) {
        setLastError(caught instanceof Error ? caught.message : 'Delete failed')
      } finally {
        setIsBusy(false)
      }
    },
    [vaultOpen, settings.backupPath, listBackups],
  )

  useEffect(() => {
    if (!vaultOpen) return
    let cancelled = false
    void vaultListBackups(settings.backupPath || undefined)
      .then((entries) => {
        if (!cancelled) setBackups(entries || [])
      })
      .catch(() => {
        if (!cancelled) setBackups([])
      })
    return () => {
      cancelled = true
    }
  }, [settings.backupPath, vaultOpen])

  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }

    if (settings.enabled && vaultOpen && settings.intervalMinutes > 0) {
      intervalRef.current = setInterval(
        () => {
          void triggerBackupRef.current()
        },
        settings.intervalMinutes * 60 * 1000,
      )
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [settings.enabled, settings.intervalMinutes, vaultOpen])

  return useMemo(
    () => ({
      settings,
      setSettings,
      backups,
      isBusy,
      lastError,
      lastMessage,
      triggerBackup,
      restoreBackup,
      deleteBackup,
      listBackups,
    }),
    [settings, setSettings, backups, isBusy, lastError, lastMessage, triggerBackup, restoreBackup, deleteBackup, listBackups],
  )
}
