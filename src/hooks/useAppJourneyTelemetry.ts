import { useEffect } from 'react'

interface UseAppJourneyTelemetryOptions {
  vaultOpen: boolean
  lastRebuildMs: number | null
  exportCompleted: boolean
  panelOpen: {
    git: boolean
    mcp: boolean
    portal: boolean
    workbench: boolean
  }
  workspaceStatus: string
  openTabCount: number
  sectionCount: number
  graphNodeCount: number | null
  perfHudOpen: boolean
  markVaultOpen: () => void
  markIndexRebuild: (elapsedMs: number) => void
  markExport: () => void
  recordPanelOpen: (panel: 'git' | 'mcp' | 'portal' | 'workbench') => void
  markVaultOpenStart: () => void
  markVaultOpenEnd: () => void
  setWorkspaceCounts: (openTabs: number, sections: number) => void
  setGraphNodeCount: (count: number | null) => void
}

/**
 * Bridges workspace lifecycle signals into journey/performance telemetry.
 * App owns the product state; this hook owns synchronization with telemetry sinks.
 */
export function useAppJourneyTelemetry({
  vaultOpen,
  lastRebuildMs,
  exportCompleted,
  panelOpen,
  workspaceStatus,
  openTabCount,
  sectionCount,
  graphNodeCount,
  perfHudOpen,
  markVaultOpen,
  markIndexRebuild,
  markExport,
  recordPanelOpen,
  markVaultOpenStart,
  markVaultOpenEnd,
  setWorkspaceCounts,
  setGraphNodeCount,
}: UseAppJourneyTelemetryOptions): void {
  const { git: gitOpen, mcp: mcpOpen, portal: portalOpen, workbench: workbenchOpen } = panelOpen

  useEffect(() => {
    if (vaultOpen) markVaultOpen()
  }, [markVaultOpen, vaultOpen])

  useEffect(() => {
    if (lastRebuildMs != null) markIndexRebuild(lastRebuildMs)
  }, [lastRebuildMs, markIndexRebuild])

  useEffect(() => {
    if (exportCompleted) markExport()
  }, [exportCompleted, markExport])

  useEffect(() => {
    if (gitOpen) recordPanelOpen('git')
    if (mcpOpen) recordPanelOpen('mcp')
    if (portalOpen) recordPanelOpen('portal')
    if (workbenchOpen) recordPanelOpen('workbench')
  }, [gitOpen, mcpOpen, portalOpen, recordPanelOpen, workbenchOpen])

  useEffect(() => {
    try {
      window.localStorage.setItem('scriptor:perf-hud', perfHudOpen ? 'true' : 'false')
    } catch {
      // Telemetry preferences remain available in memory when storage is unavailable.
    }
  }, [perfHudOpen])

  useEffect(() => {
    if (workspaceStatus === 'opening') markVaultOpenStart()
    if (workspaceStatus === 'ready') markVaultOpenEnd()
  }, [markVaultOpenEnd, markVaultOpenStart, workspaceStatus])

  useEffect(() => {
    setWorkspaceCounts(openTabCount, sectionCount)
  }, [openTabCount, sectionCount, setWorkspaceCounts])

  useEffect(() => {
    setGraphNodeCount(graphNodeCount)
  }, [graphNodeCount, setGraphNodeCount])
}
