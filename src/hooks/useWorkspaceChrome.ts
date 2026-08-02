import { useCallback, useState } from 'react'

import type { EditorFontFamilyId } from '../brand/support'
import { expectRecord } from '../lib/runtimeSchema'
import { readVersionedStorage, writeVersionedStorage } from '../lib/versionedStorage'

export type EditorSurfaceMode = 'source' | 'split' | 'rendered'

export interface WorkspaceChromePrefs {
  vaultSidebarCollapsed: boolean
  inspectorCollapsed: boolean
  showFormatToolbar: boolean
  showEditorAssist: boolean
  showEditorStatus: boolean
  showInspectorHealth: boolean
  showWorkspaceFooter: boolean
  showLineNumbers: boolean
  editorFontSize: number
  editorFontFamily: EditorFontFamilyId
  editorLineHeight: number
  editorPaddingPx: number
  previewMaxWidthCh: number
  editorSurfaceMode: EditorSurfaceMode
  vaultWidth: number
  inspectorWidth: number
  layoutLocked: boolean
}

export const DEFAULT_WORKSPACE_CHROME: WorkspaceChromePrefs = {
  vaultSidebarCollapsed: false,
  inspectorCollapsed: false,
  showFormatToolbar: true,
  showEditorAssist: true,
  showEditorStatus: true,
  showInspectorHealth: true,
  showWorkspaceFooter: true,
  showLineNumbers: true,
  editorFontSize: 14,
  editorFontFamily: 'jetbrains-mono',
  editorLineHeight: 1.55,
  editorPaddingPx: 12,
  previewMaxWidthCh: 72,
  editorSurfaceMode: 'source',
  vaultWidth: 318,
  inspectorWidth: 408,
  layoutLocked: false,
}

const STORAGE_KEY = 'scriptor:workspace-chrome'

function validateChrome(value: unknown): WorkspaceChromePrefs {
  return { ...DEFAULT_WORKSPACE_CHROME, ...expectRecord(value, 'workspace chrome') } as WorkspaceChromePrefs
}

function readChrome(): WorkspaceChromePrefs {
  return readVersionedStorage({
    key: STORAGE_KEY,
    schemaVersion: 1,
    fallback: { ...DEFAULT_WORKSPACE_CHROME },
    validate: validateChrome,
    migrate: validateChrome,
  })
}

export function useWorkspaceChrome() {
  const [chrome, setChrome] = useState<WorkspaceChromePrefs>(() => readChrome())

  const patchChrome = useCallback((patch: Partial<WorkspaceChromePrefs>) => {
    setChrome((current) => {
      const next = { ...current, ...patch }
      writeVersionedStorage(STORAGE_KEY, 1, next)
      return next
    })
  }, [])

  const resetChrome = useCallback(() => {
    setChrome(DEFAULT_WORKSPACE_CHROME)
    writeVersionedStorage(STORAGE_KEY, 1, DEFAULT_WORKSPACE_CHROME)
  }, [])

  return { chrome, patchChrome, resetChrome }
}
