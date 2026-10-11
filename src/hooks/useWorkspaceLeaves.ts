import { useCallback, useLayoutEffect, useRef, useState } from 'react'
import { closeWorkspaceLeaf, emptyWorkspaceLayout, getWorkspaceActiveLeaf, moveWorkspaceLeaf, openWorkspaceLeaf, parseWorkspaceLayout, prepareWorkspaceLeafTransition, reorderWorkspaceLeaf, selectWorkspaceLeaf, serializeWorkspaceLayout, workspaceLayoutStorageKey, workspaceLeafTransitionRefusal } from '../lib/workspaceLeaves'
import type { WorkspaceLayout, WorkspaceLeafTransition, WorkspaceLeafGroup, WorkspaceLeafReference, WorkspaceLeafReason } from '../lib/workspaceLeaves'

export type { WorkspaceLeafTransition, WorkspaceLeafReason } from '../lib/workspaceLeaves'
export type WorkspaceLeafStatus = 'idle' | 'pending' | 'refused'
interface Options {
  vaultId: string | null
  available: (reference: WorkspaceLeafReference) => boolean
  approve: (transition: WorkspaceLeafTransition) => Promise<boolean> | boolean
  onCommitted?: (transition: WorkspaceLeafTransition) => void
  storage?: Pick<Storage, 'getItem' | 'setItem'> | null
}
function browserStorage(): Options['storage'] { try { return typeof window === 'undefined' ? null : window.localStorage } catch { return null } }
function restore(vaultId: string | null, storage: Options['storage'], available: Options['available']) {
  try { return vaultId ? parseWorkspaceLayout(storage?.getItem(workspaceLayoutStorageKey(vaultId)) ?? null, available) : emptyWorkspaceLayout() } catch { return emptyWorkspaceLayout() }
}

/** Restoring references is inert; only explicit user transitions call the owner guard. */
export function useWorkspaceLeaves({vaultId, available, approve, onCommitted, storage = browserStorage()}: Options) {
  const [snapshot, setSnapshot] = useState(() => ({vaultId, state: restore(vaultId, storage, available)}))
  const [feedback, setFeedback] = useState<{vaultId: string | null; status: WorkspaceLeafStatus; reason?: WorkspaceLeafReason}>({vaultId, status:'idle'})
  if (snapshot.vaultId !== vaultId) setSnapshot({vaultId, state: restore(vaultId, storage, available)})
  if (feedback.vaultId !== vaultId) setFeedback({vaultId, status:'idle'})
  const owner = useRef(snapshot)
  const generation = useRef(0)
  useLayoutEffect(() => () => { generation.current++ }, [])
  const callbacks = useRef({available, approve, onCommitted, storage})
  useLayoutEffect(() => { if (owner.current.vaultId !== snapshot.vaultId) generation.current++; owner.current = snapshot; callbacks.current = {available, approve, onCommitted, storage} }, [snapshot, available, approve, onCommitted, storage])
  const state = snapshot.vaultId === vaultId ? snapshot.state : emptyWorkspaceLayout()
  const queue = useRef<Promise<unknown>>(Promise.resolve())
  const transition = useCallback((action: WorkspaceLeafTransition['action'], reduce: (previous: WorkspaceLayout) => WorkspaceLayout, targetId?: string): Promise<boolean> => {
    const requestedVault = owner.current.vaultId
    const requestedGeneration = generation.current
    const report = (status: WorkspaceLeafStatus, reason?: WorkspaceLeafReason) => {
      if (owner.current.vaultId === requestedVault && generation.current === requestedGeneration) setFeedback({vaultId:requestedVault,status,reason})
    }
    report('pending')
    const operation = async () => {
      const owning = owner.current
      if (!owning.vaultId || owning.vaultId !== requestedVault || generation.current !== requestedGeneration) { report('refused','changed'); return false }
      report('pending')
      const previous = owning.state
      const reduced = reduce(previous)
      const request = prepareWorkspaceLeafTransition(action,previous,reduced,callbacks.current.available,targetId)
      const next = request.next
      const refusal = workspaceLeafTransitionRefusal(request,reduced)
      if (refusal) { report('refused',refusal); return false }
      let approved: boolean
      try { approved = await callbacks.current.approve(request) } catch { report('refused','guard'); return false }
      if (!approved) { report('refused','guard'); return false }
      if (owner.current !== owning || generation.current !== requestedGeneration) { report('refused','changed'); return false }
      if (!next.leaves.every(leaf => callbacks.current.available(leaf.reference))) { report('refused','unavailable'); return false }
      const updated = {vaultId: owning.vaultId, state: next}
      owner.current = updated
      setSnapshot(updated)
      try { callbacks.current.storage?.setItem(workspaceLayoutStorageKey(owning.vaultId), serializeWorkspaceLayout(next)) } catch { /* A quota error does not discard the current workspace. */ }
      try { callbacks.current.onCommitted?.(request) } catch (error) { console.error('Workspace transition committed, but its completion callback failed',error) }
      report('idle')
      return true
    }
    const result = queue.current.then(operation, operation)
    queue.current = result
    return result
  }, [])
  return {
    state, status: feedback.vaultId === vaultId ? feedback.status : 'idle' as WorkspaceLeafStatus, reason: feedback.vaultId === vaultId ? feedback.reason : undefined, activeLeaf: getWorkspaceActiveLeaf(state), leafForGroup: (group: WorkspaceLeafGroup) => getWorkspaceActiveLeaf(state, group),
    open: (reference: WorkspaceLeafReference, group: WorkspaceLeafGroup = 'primary') => transition('open', previous => openWorkspaceLeaf(previous, reference, group)),
    select: (id: string) => transition('select', previous => selectWorkspaceLeaf(previous, id)),
    close: (id: string) => transition('close', previous => closeWorkspaceLeaf(previous, id), id),
    move: (id: string, group: WorkspaceLeafGroup) => transition('move', previous => moveWorkspaceLeaf(previous, id, group), id),
    reorder: (id: string, direction: -1 | 1) => transition('reorder', previous => reorderWorkspaceLeaf(previous, id, direction), id),
  }
}
