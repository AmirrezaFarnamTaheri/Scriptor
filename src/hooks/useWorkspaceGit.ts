import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'

import { gitCommit, gitPull, gitPush, gitStatus, type GitPullStrategy } from '../bridge/commands'
import type { ActivityEntry } from './useActivityLog'
import { WorkspaceGitStatusController, vaultStatusKey } from './workspace-git-status'

interface UseWorkspaceGitOptions {
  vaultId: string | null
  refreshVault: () => Promise<void>
  logActivity: (kind: ActivityEntry['kind'], message: string, detail?: string) => void
  setError: (message: string | null) => void
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

  // Distinguish a new session from an old mutation, including A -> B -> A.
  const vaultLifecycleRef = useRef({ vaultId, generation: 0 })
  useEffect(() => {
    const previous = vaultLifecycleRef.current
    if (previous.vaultId !== vaultId) {
      vaultLifecycleRef.current = { vaultId, generation: previous.generation + 1 }
    }
  }, [vaultId])
  const isCurrentVaultLifecycle = useCallback((id: string | null, generation: number) => {
    const current = vaultLifecycleRef.current
    return current.vaultId === id && current.generation === generation
  }, [])

  const snapshot = useSyncExternalStore(controller.subscribe, controller.getSnapshot)

  // React state controls presentation, but only a ref can reject concurrent
  // native mutations before React has committed the next render.
  const mutationInFlightRef = useRef(false)
  const [gitMutationBusy, setGitMutationBusy] = useState(false)
  const beginMutation = useCallback(() => {
    if (mutationInFlightRef.current) return false
    mutationInFlightRef.current = true
    setGitMutationBusy(true)
    return true
  }, [])
  const finishMutation = useCallback(() => {
    mutationInFlightRef.current = false
    setGitMutationBusy(false)
  }, [])

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
      if (!beginMutation()) return
      const lifecycle = vaultLifecycleRef.current.generation
      setError(null)
      try {
        await gitCommit(files, message)
        if (isCurrentVaultLifecycle(targetVaultId, lifecycle)) {
          await controller.refresh(targetVaultId)
        }
        logActivity('success', 'Git commit created', message)
      } catch (caught) {
        const detail = caught instanceof Error ? caught.message : String(caught)
        setError(detail)
        logActivity('error', 'Git commit failed', detail)
      } finally {
        finishMutation()
      }
    },
    [beginMutation, controller, finishMutation, isCurrentVaultLifecycle, logActivity, setError, vaultId],
  )

  const pullRemote = useCallback(async (strategy: GitPullStrategy) => {
    const targetVaultId = vaultId
    if (!beginMutation()) return
    const lifecycle = vaultLifecycleRef.current.generation
    setError(null)
    try {
      if (!targetVaultId) throw new Error('No active vault is open.')
      const result = await gitPull(targetVaultId, strategy)
      if (isCurrentVaultLifecycle(targetVaultId, lifecycle)) {
        await refreshVault()
        if (isCurrentVaultLifecycle(targetVaultId, lifecycle)) {
          await controller.refresh(targetVaultId)
        }
      }
      logActivity('success', `Git pull complete (${strategy})`, result.message)
    } catch (caught) {
      const detail = caught instanceof Error ? caught.message : String(caught)
      setError(detail)
      logActivity('error', `Git pull failed (${strategy})`, detail)
    } finally {
      finishMutation()
    }
  }, [beginMutation, controller, finishMutation, isCurrentVaultLifecycle, logActivity, refreshVault, setError, vaultId])

  const pushRemote = useCallback(async () => {
    const targetVaultId = vaultId
    if (!beginMutation()) return
    const lifecycle = vaultLifecycleRef.current.generation
    setError(null)
    try {
      if (!targetVaultId) throw new Error('No active vault is open.')
      const result = await gitPush(targetVaultId)
      if (isCurrentVaultLifecycle(targetVaultId, lifecycle)) {
        await controller.refresh(targetVaultId)
      }
      logActivity('success', 'Git push complete', result.message)
    } catch (caught) {
      const detail = caught instanceof Error ? caught.message : String(caught)
      setError(detail)
      logActivity('error', 'Git push failed', detail)
    } finally {
      finishMutation()
    }
  }, [beginMutation, controller, finishMutation, isCurrentVaultLifecycle, logActivity, setError, vaultId])

  const scopedSlot = vaultId === null ? undefined : snapshot.slots[vaultStatusKey(vaultId)]

  return {
    gitStatusState: scopedSlot?.status ?? null,
    gitStatusError: scopedSlot?.error ?? null,
    // Until this vault's own slot exists, the panel cannot truthfully claim
    // "not a repository" — it is still waiting for its first status read.
    isGitStatusLoading: snapshot.isLoading || (vaultId !== null && scopedSlot === undefined),
    isGitBusy: gitMutationBusy,
    refreshGit,
    commitFiles,
    pullRemote,
    pushRemote,
  }
}
