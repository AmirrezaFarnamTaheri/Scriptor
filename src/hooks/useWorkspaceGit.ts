import { useCallback, useLayoutEffect, useRef, useState } from 'react'

import { gitCommit, gitPull, gitPush, gitStatus } from '../bridge/commands'
import type { GitStatus } from '../types/vault'
import type { ActivityEntry } from './useActivityLog'
import { OperationGuard } from './operation-guard'

interface UseWorkspaceGitOptions {
  vaultId: string | null
  refreshVault: () => Promise<void>
  logActivity: (kind: ActivityEntry['kind'], message: string, detail?: string) => void
  setError: (message: string | null) => void
}

/**
 * Owns Git status refresh state separately from user-triggered mutations. Status
 * failures stay local to the Git surface and never overwrite workspace-wide errors.
 */
export function useWorkspaceGit({
  refreshVault,
  vaultId,
  logActivity,
  setError,
}: UseWorkspaceGitOptions) {
  const [gitStatusState, setGitStatusState] = useState<{ vaultId: string | null; status: GitStatus } | null>(null)
  const [gitStatusError, setGitStatusError] = useState<{ vaultId: string | null; detail: string } | null>(null)
  const [isGitStatusLoading, setIsGitStatusLoading] = useState<{ vaultId: string | null; active: boolean } | null>(null)
  const [isGitMutationBusy, setIsGitMutationBusy] = useState<{ vaultId: string | null; active: boolean } | null>(null)
  const statusGuardRef = useRef(new OperationGuard())
  const mutationGuardRef = useRef(new OperationGuard())
  const vaultIdRef = useRef(vaultId)

  useLayoutEffect(() => {
    vaultIdRef.current = vaultId
  }, [vaultId])

  const isCurrentVault = useCallback((targetVaultId: string | null) => vaultIdRef.current === targetVaultId, [])

  const refreshGit = useCallback(async () => {
    const targetVaultId = vaultId
    const request = statusGuardRef.current.issue()
    setIsGitStatusLoading({ vaultId: targetVaultId, active: true })
    setGitStatusError(null)
    try {
      const status = await gitStatus()
      if (!statusGuardRef.current.isCurrent(request) || !isCurrentVault(targetVaultId)) return
      setGitStatusState({ vaultId: targetVaultId, status })
    } catch (caught) {
      if (!statusGuardRef.current.isCurrent(request) || !isCurrentVault(targetVaultId)) return
      const detail = caught instanceof Error ? caught.message : String(caught)
      console.error('useWorkspaceGit: gitStatus error', caught)
      setGitStatusError({ vaultId: targetVaultId, detail })
      logActivity('error', 'Git status refresh failed', detail)
    } finally {
      if (statusGuardRef.current.isCurrent(request) && isCurrentVault(targetVaultId)) {
        setIsGitStatusLoading({ vaultId: targetVaultId, active: false })
      }
    }
  }, [isCurrentVault, logActivity, vaultId])

  const commitFiles = useCallback(
    async (files: string[], message: string) => {
      const targetVaultId = vaultId
      if (gitStatusState?.vaultId !== targetVaultId || !gitStatusState.status.is_repo) {
        setError('This vault is not a Git repository.')
        return
      }
      const request = mutationGuardRef.current.issue()
      setIsGitMutationBusy({ vaultId: targetVaultId, active: true })
      setError(null)
      try {
        await gitCommit(files, message)
        await refreshGit()
        if (!mutationGuardRef.current.isCurrent(request) || !isCurrentVault(targetVaultId)) return
        logActivity('success', 'Git commit created', message)
      } catch (caught) {
        if (!mutationGuardRef.current.isCurrent(request) || !isCurrentVault(targetVaultId)) return
        const detail = caught instanceof Error ? caught.message : String(caught)
        setError(detail)
        logActivity('error', 'Git commit failed', detail)
      } finally {
        if (mutationGuardRef.current.isCurrent(request) && isCurrentVault(targetVaultId)) {
          setIsGitMutationBusy({ vaultId: targetVaultId, active: false })
        }
      }
    },
    [gitStatusState, isCurrentVault, logActivity, refreshGit, setError, vaultId],
  )

  const pullRemote = useCallback(async () => {
    const targetVaultId = vaultId
    const request = mutationGuardRef.current.issue()
    setIsGitMutationBusy({ vaultId: targetVaultId, active: true })
    setError(null)
    try {
      if (!targetVaultId) throw new Error('No active vault is open.')
      const result = await gitPull(targetVaultId)
      await refreshVault()
      await refreshGit()
      if (!mutationGuardRef.current.isCurrent(request) || !isCurrentVault(targetVaultId)) return
      logActivity('success', 'Git pull complete', result.message)
    } catch (caught) {
      if (!mutationGuardRef.current.isCurrent(request) || !isCurrentVault(targetVaultId)) return
      const detail = caught instanceof Error ? caught.message : String(caught)
      setError(detail)
      logActivity('error', 'Git pull failed', detail)
    } finally {
      if (mutationGuardRef.current.isCurrent(request) && isCurrentVault(targetVaultId)) {
        setIsGitMutationBusy({ vaultId: targetVaultId, active: false })
      }
    }
  }, [isCurrentVault, logActivity, refreshGit, refreshVault, setError, vaultId])

  const pushRemote = useCallback(async () => {
    const targetVaultId = vaultId
    const request = mutationGuardRef.current.issue()
    setIsGitMutationBusy({ vaultId: targetVaultId, active: true })
    setError(null)
    try {
      if (!targetVaultId) throw new Error('No active vault is open.')
      const result = await gitPush(targetVaultId)
      await refreshGit()
      if (!mutationGuardRef.current.isCurrent(request) || !isCurrentVault(targetVaultId)) return
      logActivity('success', 'Git push complete', result.message)
    } catch (caught) {
      if (!mutationGuardRef.current.isCurrent(request) || !isCurrentVault(targetVaultId)) return
      const detail = caught instanceof Error ? caught.message : String(caught)
      setError(detail)
      logActivity('error', 'Git push failed', detail)
    } finally {
      if (mutationGuardRef.current.isCurrent(request) && isCurrentVault(targetVaultId)) {
        setIsGitMutationBusy({ vaultId: targetVaultId, active: false })
      }
    }
  }, [isCurrentVault, logActivity, refreshGit, setError, vaultId])

  return {
    gitStatusState: gitStatusState?.vaultId === vaultId ? gitStatusState.status : null,
    gitStatusError: gitStatusError?.vaultId === vaultId ? gitStatusError.detail : null,
    isGitStatusLoading: isGitStatusLoading?.vaultId === vaultId && isGitStatusLoading.active,
    isGitBusy: isGitMutationBusy?.vaultId === vaultId && isGitMutationBusy.active,
    refreshGit,
    commitFiles,
    pullRemote,
    pushRemote,
  }
}
