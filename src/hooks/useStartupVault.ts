import { useEffect } from 'react'

import type { useRecentVaults } from './useRecentVaults'
import type { useVaultWorkspace } from './useVaultWorkspace'

interface StartupVaultOptions {
  nativeReady: boolean
  recentVaults: Pick<ReturnType<typeof useRecentVaults>, 'recent' | 'forget'>
  workspace: Pick<ReturnType<typeof useVaultWorkspace>, 'vault' | 'status' | 'openVaultAt'>
}

/** Restore the last vault on native startup, with the existing default-vault fallback. */
export function useStartupVault({ nativeReady, recentVaults, workspace }: StartupVaultOptions) {
  useEffect(() => {
    if (!nativeReady || workspace.vault || workspace.status !== 'idle') return

    void (async () => {
      // 1. Try to open the most recent vault
      if (recentVaults.recent.length > 0) {
        try {
          await workspace.openVaultAt(recentVaults.recent[0])
          return
        } catch {
          // If it fails (e.g. folder deleted), forget it and fall through to default
          recentVaults.forget(recentVaults.recent[0])
        }
      }

      // 2. Fall back to default cache folder
      try {
        const { documentDir, join } = await import('@tauri-apps/api/path')
        const docDir = await documentDir()
        const defaultVaultPath = await join(docDir, 'ScriptorVault')
        await workspace.openVaultAt(defaultVaultPath)
      } catch (err) {
        console.error('Failed to auto-open default vault:', err)
      }
    })()
  }, [nativeReady, recentVaults, workspace])
}
