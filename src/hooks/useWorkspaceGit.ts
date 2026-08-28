import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'

import { gitCommit, gitPull, gitPush, gitStatus } from '../bridge/commands'
import type { ActivityEntry } from './useActivityLog'
import { WorkspaceGitStatusController, vaultStatusKey } from './workspace-git-status'

interface UseWorkspaceGitOptions {
  vaultId: string | null
  refreshVault: () => Promise<void>
  logActivity: (kind: ActivityEntry['kind'], message: string, detail?: string) => void
  setError: (message: string | null) => void
}

interface GitMutationBusyState {
  vaultId: string | null
  active: boolean
}

/**
 * Owns Git status refresh state separately from user-triggered mutations. Status
 * freshness lives in a framework-free per-vault controller (see
 * `workspace-git-status.ts`) so results never leak across vault switches and the
 * vault-open flow cannot lose its in-flight fetch to render timing. Status
 * failures stay local to the Git surface and never overwrite workspace-wide errors.
 */
export function useWorkspaceGit({
  refreshVault,
  vaultId,
  logActivity,
  setError,
}: UseWorkspaceGitOptions) {
  const logActivityRef = useRef(logActivity)
  useEffect(() => {
    logActivityRef.current = logActivity
  }, [logActivity])

  const [controller] = useState(() => new WorkspaceGitStatusController(gitStatus))

  useEffect(() => {
    controller.setStatusErrorHandler((detail) => {
      logActivityRef.current('error', 'Git status refresh failed', detail)
    })
    return () => controller.setStatusErrorHandler(undefined)
  }, [controller])

  useEffect(() => {
    controller.setActiveVault(vaultId)
  }, [controller, vaultId])

  const snapshot = useSyncExternalStore(controller.subscribe, controller.getSnapshot)

  const [gitMutationBusy, setGitMutationBusy] = useState<GitMutationBusyState | null>(null)

  const refreshGit = useCallback(
    (explicitVaultId?: string | null) => controller.refresh(explicitVaultId),
    [controller],
  )

  const commitFiles = useCallback(
    async (files: string[], message: string) => {
      const targetVaultId = vaultId
      if (!targetVaultId || controller.getStatus(targetVaultId)?.is_repo !== true) {
        setError('This vault is not a Git repository.')
        return
      }
      setGitMutationBusy({ vaultId: targetVaultId, active: true })
      setError(null)
      try {
        await gitCommit(files, message)
        await controller.refresh()
        logActivity('success', 'Git commit created', message)
      } catch (caught) {
        const detail = caught instanceof Error ? caught.message : String(caught)
        setError(detail)
        logActivity('error', 'Git commit failed', detail)
      } finally {
        setGitMutationBusy({ vaultId: targetVaultId, active: false })
      }
    },
    [controller, logActivity, setError, vaultId],
  )

  const pullRemote = useCallback(async () => {
    const targetVaultId = vaultId
    setGitMutationBusy({ vaultId: targetVaultId, active: true })
    setError(null)
    try {
      if (!targetVaultId) throw new Error('No active vault is open.')
      const result = await gitPull(targetVaultId)
      await refreshVault()
      await controller.refresh()
      logActivity('success', 'Git pull complete', result.message)
    } catch (caught) {
      const detail = caught instanceof Error ? caught.message : String(caught)
      setError(detail)
      logActivity('error', 'Git pull failed', detail)
    } finally {
      setGitMutationBusy({ vaultId: targetVaultId, active: false })
    }
  }, [controller, logActivity, refreshVault, setError, vaultId])

  const pushRemote = useCallback(async () => {
    const targetVaultId = vaultId
    setGitMutationBusy({ vaultId: targetVaultId, active: true })
    setError(null)
    try {
      if (!targetVaultId) throw new Error('No active vault is open.')
      const result = await gitPush(targetVaultId)
      await controller.refresh()
      logActivity('success', 'Git push complete', result.message)
    } catch (caught) {
      const detail = caught instanceof Error ? caught.message : String(caught)
      setError(detail)
      logActivity('error', 'Git push failed', detail)
    } finally {
      setGitMutationBusy({ vaultId: targetVaultId, active: false })
    }
  }, [controller, logActivity, setError, vaultId])

  const scopedSlot = vaultId === null ? undefined : snapshot.slots[vaultStatusKey(vaultId)]

  return {
    gitStatusState: scopedSlot?.status ?? null,
    gitStatusError: scopedSlot?.error ?? null,
    // Until this vault's own slot exists, the panel cannot truthfully claim
    // "not a repository" — it is still waiting for its first status read.
    isGitStatusLoading: snapshot.isLoading || (vaultId !== null && scopedSlot === undefined),
    isGitBusy: gitMutationBusy?.vaultId === vaultId && gitMutationBusy.active,
    refreshGit,
    commitFiles,
    pullRemote,
    pushRemote,
  }
}
