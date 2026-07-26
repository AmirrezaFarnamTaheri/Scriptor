import { useCallback, useEffect, useRef, useState } from 'react'

import {
  vaultCreateBackup,
  vaultDeleteBackup,
  vaultListBackups,
  vaultRestoreBackup,
} from '../bridge/commands'
import type { VaultBackupEntry } from '../bridge/commands'

const STORAGE_KEY = 'scriptor:vault-backup-settings'

export interface VaultBackupSettings {
  enabled: boolean
  intervalMinutes: number
  maxSnapshots: number
  backupPath: string
}

const DEFAULT_SETTINGS: VaultBackupSettings = {
  enabled: false,
  intervalMinutes: 60,
  maxSnapshots: 10,
  backupPath: '.scriptor/backups/',
}

function loadSettings(): VaultBackupSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_SETTINGS
    const parsed = JSON.parse(raw) as Partial<VaultBackupSettings>
    return {
      enabled: parsed.enabled ?? DEFAULT_SETTINGS.enabled,
      intervalMinutes:
        typeof parsed.intervalMinutes === 'number' && parsed.intervalMinutes > 0
          ? parsed.intervalMinutes
          : DEFAULT_SETTINGS.intervalMinutes,
      maxSnapshots:
        typeof parsed.maxSnapshots === 'number' && parsed.maxSnapshots > 0
          ? parsed.maxSnapshots
          : DEFAULT_SETTINGS.maxSnapshots,
      backupPath: parsed.backupPath || DEFAULT_SETTINGS.backupPath,
    }
  } catch {
    return DEFAULT_SETTINGS
  }
}

function saveSettings(settings: VaultBackupSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  } catch {
    // Ignore storage failures
  }
}

export function useVaultBackup(vaultOpen: boolean) {
  const [settings, setSettingsState] = useState<VaultBackupSettings>(loadSettings)
  const [backups, setBackups] = useState<VaultBackupEntry[]>([])
  const [isBusy, setIsBusy] = useState(false)
  const [lastError, setLastError] = useState<string | null>(null)
  const [lastMessage, setLastMessage] = useState<string | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const setSettings = useCallback((patch: Partial<VaultBackupSettings>) => {
    setSettingsState((prev) => {
      const next = { ...prev, ...patch }
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
          // Best-effort cleanup; keep the entry visible and report below.
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
    async (backupName: string) => {
      if (!vaultOpen) return
      setIsBusy(true)
      setLastError(null)
      setLastMessage(null)
      try {
        const message = await vaultRestoreBackup(backupName, settings.backupPath || undefined)
        setLastMessage(message)
      } catch (caught) {
        setLastError(caught instanceof Error ? caught.message : 'Restore failed')
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
    if (vaultOpen) {
      void listBackups()
    }
  }, [vaultOpen, listBackups])

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

  return {
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
  }
}
