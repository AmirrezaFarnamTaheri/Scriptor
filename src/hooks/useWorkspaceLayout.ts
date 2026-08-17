import { useCallback, useState } from 'react'

import type { WorkspaceMode } from './useWorkspaceMode'
import { expectRecord } from '../lib/runtimeSchema'
import { readVersionedStorage, writeVersionedStorage } from '../lib/versionedStorage'

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

function validateLayouts(value: unknown): Record<WorkspaceMode, WorkspaceLayout> {
  const parsed = expectRecord(value, 'workspace layouts')
  return (Object.keys(DEFAULT_WORKSPACE_LAYOUTS) as WorkspaceMode[]).reduce(
    (accumulator, mode) => {
      const candidate = typeof parsed[mode] === 'object' && parsed[mode] !== null ? parsed[mode] : {}
      accumulator[mode] = { ...DEFAULT_WORKSPACE_LAYOUTS[mode], ...(candidate as Partial<WorkspaceLayout>) }
      return accumulator
    },
    {} as Record<WorkspaceMode, WorkspaceLayout>,
  )
}

function readLayouts(): Record<WorkspaceMode, WorkspaceLayout> {
  return readVersionedStorage({
    key: STORAGE_KEY,
    schemaVersion: 1,
    fallback: { ...DEFAULT_WORKSPACE_LAYOUTS },
    validate: validateLayouts,
  })
}

function readStoredWorkspaceMode(): WorkspaceMode {
  try {
    const raw = window.localStorage.getItem('scriptor:workspace-mode')
    if (
      raw === 'writing' ||
      raw === 'knowledge' ||
      raw === 'publish' ||
      raw === 'review' ||
      raw === 'automation'
    ) {
      return raw
    }
  } catch {
    // Storage is optional; the writing layout is the safe fallback.
  }
  return 'writing'
}

export function readInitialWorkspaceLayout(): WorkspaceLayout {
  const layouts = readLayouts()
  return layouts[readStoredWorkspaceMode()]
}

export function useWorkspaceLayout() {
  const [layouts, setLayouts] = useState<Record<WorkspaceMode, WorkspaceLayout>>(() => readLayouts())

  const applyLayout = useCallback((mode: WorkspaceMode, patch: Partial<WorkspaceLayout>) => {
    setLayouts((current) => {
      const next = {
        ...current,
        [mode]: { ...DEFAULT_WORKSPACE_LAYOUTS[mode], ...current[mode], ...patch },
      }
      writeVersionedStorage(STORAGE_KEY, 1, next)
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
