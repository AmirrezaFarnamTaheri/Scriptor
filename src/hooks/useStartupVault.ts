import { useEffect, useLayoutEffect, useRef } from 'react'

import type { useRecentVaults } from './useRecentVaults'
import type { useVaultWorkspace } from './useVaultWorkspace'

interface StartupVaultOptions {
  nativeReady: boolean
  recentVaults: Pick<ReturnType<typeof useRecentVaults>, 'recent' | 'forget'>
  workspace: Pick<ReturnType<typeof useVaultWorkspace>, 'vault' | 'status' | 'openVaultAt'>
}

/** Restore the last vault on native startup, with the existing default-vault fallback. */
export function useStartupVault({ nativeReady, recentVaults, workspace }: StartupVaultOptions) {
  const latest = useRef({ nativeReady, workspace, recentVaults })
  useLayoutEffect(() => { latest.current = { nativeReady, workspace, recentVaults } }, [nativeReady, workspace, recentVaults])
  const lifetime = useRef(0)
  const started = useRef(false)
  useEffect(() => {
    lifetime.current++
    started.current = false
    return () => { lifetime.current++ }
  }, [nativeReady])
  useEffect(() => {
    // E2E visual coverage needs a deterministic true-empty startup state. The
    // flag lives in sessionStorage so it can never persist into a real user
    // session and has no effect unless a test explicitly opts in.
    if (typeof window !== 'undefined' && window.sessionStorage.getItem('e2e:no-auto-open') === '1') return
    if (!nativeReady || workspace.vault || workspace.status !== 'idle' || started.current) return
    started.current = true

    const ownedLifetime = lifetime.current
    let failedAttempt: (() => boolean) | null = null
    const isLive = () => lifetime.current === ownedLifetime && latest.current.nativeReady
    const canOpen = () => isLive() && !latest.current.workspace.vault
      && (failedAttempt ? failedAttempt() : latest.current.workspace.status === 'idle')

    void (async () => {
      // 1. Try to open the most recent vault
      if (recentVaults.recent.length > 0) {
        const result = await workspace.openVaultAt(recentVaults.recent[0])
        if (result.status !== 'failed' || !isLive() || !result.isCurrent()) return
        failedAttempt = result.isCurrent
        if (!canOpen()) return
        // Native opening reports failures without rejecting its promise.
        latest.current.recentVaults.forget(recentVaults.recent[0])
      }

      // 2. Fall back to default cache folder
      try {
        const { documentDir, join } = await import('@tauri-apps/api/path')
        if (!canOpen()) return
        const docDir = await documentDir()
        if (!canOpen()) return
        const defaultVaultPath = await join(docDir, 'ScriptorVault')
        if (!canOpen()) return
        await latest.current.workspace.openVaultAt(defaultVaultPath)
      } catch (err) {
        if (!isLive()) return
        console.error('Failed to auto-open default vault:', err)
      }
    })().catch(err => {
      if (isLive()) console.error('Failed to restore startup vault:', err)
    })
  }, [nativeReady, recentVaults, workspace])
}
