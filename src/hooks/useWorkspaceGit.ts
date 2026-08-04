import { useCallback, useState } from 'react'

import { gitCommit, gitPull, gitPush, gitStatus } from '../bridge/commands'
import type { GitStatus } from '../types/vault'
import type { ActivityEntry } from './useActivityLog'

export type WorkspaceGitStatus = GitStatus & { loadError?: string }

interface UseWorkspaceGitOptions {
  vaultId: string | null
  refreshVault: () => Promise<void>
  logActivity: (kind: ActivityEntry['kind'], message: string, detail?: string) => void
  setError: (message: string | null) => void
}

function failedGitStatus(loadError: string): WorkspaceGitStatus {
  return {
    is_repo: false,
    branch: null,
    changed_files: [],
    clean: true,
    ahead: 0,
    behind: 0,
    has_upstream: false,
    has_conflicts: false,
    conflicted_files: [],
    loadError,
  }
}

export function useWorkspaceGit({
  refreshVault,
  vaultId,
  logActivity,
  setError,
}: UseWorkspaceGitOptions) {
  const [gitStatusState, setGitStatusState] = useState<WorkspaceGitStatus | null>(null)
  const [isGitBusy, setIsGitBusy] = useState(true)

  const refreshGit = useCallback(async () => {
    setIsGitBusy(true)
    try {
      const status = await gitStatus()
      setGitStatusState(status)
      setError(null)
    } catch (caught) {
      const detail = caught instanceof Error ? caught.message : String(caught)
      console.error('useWorkspaceGit: gitStatus error', caught)
      setGitStatusState(failedGitStatus(detail))
      setError(detail)
      logActivity('error', 'Git status refresh failed', detail)
    } finally {
      setIsGitBusy(false)
    }
  }, [logActivity, setError])

  const commitFiles = useCallback(
    async (files: string[], message: string) => {
      if (!gitStatusState?.is_repo) {
        setError('This vault is not a Git repository.')
        return
      }
      setIsGitBusy(true)
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
        setIsGitBusy(false)
      }
    },
    [gitStatusState, logActivity, refreshGit, setError],
  )

  const pullRemote = useCallback(async () => {
    setIsGitBusy(true)
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
      setIsGitBusy(false)
    }
  }, [logActivity, refreshGit, refreshVault, setError, vaultId])

  const pushRemote = useCallback(async () => {
    setIsGitBusy(true)
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
      setIsGitBusy(false)
    }
  }, [logActivity, refreshGit, setError, vaultId])

  return {
    gitStatusState,
    isGitBusy,
    refreshGit,
    commitFiles,
    pullRemote,
    pushRemote,
  }
}
