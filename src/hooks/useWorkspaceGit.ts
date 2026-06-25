import { useCallback, useState } from 'react'

import { gitCommit, gitPull, gitPush, gitStatus } from '../bridge/commands'
import type { GitStatus } from '../types/vault'
import type { ActivityEntry } from './useActivityLog'

interface UseWorkspaceGitOptions {
  vaultOpen: boolean
  refreshVault: () => Promise<void>
  logActivity: (kind: ActivityEntry['kind'], message: string, detail?: string) => void
  setError: (message: string | null) => void
}

export function useWorkspaceGit({
  vaultOpen,
  refreshVault,
  logActivity,
  setError,
}: UseWorkspaceGitOptions) {
  const [gitStatusState, setGitStatusState] = useState<GitStatus | null>(null)
  const [isGitBusy, setIsGitBusy] = useState(false)

  const refreshGit = useCallback(async () => {
    if (!vaultOpen) {
      setGitStatusState(null)
      return
    }
    try {
      const status = await gitStatus()
      setGitStatusState(status)
    } catch {
      setGitStatusState(null)
    }
  }, [vaultOpen])

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
      const result = await gitPull()
      await refreshVault()
      logActivity('success', 'Git pull complete', result.message)
    } catch (caught) {
      const detail = caught instanceof Error ? caught.message : String(caught)
      setError(detail)
      logActivity('error', 'Git pull failed', detail)
    } finally {
      setIsGitBusy(false)
    }
  }, [logActivity, refreshVault, setError])

  const pushRemote = useCallback(async () => {
    setIsGitBusy(true)
    setError(null)
    try {
      const result = await gitPush()
      await refreshGit()
      logActivity('success', 'Git push complete', result.message)
    } catch (caught) {
      const detail = caught instanceof Error ? caught.message : String(caught)
      setError(detail)
      logActivity('error', 'Git push failed', detail)
    } finally {
      setIsGitBusy(false)
    }
  }, [logActivity, refreshGit, setError])

  return {
    gitStatusState,
    isGitBusy,
    refreshGit,
    commitFiles,
    pullRemote,
    pushRemote,
  }
}
