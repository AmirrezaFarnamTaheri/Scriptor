import { useCallback, useState } from 'react'

import type { WorkspaceMode } from './useWorkspaceMode'

export interface WorkspaceLayout {
  splitPreview: boolean
  showStickies: boolean
  graphDepth: number
  distractionFree: boolean
}

export const DEFAULT_WORKSPACE_LAYOUTS: Record<WorkspaceMode, WorkspaceLayout> = {
  writing: { splitPreview: true, showStickies: true, graphDepth: 2, distractionFree: false },
  knowledge: { splitPreview: false, showStickies: false, graphDepth: 3, distractionFree: false },
  publish: { splitPreview: true, showStickies: false, graphDepth: 2, distractionFree: false },
  review: { splitPreview: true, showStickies: false, graphDepth: 2, distractionFree: false },
  automation: { splitPreview: false, showStickies: false, graphDepth: 2, distractionFree: false },
}

const STORAGE_KEY = 'scriptor:workspace-layouts'

function readLayouts(): Record<WorkspaceMode, WorkspaceLayout> {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULT_WORKSPACE_LAYOUTS }
    const parsed = JSON.parse(raw) as Partial<Record<WorkspaceMode, Partial<WorkspaceLayout>>>
    return (Object.keys(DEFAULT_WORKSPACE_LAYOUTS) as WorkspaceMode[]).reduce(
      (accumulator, mode) => {
        accumulator[mode] = { ...DEFAULT_WORKSPACE_LAYOUTS[mode], ...parsed[mode] }
        return accumulator
      },
      {} as Record<WorkspaceMode, WorkspaceLayout>,
    )
  } catch {
    return { ...DEFAULT_WORKSPACE_LAYOUTS }
  }
}

export function useWorkspaceLayout() {
  const [layouts, setLayouts] = useState<Record<WorkspaceMode, WorkspaceLayout>>(() => readLayouts())

  const applyLayout = useCallback((mode: WorkspaceMode, patch: Partial<WorkspaceLayout>) => {
    setLayouts((current) => {
      const next = {
        ...current,
        [mode]: { ...DEFAULT_WORKSPACE_LAYOUTS[mode], ...current[mode], ...patch },
      }
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      } catch {
        // ignore storage failures
      }
      return next
    })
  }, [])

  const resetLayout = useCallback((mode: WorkspaceMode) => {
    applyLayout(mode, DEFAULT_WORKSPACE_LAYOUTS[mode])
  }, [applyLayout])

  const saveCurrentAsLayout = useCallback(
    (mode: WorkspaceMode, snapshot: WorkspaceLayout) => {
      applyLayout(mode, snapshot)
    },
    [applyLayout],
  )

  return { layouts, applyLayout, resetLayout, saveCurrentAsLayout }
}
