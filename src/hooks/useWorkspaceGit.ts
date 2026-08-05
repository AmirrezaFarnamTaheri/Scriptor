import { useCallback, useState } from 'react'

import { gitCommit, gitPull, gitPush, gitStatus } from '../bridge/commands'
import type { GitStatus } from '../types/vault'
import type { ActivityEntry } from './useActivityLog'

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
  const [gitStatusState, setGitStatusState] = useState<GitStatus | null>(null)
  const [gitStatusError, setGitStatusError] = useState<string | null>(null)
  const [isGitStatusLoading, setIsGitStatusLoading] = useState(false)
  const [isGitMutationBusy, setIsGitMutationBusy] = useState(false)

  const refreshGit = useCallback(async () => {
    setIsGitStatusLoading(true)
    setGitStatusError(null)
    try {
      const status = await gitStatus()
      setGitStatusState(status)
    } catch (caught) {
      const detail = caught instanceof Error ? caught.message : String(caught)
      console.error('useWorkspaceGit: gitStatus error', caught)
      setGitStatusError(detail)
      logActivity('error', 'Git status refresh failed', detail)
    } finally {
      setIsGitStatusLoading(false)
    }
  }, [logActivity])

  const commitFiles = useCallback(
    async (files: string[], message: string) => {
      if (!gitStatusState?.is_repo) {
        setError('This vault is not a Git repository.')
        return
      }
      setIsGitMutationBusy(true)
      setError(null)
      try {
        await gitCommit(files, message)
        await refreshGit()
        logActivity('success', 'Git commit created', message)
      } catch (caught) {
        const detail = caught instanceof Error ? caught.message : String(caught)
        setError(detail)
        logActivity('error', 'Git commit failed', detail)
      } finally {
        setIsGitMutationBusy(false)
      }
    },
    [gitStatusState, logActivity, refreshGit, setError],
  )

  const pullRemote = useCallback(async () => {
    setIsGitMutationBusy(true)
    setError(null)
    try {
      if (!vaultId) throw new Error('No active vault is open.')
      const result = await gitPull(vaultId)
      await refreshVault()
      await refreshGit()
      logActivity('success', 'Git pull complete', result.message)
    } catch (caught) {
      const detail = caught instanceof Error ? caught.message : String(caught)
      setError(detail)
      logActivity('error', 'Git pull failed', detail)
    } finally {
      setIsGitMutationBusy(false)
    }
  }, [logActivity, refreshGit, refreshVault, setError, vaultId])

  const pushRemote = useCallback(async () => {
    setIsGitMutationBusy(true)
    setError(null)
    try {
      if (!vaultId) throw new Error('No active vault is open.')
      const result = await gitPush(vaultId)
      await refreshGit()
      logActivity('success', 'Git push complete', result.message)
    } catch (caught) {
      const detail = caught instanceof Error ? caught.message : String(caught)
      setError(detail)
      logActivity('error', 'Git push failed', detail)
    } finally {
      setIsGitMutationBusy(false)
    }
  }, [logActivity, refreshGit, setError, vaultId])

  return {
    gitStatusState,
    gitStatusError,
    isGitStatusLoading,
    isGitBusy: isGitMutationBusy,
    refreshGit,
    commitFiles,
    pullRemote,
    pushRemote,
  }
}
