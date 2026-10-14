import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'

import {
  indexerRebuild,
  vaultCreateBackup,
  vaultDeleteBackup,
  vaultListBackups,
  vaultRestoreBackup,
} from '../bridge/commands'
import type { VaultBackupEntry } from '../bridge/commands'
import { backupRetentionCandidates, DEFAULT_VAULT_BACKUP_SETTINGS, validateVaultBackupSettings, type VaultBackupSettings } from '../lib/vaultBackupPolicy'
import { readVersionedStorage, writeVersionedStorage } from '../lib/versionedStorage'

const STORAGE_KEY = 'scriptor:vault-backup-settings'
// Reuse one empty snapshot across renders when the current vault has no loaded backups.
const EMPTY_BACKUPS: VaultBackupEntry[] = []

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
  const [backupView, setBackupView] = useState<{vaultId: string | null; path: string; value: VaultBackupEntry[]; error: string | null; loading: boolean}>({vaultId: ownedVaultId, path: settings.backupPath, value: [], error: null, loading: true})
  const [errorView, setErrorView] = useState<{vaultId: string | null; value: string | null}>({vaultId: ownedVaultId, value: null})
  const [messageView, setMessageView] = useState<{vaultId: string | null; value: string | null}>({vaultId: ownedVaultId, value: null})
  const [isBusy, setIsBusy] = useState(false)
  // Hide a previous vault's data on the very first render after switching.
  // React forbids synchronous setState in effects; owner-keyed state needs no reset effect.
  // Backups are identified by both vault and destination directory. Never
  // expose stale entries from the previous path to Restore/Delete controls.
  const visibleBackups = backupView.vaultId === ownedVaultId && backupView.path === settings.backupPath ? backupView : null
  const backups = visibleBackups?.value ?? EMPTY_BACKUPS
  const backupListError = visibleBackups?.error ?? null
  const backupListLoading = !visibleBackups || visibleBackups.loading
  const lastError = errorView.vaultId === ownedVaultId ? errorView.value : null
  const lastMessage = messageView.vaultId === ownedVaultId ? messageView.value : null
  const setBackups = useCallback((value: VaultBackupEntry[]) => setBackupView({vaultId: ownedVaultId, path: settings.backupPath, value, error: null, loading: false}), [ownedVaultId, settings.backupPath])
  const setBackupListError = useCallback(() => setBackupView({vaultId: ownedVaultId, path: settings.backupPath, value: [], error: 'Could not load backups from this location. Check its path and access permissions.', loading: false}), [ownedVaultId, settings.backupPath])
  const setLastError = useCallback((value: string | null) => setErrorView({vaultId: ownedVaultId, value}), [ownedVaultId])
  const setLastMessage = useCallback((value: string | null) => setMessageView({vaultId: ownedVaultId, value}), [ownedVaultId])
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const operationBusyRef = useRef(false)
  const currentVaultRef = useRef<string | null>(ownedVaultId)
  const currentBackupPathRef = useRef(settings.backupPath)

  // Settings can stay mounted across vault switches. Keep their backup names
  // and status messages owned by the vault that produced them.
  useLayoutEffect(() => {
    currentVaultRef.current = ownedVaultId
    currentBackupPathRef.current = settings.backupPath
  }, [ownedVaultId, settings.backupPath])

  const ownsVault = useCallback((id: string) => currentVaultRef.current === id, [])
  const ownsBackupScope = useCallback((id: string, path: string) => currentVaultRef.current === id && currentBackupPathRef.current === path, [])
  // A scheduled backup, manual backup, restore and deletion must not overlap.
  // State alone is not a mutex: two invocations may race before React renders.
  const beginOperation = useCallback(() => {
    if (operationBusyRef.current) return false
    operationBusyRef.current = true
    setIsBusy(true)
    return true
  }, [])
  const finishOperation = useCallback(() => {
    operationBusyRef.current = false
    setIsBusy(false)
  }, [])

  const setSettings = useCallback((patch: Partial<VaultBackupSettings>) => {
    setSettingsState((prev) => {
      const next = validateVaultBackupSettings({ ...prev, ...patch })
      saveSettings(next)
      return next
    })
  }, [])

  const listBackups = useCallback(async () => {
    if (!ownedVaultId) {
      setBackups([])
      return
    }
    const requestedVault = ownedVaultId
    const requestedPath = settings.backupPath
    try {
      const list = await vaultListBackups(requestedPath || undefined)
      if (ownsBackupScope(requestedVault, requestedPath)) setBackups(list || [])
    } catch {
      if (ownsBackupScope(requestedVault, requestedPath)) setBackupListError()
    }
  }, [ownedVaultId, settings.backupPath, ownsBackupScope, setBackups, setBackupListError])

  const triggerBackup = useCallback(async () => {
    if (!ownedVaultId || !beginOperation()) return
    const requestedVault = ownedVaultId
    const requestedPath = settings.backupPath
    setLastError(null)
    setLastMessage(null)
    try {
      const entry = await vaultCreateBackup(requestedPath || undefined)
      if (!ownsBackupScope(requestedVault, requestedPath)) return
      setLastMessage(`Backup created: ${entry.name}`)

      const allBackups = (await vaultListBackups(requestedPath || undefined)) || []
      if (!ownsBackupScope(requestedVault, requestedPath)) return
      const sorted = [...allBackups].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      )
      const deleted = new Set<string>()
      const failedDeletes: string[] = []
      // Shared external directories may contain backups from other vaults.
      // Never prune a backup merely because its timestamp is older.
      for (const old of backupRetentionCandidates(allBackups, entry.name, settings.maxSnapshots)) {
        if (!ownsBackupScope(requestedVault, requestedPath)) return
        try {
          await vaultDeleteBackup(old.name, requestedPath || undefined)
          if (!ownsBackupScope(requestedVault, requestedPath)) return
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
      if (ownsBackupScope(requestedVault, requestedPath)) setLastError(caught instanceof Error ? caught.message : 'Backup failed')
    } finally {
      finishOperation()
    }
  }, [ownedVaultId, settings.backupPath, settings.maxSnapshots, beginOperation, finishOperation, ownsBackupScope, setBackups, setLastError, setLastMessage])

  const triggerBackupRef = useRef(triggerBackup)
  useEffect(() => {
    triggerBackupRef.current = triggerBackup
  }, [triggerBackup])

  const restoreBackup = useCallback(
    async (backupName: string, onRestored?: () => void) => {
      if (!ownedVaultId || !beginOperation()) return
      const requestedVault = ownedVaultId
      setLastError(null)
      setLastMessage(null)
      let restoreApplied = false
      try {
        // Flush acknowledged edits, then freeze editor persistence before the
        // native transaction starts replacing authoritative vault files.
        await dispatchVaultLifecycleEvent('scriptor:vault-restore-starting', { backupName })
        // Lifecycle approval is async; do not start restoring the next vault.
        if (!ownsVault(requestedVault)) return
        const result = await vaultRestoreBackup(backupName, settings.backupPath || undefined)
        // Only an explicitly rolled-back restore is safe to resume editor
        // persistence over. Every other status means vault files were already
        // replaced, so resuming the superseded draft would overwrite them.
        restoreApplied = result.status !== 'rolled-back'
        if (!ownsVault(requestedVault)) return

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
        if (!ownsVault(requestedVault)) return

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
        if (!ownsVault(requestedVault)) return
        await dispatchVaultLifecycleEvent('scriptor:vault-restored', { backupName, indexReady })
        if (ownsVault(requestedVault)) onRestored?.()
      } catch (caught) {
        if (!ownsVault(requestedVault)) return
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
        finishOperation()
      }
    },
    [ownedVaultId, settings.backupPath, beginOperation, finishOperation, ownsVault, setLastError, setLastMessage],
  )

  const deleteBackup = useCallback(
    async (backupName: string) => {
      if (!ownedVaultId || !beginOperation()) return
      const requestedVault = ownedVaultId
      setLastError(null)
      try {
        await vaultDeleteBackup(backupName, settings.backupPath || undefined)
        if (ownsVault(requestedVault)) await listBackups()
      } catch (caught) {
        if (ownsVault(requestedVault)) setLastError(caught instanceof Error ? caught.message : 'Delete failed')
      } finally {
        finishOperation()
      }
    },
    [ownedVaultId, settings.backupPath, listBackups, beginOperation, finishOperation, ownsVault, setLastError],
  )

  useEffect(() => {
    if (!ownedVaultId) return
    const requestedVault = ownedVaultId
    const requestedPath = settings.backupPath
    let cancelled = false
    void vaultListBackups(requestedPath || undefined)
      .then((entries) => {
        if (!cancelled && ownsBackupScope(requestedVault, requestedPath)) setBackups(entries || [])
      })
      .catch(() => {
        if (!cancelled && ownsBackupScope(requestedVault, requestedPath)) setBackupListError()
      })
    return () => {
      cancelled = true
    }
  }, [settings.backupPath, ownedVaultId, ownsBackupScope, setBackups, setBackupListError])

  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }

    if (settings.enabled && ownedVaultId && settings.intervalMinutes > 0) {
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
  }, [settings.enabled, settings.intervalMinutes, ownedVaultId])

  return useMemo(
    () => ({
      settings,
      setSettings,
      backups,
      backupListError,
      backupListLoading,
      isBusy,
      lastError,
      lastMessage,
      triggerBackup,
      restoreBackup,
      deleteBackup,
      listBackups,
    }),
    [settings, setSettings, backups, backupListError, backupListLoading, isBusy, lastError, lastMessage, triggerBackup, restoreBackup, deleteBackup, listBackups],
  )
}
