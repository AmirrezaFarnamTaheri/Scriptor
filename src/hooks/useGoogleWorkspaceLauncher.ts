import { useCallback, useEffect, useRef } from 'react'
import type { GoogleWorkspaceKind } from '../components/GoogleIntegrationSettingsSection'
import { useI18n } from '../lib/i18n'
import type { useVaultWorkspace } from './useVaultWorkspace'
import type { useWorkspaceComposition } from './useWorkspaceComposition'

/** Load persisted setup before opening a provider workflow in its owning vault. */
export function useGoogleWorkspaceLauncher(
  workspace: Pick<ReturnType<typeof useVaultWorkspace>, 'vault' | 'refreshVaultConfig'>,
  composition: Pick<ReturnType<typeof useWorkspaceComposition>, 'commands'>,
  controls: {
    setSettingsOpen: (open: boolean) => void
    setTasksOpen: (open: boolean) => void
    setGmailManagerOpen: (open: boolean) => void
    showToast: (message: string) => void
  },
) {
  const { t } = useI18n()
  const vaultId = workspace.vault?.id
  const currentVaultId = useRef(vaultId)
  const mounted = useRef(true)
  const launchGeneration = useRef(0)
  useEffect(() => {
    mounted.current = true
    currentVaultId.current = vaultId
    return () => { mounted.current = false; launchGeneration.current++ }
  }, [vaultId])
  const { refreshVaultConfig } = workspace
  const { commands } = composition
  const { setSettingsOpen, setTasksOpen, setGmailManagerOpen, showToast } = controls
  return useCallback((kind: GoogleWorkspaceKind) => {
    if (!vaultId) return
    const generation = ++launchGeneration.current
    void refreshVaultConfig().then(refreshed => {
      if (!mounted.current || currentVaultId.current !== vaultId || generation !== launchGeneration.current) return
      if (!refreshed) { showToast(t('settingsPanel.configReadFailed')); return }
      setSettingsOpen(false)
      if (kind === 'collaboration') void commands.find(command => command.id === 'open-drive-collaboration')?.run()
      else if (kind === 'planner') setTasksOpen(true)
      else setGmailManagerOpen(true)
    })
  }, [commands, refreshVaultConfig, setGmailManagerOpen, setSettingsOpen, setTasksOpen, showToast, t, vaultId])
}
