import { useCallback, useState } from 'react'

import type { EditorFontFamilyId } from '../brand/support'

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
}

const STORAGE_KEY = 'scriptor:workspace-chrome'

function readChrome(): WorkspaceChromePrefs {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULT_WORKSPACE_CHROME }
    const parsed = JSON.parse(raw) as Partial<WorkspaceChromePrefs>
    return { ...DEFAULT_WORKSPACE_CHROME, ...parsed }
  } catch {
    return { ...DEFAULT_WORKSPACE_CHROME }
  }
}

export function useWorkspaceChrome() {
  const [chrome, setChrome] = useState<WorkspaceChromePrefs>(() => readChrome())

  const patchChrome = useCallback((patch: Partial<WorkspaceChromePrefs>) => {
    setChrome((current) => {
      const next = { ...current, ...patch }
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      } catch {
        // ignore storage failures
      }
      return next
    })
  }, [])

  const resetChrome = useCallback(() => {
    setChrome(DEFAULT_WORKSPACE_CHROME)
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_WORKSPACE_CHROME))
    } catch {
      // ignore
    }
  }, [])

  return { chrome, patchChrome, resetChrome }
}
