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
  setGmailManagerOpen?: (open: boolean) => void
  showToast?: (message: string) => void
}

export function usePluginCommandRuntime(options: PluginCommandRuntimeOptions) {
  const {
    refreshHealth,
    fixVaultLint,
    exportWithProfile,
    setStatusDockTab,
    setHealthDashboardOpen,
    setCanvasOpen,
    setBibliographyOpen,
    setGmailManagerOpen,
    showToast,
  } = options
  return useMemo(() => ({
    refreshHealth: () => refreshHealth(),
    fixVaultLint: () => fixVaultLint(),
    exportWithProfile,
    setStatusDockTab,
    setHealthDashboardOpen,
    openCanvas: () => setCanvasOpen(true),
    openBibliography: () => setBibliographyOpen(true),
    openGmailManager: setGmailManagerOpen ? () => setGmailManagerOpen(true) : undefined,
    showToast,
  }), [exportWithProfile, fixVaultLint, refreshHealth, setBibliographyOpen, setCanvasOpen, setGmailManagerOpen, setHealthDashboardOpen, setStatusDockTab, showToast])
}
