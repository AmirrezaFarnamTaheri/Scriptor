import type { MutableRefObject } from 'react'
import { useCallback, useState } from 'react'

import {
  indexerApplyFilesystemChanges,
  indexerBacklinks,
  indexerGraph,
  indexerRebuild,
  vaultHealthDiagnostics,
} from '../bridge/commands'
import type {
  BacklinkHit,
  GraphQueryOutput,
  RebuildSummary,
  VaultDescriptor,
  VaultHealthDiagnostics,
  VaultHealthReport,
} from '../types/vault'
import type { ActivityEntry } from './useActivityLog'

type WorkspaceStatus = 'idle' | 'opening' | 'indexing' | 'ready' | 'error'

interface UseWorkspaceDiagnosticsOptions {
  vault: VaultDescriptor | null
  setStatus: (status: WorkspaceStatus) => void
  setError: (message: string | null) => void
  logActivity: (kind: ActivityEntry['kind'], message: string, detail?: string) => void
  refreshVaultEntries: () => Promise<void>
  entriesRef: MutableRefObject<{ path: string }[]>
  activePathRef: MutableRefObject<string | null>
  searchQuery: string
  runSearch: (query: string) => Promise<void>
}

export function useWorkspaceDiagnostics({
  vault,
  setStatus,
  setError,
  logActivity,
  refreshVaultEntries,
  entriesRef,
  activePathRef,
  searchQuery,
  runSearch,
}: UseWorkspaceDiagnosticsOptions) {
  const [health, setHealth] = useState<VaultHealthReport | null>(null)
  const [healthDiagnostics, setHealthDiagnostics] = useState<VaultHealthDiagnostics | null>(null)
  const [rebuild, setRebuild] = useState<RebuildSummary | null>(null)
  const [lastRebuildMs, setLastRebuildMs] = useState<number | null>(null)
  const [backlinks, setBacklinks] = useState<BacklinkHit[]>([])
  const [graph, setGraph] = useState<GraphQueryOutput | null>(null)

  const refreshHealth = useCallback(async (vaultOverride?: VaultDescriptor | null) => {
    const activeVault = vaultOverride ?? vault
    if (!activeVault) {
      setHealth(null)
      setHealthDiagnostics(null)
      return
    }
    try {
      const diagnostics = await vaultHealthDiagnostics()
      setHealth(diagnostics.summary)
      setHealthDiagnostics(diagnostics)
    } catch {
      setHealth(null)
      setHealthDiagnostics(null)
    }
  }, [vault])

  const loadBacklinks = useCallback(async (path: string) => {
    try {
      const hits = await indexerBacklinks(path)
      setBacklinks(hits)
    } catch {
      setBacklinks([])
    }
  }, [])

  const loadGraph = useCallback(
    async (focusPath?: string | null, options?: { depth?: number; fullVault?: boolean }) => {
      try {
        const data = await indexerGraph(
          options?.fullVault ? undefined : (focusPath ?? undefined),
          options?.depth ?? 2,
        )
        setGraph(data)
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : String(caught))
        setGraph(null)
      }
    },
    [setError],
  )

  const rebuildIndex = useCallback(async () => {
    if (!vault) return
    setStatus('indexing')
    setError(null)
    const started = performance.now()
    try {
      const summary = await indexerRebuild()
      setLastRebuildMs(Math.round(performance.now() - started))
      setRebuild(summary)
      setHealth(summary.health)
      await refreshVaultEntries()
      logActivity(
        'success',
        'Index rebuilt',
        `${summary.indexed_notes + summary.skipped_notes} notes processed`,
      )
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : String(caught)
      setError(message)
      logActivity('error', 'Index rebuild failed', message)
    } finally {
      setStatus('ready')
    }
  }, [logActivity, refreshVaultEntries, setError, setStatus, vault])

  const applyFilesystemChanges = useCallback(
    async (paths: string[]) => {
      const unique = [...new Set(paths.filter(Boolean))]
      if (unique.length === 0) {
        return
      }

      try {
        const summary = await indexerApplyFilesystemChanges(unique)
        const knownPaths = new Set(entriesRef.current.map((entry) => entry.path))
        const needsScan = summary.removed > 0 || unique.some((path) => !knownPaths.has(path))
        if (needsScan) {
          await refreshVaultEntries()
        }
        await refreshHealth()
        if (summary.updated > 0 || summary.removed > 0) {
          const active = activePathRef.current
          if (active && unique.includes(active)) {
            void loadBacklinks(active)
            void loadGraph(active)
          }
          if (searchQuery.trim()) {
            await runSearch(searchQuery)
          }
        }
      } catch {
        await refreshVaultEntries()
      }
    },
    [
      activePathRef,
      entriesRef,
      loadBacklinks,
      loadGraph,
      refreshHealth,
      refreshVaultEntries,
      runSearch,
      searchQuery,
    ],
  )

  return {
    health,
    setHealth,
    healthDiagnostics,
    setHealthDiagnostics,
    rebuild,
    setRebuild,
    backlinks,
    setBacklinks,
    graph,
    refreshHealth,
    loadBacklinks,
    loadGraph,
    rebuildIndex,
    applyFilesystemChanges,
    lastRebuildMs,
  }
}
