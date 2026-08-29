import { useMemo } from 'react'

import type { StatusDockTab } from '../components/StatusDockPanel'

interface PluginCommandRuntimeOptions {
  refreshHealth: () => Promise<void>
  fixVaultLint: () => Promise<unknown>
  exportWithProfile: (profileId: string, dryRun?: boolean) => Promise<void>
  setStatusDockTab: (tab: StatusDockTab) => void
  setHealthDashboardOpen: (open: boolean) => void
  setCanvasOpen: (open: boolean) => void
  setBibliographyOpen: (open: boolean) => void
}

export function usePluginCommandRuntime(options: PluginCommandRuntimeOptions) {
  const { refreshHealth, fixVaultLint, exportWithProfile, setStatusDockTab, setHealthDashboardOpen, setCanvasOpen, setBibliographyOpen } = options
  return useMemo(() => ({
    refreshHealth: () => refreshHealth(),
    fixVaultLint: () => fixVaultLint(),
    exportWithProfile,
    setStatusDockTab,
    setHealthDashboardOpen,
    openCanvas: () => setCanvasOpen(true),
    openBibliography: () => setBibliographyOpen(true),
  }), [exportWithProfile, fixVaultLint, refreshHealth, setBibliographyOpen, setCanvasOpen, setHealthDashboardOpen, setStatusDockTab])
}
