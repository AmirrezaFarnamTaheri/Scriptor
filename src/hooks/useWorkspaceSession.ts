import { useCallback, useEffect, useMemo, useRef } from 'react'

import { vaultReadWorkspaceSession, vaultSaveWorkspaceSession } from '../bridge/commands'
import { createVaultBoundSessionWrites } from './workspace-session-persistence'

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
  const writesRef = useRef(createVaultBoundSessionWrites())
  const initialSnapshotRef = useRef<{ vaultId: string; serialized: string } | null>(null)
  const writesEnabledRef = useRef(false)
  const payload = useMemo(
    () => ({
      version: 1 as const,
      active_path: snapshot.activePath,
      open_tabs: snapshot.openTabs.map((tab) => ({ path: tab.path, pinned: Boolean(tab.pinned) })),
      collapsed_folders: snapshot.collapsedFolders,
      sidebar_view: snapshot.sidebarView,
    }),
    [snapshot.activePath, snapshot.collapsedFolders, snapshot.openTabs, snapshot.sidebarView],
  )
  const serializedPayload = useMemo(() => JSON.stringify(payload), [payload])
  const latestSerializedPayloadRef = useRef(serializedPayload)

  useEffect(() => {
    latestSerializedPayloadRef.current = serializedPayload
  }, [serializedPayload])

  const persist = useCallback(async () => {
    if (!vaultId) return
    const writes = writesRef.current
    await writes.enqueue(vaultId, writes.generation(), () => vaultSaveWorkspaceSession(payload))
  }, [payload, vaultId])

  useEffect(() => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }
    writesRef.current.beginVault(vaultId ?? null)
    hydratedVaultRef.current = null
    writesEnabledRef.current = false
    initialSnapshotRef.current = vaultId
      ? { vaultId, serialized: latestSerializedPayloadRef.current }
      : null
  }, [vaultId])

  useEffect(() => {
    if (!vaultId) return
    const baseline = initialSnapshotRef.current
    if (!baseline || baseline.vaultId !== vaultId) {
      initialSnapshotRef.current = { vaultId, serialized: serializedPayload }
      return
    }
    if (!writesEnabledRef.current) {
      if (baseline.serialized === serializedPayload) return
      writesEnabledRef.current = true
    }
    timerRef.current = window.setTimeout(() => {
      void persist().catch(() => {})
    }, 400)
    return () => {
      if (timerRef.current) {
        window.clearTimeout(timerRef.current)
      }
    }
  }, [persist, serializedPayload, vaultId])

  const loadSession = useCallback(async (): Promise<WorkspaceSessionSnapshot | null> => {
    if (!vaultId) return null
    if (hydratedVaultRef.current === vaultId) return null
    const writes = writesRef.current
    const generation = writes.generation()
    hydratedVaultRef.current = vaultId
    try {
      const session = await vaultReadWorkspaceSession()
      if (!writes.isCurrent(vaultId, generation)) return null
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
