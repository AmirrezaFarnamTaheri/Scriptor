import { useCallback, useEffect, useRef } from 'react'

import { vaultReadWorkspaceSession, vaultSaveWorkspaceSession } from '../bridge/commands'

export interface WorkspaceSessionSnapshot {
  activePath: string | null
  openTabs: Array<{ path: string; pinned?: boolean }>
  collapsedFolders: Record<string, boolean>
  sidebarView: 'vault' | 'inbox'
}

export function useWorkspaceSession(
  vaultId: string | null | undefined,
  snapshot: WorkspaceSessionSnapshot,
) {
  const timerRef = useRef<number | null>(null)
  const hydratedVaultRef = useRef<string | null>(null)

  const persist = useCallback(async () => {
    if (!vaultId) return
    await vaultSaveWorkspaceSession({
      version: 1,
      active_path: snapshot.activePath,
      open_tabs: snapshot.openTabs.map((tab) => ({
        path: tab.path,
        pinned: Boolean(tab.pinned),
      })),
      collapsed_folders: snapshot.collapsedFolders,
      sidebar_view: snapshot.sidebarView,
    })
  }, [snapshot.activePath, snapshot.collapsedFolders, snapshot.openTabs, snapshot.sidebarView, vaultId])

  useEffect(() => {
    if (!vaultId) return
    if (timerRef.current) {
      window.clearTimeout(timerRef.current)
    }
    timerRef.current = window.setTimeout(() => {
      void persist().catch(() => {})
    }, 400)
    return () => {
      if (timerRef.current) {
        window.clearTimeout(timerRef.current)
      }
    }
  }, [persist, vaultId])

  const loadSession = useCallback(async (): Promise<WorkspaceSessionSnapshot | null> => {
    if (!vaultId) return null
    if (hydratedVaultRef.current === vaultId) return null
    hydratedVaultRef.current = vaultId
    try {
      const session = await vaultReadWorkspaceSession()
      return {
        activePath: session.active_path ?? null,
        openTabs: session.open_tabs.map((tab) => ({ path: tab.path, pinned: tab.pinned })),
        collapsedFolders: session.collapsed_folders ?? {},
        sidebarView: session.sidebar_view === 'inbox' ? 'inbox' : 'vault',
      }
    } catch {
      return null
    }
  }, [vaultId])

  const resetHydration = useCallback(() => {
    hydratedVaultRef.current = null
  }, [])

  return { loadSession, resetHydration, persistSession: persist }
}
