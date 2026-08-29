import { useCallback, useRef, useState } from 'react'

import {
  vaultPublishApplyStarlight,
  vaultPublishPlanStarlight,
} from '../bridge/commands'
import type { TextPromptRequest } from './useTextPrompt'
import type { PublishPlan } from '../types/vault'

interface UseStarlightPublishingOptions {
  promptText: (request: TextPromptRequest) => Promise<string | null>
  showToast: (message: string) => void
  openPublishCenter: () => void
}

export function useStarlightPublishing({
  promptText,
  showToast,
  openPublishCenter,
}: UseStarlightPublishingOptions) {
  const [publishPlan, setPublishPlan] = useState<PublishPlan | null>(null)
  const [publishOutputPath, setPublishOutputPath] = useState<string | null>(null)
  const [publishApplying, setPublishApplying] = useState(false)
  const applyingRef = useRef(false)

  const publishStarlight = useCallback(async (existingOutput?: string) => {
    const requestedOutput = existingOutput ?? await promptText({
      title: 'Plan Starlight publish',
      label: 'Output folder for Starlight site',
      defaultValue: 'scriptor-publish',
      submitLabel: 'Review plan',
    })
    if (!requestedOutput) return
    try {
      const result = await vaultPublishPlanStarlight(requestedOutput)
      setPublishOutputPath(result.output)
      setPublishPlan(result.plan)
      openPublishCenter()
    } catch (error) {
      showToast(error instanceof Error ? error.message : String(error))
    }
  }, [openPublishCenter, promptText, showToast])

  const applyStarlightPlan = useCallback(async (
    selectedPaths: string[],
    deleteOrphans: string[],
  ) => {
    if (!publishPlan || !publishOutputPath || applyingRef.current) return
    applyingRef.current = true
    const candidates = [...publishPlan.new_items, ...publishPlan.changed]
    const byPath = new Map(candidates.map((candidate) => [candidate.rel_path, candidate]))
    const toWrite = selectedPaths
      .map((path) => byPath.get(path))
      .filter((candidate) => candidate != null)
    if (toWrite.length !== selectedPaths.length) {
      showToast('The publish selection no longer matches the reviewed plan. Replan before applying.')
      applyingRef.current = false
      return
    }
    setPublishApplying(true)
    try {
      const result = await vaultPublishApplyStarlight(publishOutputPath, toWrite, deleteOrphans)
      showToast(`Published ${result.written.length} note(s); deleted ${result.deleted.length} managed orphan(s).`)
      const refreshed = await vaultPublishPlanStarlight(publishOutputPath)
      setPublishPlan(refreshed.plan)
      setPublishOutputPath(refreshed.output)
    } catch (error) {
      showToast(error instanceof Error ? error.message : String(error))
    } finally {
      setPublishApplying(false)
      applyingRef.current = false
    }
  }, [publishOutputPath, publishPlan, showToast])

  return {
    applyStarlightPlan,
    publishApplying,
    publishOutputPath,
    publishPlan,
    publishStarlight,
  }
}
