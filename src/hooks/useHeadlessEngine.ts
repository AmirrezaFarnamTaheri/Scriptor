import { useCallback, useEffect, useState } from 'react'

import { daemonOpenVault, daemonPing, daemonStart, ensureDaemonReady } from '../bridge/commands'
import { setHeadlessMode } from '../bridge/headlessMode'
import { isNativeBridgeAvailable } from '../bridge/platform'
import { usePersistedBoolean } from './usePersistedBoolean'

interface UseHeadlessEngineOptions {
  vaultRootPath: string | null | undefined
  settingsOpen: boolean
}

export function useHeadlessEngine({ vaultRootPath, settingsOpen }: UseHeadlessEngineOptions) {
  const [headlessEngine, setHeadlessEngine] = usePersistedBoolean('scriptor:headless-engine', false)
  const [daemonVersion, setDaemonVersion] = useState<string | null>(null)
  const [daemonError, setDaemonError] = useState<string | null>(null)
  const nativeReady = isNativeBridgeAvailable()

  useEffect(() => {
    setHeadlessMode(headlessEngine && nativeReady)
  }, [headlessEngine, nativeReady])

  const refreshDaemonStatus = useCallback(async () => {
    if (!nativeReady) {
      setDaemonVersion(null)
      setDaemonError(null)
      return
    }
    try {
      const ping = await daemonPing()
      setDaemonVersion(ping.version)
      setDaemonError(null)
    } catch (error) {
      setDaemonVersion(null)
      setDaemonError(error instanceof Error ? error.message : String(error))
    }
  }, [nativeReady])

  const startDaemon = useCallback(async () => {
    if (!nativeReady) return
    try {
      await daemonStart()
      await refreshDaemonStatus()
    } catch (error) {
      setDaemonError(error instanceof Error ? error.message : String(error))
    }
  }, [nativeReady, refreshDaemonStatus])

  const syncDaemonVault = useCallback(async () => {
    if (!nativeReady || !headlessEngine || !vaultRootPath) {
      return
    }
    await ensureDaemonReady()
    await daemonOpenVault(vaultRootPath)
    await refreshDaemonStatus()
  }, [headlessEngine, nativeReady, refreshDaemonStatus, vaultRootPath])

  useEffect(() => {
    if (!nativeReady || !headlessEngine || !vaultRootPath) {
      return
    }
    void syncDaemonVault().catch((error) => {
      setDaemonError(error instanceof Error ? error.message : String(error))
    })
  }, [headlessEngine, nativeReady, syncDaemonVault, vaultRootPath])

  useEffect(() => {
    if (settingsOpen && nativeReady && headlessEngine) {
      void refreshDaemonStatus()
    }
  }, [headlessEngine, nativeReady, refreshDaemonStatus, settingsOpen])

  return {
    headlessEngine,
    setHeadlessEngine,
    daemonVersion,
    daemonError,
    refreshDaemonStatus,
    startDaemon,
    syncDaemonVault,
  }
}
