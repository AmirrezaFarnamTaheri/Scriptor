import { useCallback, useLayoutEffect, useRef, useState } from 'react'

import { vaultPublishApplyStarlight, vaultPublishPlanStarlight } from '../bridge/commands'
import { WorkspaceOperationGate } from '../lib/workspaceOperation'
import type { TextPromptRequest } from './useTextPrompt'
import type { PublishPlan } from '../types/vault'

interface UseStarlightPublishingOptions {
  vaultId: string | null
  promptText: (request: TextPromptRequest) => Promise<string | null>
  showToast: (message: string) => void
  openPublishCenter: () => void
}

interface PublishDisplayState {
  owner: string | null
  plan: PublishPlan | null
  outputPath: string | null
}

export function useStarlightPublishing({ vaultId, promptText, showToast, openPublishCenter }: UseStarlightPublishingOptions) {
  const [display, setDisplay] = useState<PublishDisplayState>(() => ({ owner: vaultId, plan: null, outputPath: null }))
  const [publishApplying, setPublishApplying] = useState(false)
  const [gate] = useState(() => new WorkspaceOperationGate(vaultId))
  const mounted = useRef(false)

  // Plans belong to one vault; reset them before children can see a new vault
  // with the previous plan. Applying remains busy until the native work ends.
  if (display.owner !== vaultId) {
    setDisplay({ owner: vaultId, plan: null, outputPath: null })
  }
  const publishPlan = display.owner === vaultId ? display.plan : null
  const publishOutputPath = display.owner === vaultId ? display.outputPath : null

  useLayoutEffect(() => {
    mounted.current = true
    gate.setOwner(vaultId)
    return () => { mounted.current = false; gate.invalidate() }
  }, [gate, vaultId])

  const publishStarlight = useCallback(async (existingOutput?: string) => {
    if (!mounted.current || !gate.hasOwner(vaultId)) return
    if (!vaultId) { showToast('Open a vault before planning a publication.'); return }
    const operation = gate.begin(vaultId)
    if (!operation) {
      if (gate.isPending()) showToast('A publication operation is already running. Wait for it to finish before reviewing another plan.')
      return
    }
    const isCurrent = () => mounted.current && gate.isCurrent(operation)
    try {
      const requestedOutput = existingOutput ?? await promptText({
        title: 'Plan Starlight publish', label: 'Output folder for Starlight site',
        defaultValue: 'scriptor-publish', submitLabel: 'Review plan', helpTopic: 'publish',
      })
      if (!requestedOutput || !isCurrent()) return
      const result = await vaultPublishPlanStarlight(requestedOutput, operation.owner)
      if (!isCurrent()) return
      setDisplay(current => current.owner === operation.owner ? { ...current, plan: result.plan, outputPath: result.output } : current)
      openPublishCenter()
    } catch (error) {
      if (isCurrent()) showToast(error instanceof Error ? error.message : String(error))
    } finally { gate.finish(operation) }
  }, [gate, openPublishCenter, promptText, showToast, vaultId])

  const applyStarlightPlan = useCallback(async (selectedPaths: string[], deleteOrphans: string[]) => {
    if (!mounted.current || !gate.hasOwner(vaultId)) return
    if (!vaultId || !publishPlan || !publishOutputPath) return
    const operation = gate.begin(vaultId)
    if (!operation) {
      if (gate.isPending()) showToast('A publication operation is already running. Wait for it to finish before applying a plan.')
      return
    }
    const isCurrent = () => mounted.current && gate.isCurrent(operation)
    const candidates = [...publishPlan.new_items, ...publishPlan.changed]
    const byPath = new Map(candidates.map(candidate => [candidate.rel_path, candidate]))
    const toWrite = selectedPaths.map(path => byPath.get(path)).filter(candidate => candidate != null)
    if (toWrite.length !== selectedPaths.length) {
      showToast('The publish selection no longer matches the reviewed plan. Replan before applying.')
      gate.finish(operation)
      return
    }
    setPublishApplying(true)
    try {
      const result = await vaultPublishApplyStarlight(publishOutputPath, toWrite, deleteOrphans, operation.owner)
      if (!isCurrent()) return
      // The reviewed plan has been consumed even when a later refresh fails.
      setDisplay(current => current.owner === operation.owner ? { ...current, plan: null } : current)
      showToast(`Published ${result.written.length} note(s); deleted ${result.deleted.length} managed orphan(s).`)
      try {
        const refreshed = await vaultPublishPlanStarlight(publishOutputPath, operation.owner)
        if (isCurrent()) {
          setDisplay(current => current.owner === operation.owner ? { ...current, plan: refreshed.plan, outputPath: refreshed.output } : current)
        }
      } catch (error) {
        if (isCurrent()) showToast(`The site was updated, but its plan could not refresh. Review a new plan before applying again. ${error instanceof Error ? error.message : String(error)}`)
      }
    } catch (error) {
      if (isCurrent()) showToast(error instanceof Error ? error.message : String(error))
    } finally {
      gate.finish(operation)
      if (mounted.current) setPublishApplying(false)
    }
  }, [gate, publishOutputPath, publishPlan, showToast, vaultId])

  return { applyStarlightPlan, publishApplying, publishOutputPath, publishPlan, publishStarlight }
}
