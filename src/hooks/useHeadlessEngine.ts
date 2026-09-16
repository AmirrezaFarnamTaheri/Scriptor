import { useCallback, useEffect, useRef, useState } from 'react'

import {
  daemonOpenVault,
  daemonPing,
  daemonStart,
  ensureDaemonReady,
  setHeadlessEngineMode,
} from '../bridge/commands'
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
  const headlessSessionRef = useRef(0)

  useEffect(() => {
    if (!nativeReady) {
      return
    }
    void setHeadlessEngineMode(headlessEngine).catch((error) => {
      setDaemonError(error instanceof Error ? error.message : String(error))
    })
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
    const currentSession = ++headlessSessionRef.current
    await ensureDaemonReady()
    if (headlessSessionRef.current !== currentSession) return
    await daemonOpenVault(vaultRootPath)
    if (headlessSessionRef.current !== currentSession) return
    await refreshDaemonStatus()
  }, [headlessEngine, nativeReady, refreshDaemonStatus, vaultRootPath])

  useEffect(() => {
    if (!nativeReady || !headlessEngine || !vaultRootPath) return
    const currentSession = ++headlessSessionRef.current
    let cancelled = false
    void (async () => {
      try {
        await ensureDaemonReady()
        if (cancelled || headlessSessionRef.current !== currentSession) return
        await daemonOpenVault(vaultRootPath)
        if (cancelled || headlessSessionRef.current !== currentSession) return
        const ping = await daemonPing()
        if (cancelled || headlessSessionRef.current !== currentSession) return
        setDaemonVersion(ping.version)
        setDaemonError(null)
      } catch (error: unknown) {
        if (!cancelled && headlessSessionRef.current === currentSession) {
          setDaemonError(error instanceof Error ? error.message : String(error))
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [headlessEngine, nativeReady, vaultRootPath])

  useEffect(() => {
    if (!settingsOpen || !nativeReady || !headlessEngine) return
    let cancelled = false
    void daemonPing()
      .then((ping) => {
        if (!cancelled) {
          setDaemonVersion(ping.version)
          setDaemonError(null)
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setDaemonVersion(null)
          setDaemonError(error instanceof Error ? error.message : String(error))
        }
      })
    return () => {
      cancelled = true
    }
  }, [headlessEngine, nativeReady, settingsOpen])

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
