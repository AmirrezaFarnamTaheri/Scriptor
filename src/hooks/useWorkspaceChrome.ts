import { useCallback, useEffect, useState } from 'react'

import type { EditorFontFamilyId } from '../brand/support'
import { expectRecord } from '../lib/runtimeSchema'
import { readVersionedStorage, writeVersionedStorage } from '../lib/versionedStorage'

export type EditorSurfaceMode = 'source' | 'split' | 'rendered'
export type UiFontFamily = 'system' | 'inter' | 'sf-pro' | 'avenir-next' | 'outfit' | 'jetbrains-mono' | 'georgia'
export type UiDensity = 'compact' | 'comfortable' | 'spacious'
export type UiBorderRadius = 'sharp' | 'rounded' | 'curved' | 'pill'
export type GlassBlurIntensity = 'none' | 'subtle' | 'glass' | 'heavy'

export interface WorkspaceChromePrefs {
  vaultSidebarCollapsed: boolean
  inspectorCollapsed: boolean
  showTopBar: boolean
  showModeStrip: boolean
  showQuickActions: boolean
  /** Top-bar action ids hidden by the user via the customize popover. */
  topBarHiddenActions: string[]
  showHistoryControls: boolean
  showFormatToolbar: boolean
  showEditorAssist: boolean
  showEditorStatus: boolean
  showInspectorHealth: boolean
  showWorkspaceFooter: boolean
  showStatusBar: boolean
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
  uiFontFamily: UiFontFamily
  uiDensity: UiDensity
  uiBorderRadius: UiBorderRadius
  glassBlur: GlassBlurIntensity
}

export const DEFAULT_WORKSPACE_CHROME: WorkspaceChromePrefs = {
  vaultSidebarCollapsed: false,
  inspectorCollapsed: false,
  showTopBar: true,
  showModeStrip: true,
  showQuickActions: true,
  topBarHiddenActions: [],
  showHistoryControls: true,
  showFormatToolbar: true,
  showEditorAssist: true,
  showEditorStatus: true,
  showInspectorHealth: true,
  showWorkspaceFooter: true,
  showStatusBar: true,
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
  uiFontFamily: 'system',
  uiDensity: 'comfortable',
  uiBorderRadius: 'rounded',
  glassBlur: 'glass',
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
  })
}

function applyVisualPrefsToElement(chrome: WorkspaceChromePrefs) {
  const root = document.documentElement

  // 1. Font Family
  const fontMap: Record<UiFontFamily, string> = {
    system: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    inter: '"Inter", system-ui, sans-serif',
    'sf-pro': '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif',
    'avenir-next': '"Avenir Next", "Avenir", sans-serif',
    outfit: '"Outfit", system-ui, sans-serif',
    'jetbrains-mono': '"JetBrains Mono", monospace',
    georgia: 'Georgia, "Times New Roman", serif',
  }
  root.style.setProperty('--font-sans', fontMap[chrome.uiFontFamily] || fontMap.system)

  // 2. Border Radius
  const radiusMap: Record<UiBorderRadius, { sm: string; md: string; lg: string; xl: string }> = {
    sharp: { sm: '0px', md: '0px', lg: '0px', xl: '0px' },
    rounded: { sm: '6px', md: '10px', lg: '14px', xl: '18px' },
    curved: { sm: '12px', md: '18px', lg: '24px', xl: '32px' },
    pill: { sm: '999px', md: '999px', lg: '999px', xl: '999px' },
  }
  const rad = radiusMap[chrome.uiBorderRadius] || radiusMap.rounded
  root.style.setProperty('--radius-sm', rad.sm)
  root.style.setProperty('--radius-md', rad.md)
  root.style.setProperty('--radius-lg', rad.lg)
  root.style.setProperty('--radius-xl', rad.xl)

  // 3. Glass Blur
  const blurMap: Record<GlassBlurIntensity, string> = {
    none: 'none',
    subtle: 'blur(12px) saturate(1.2)',
    glass: 'blur(24px) saturate(1.6)',
    heavy: 'blur(40px) saturate(2.0)',
  }
  root.style.setProperty('--glass-blur', blurMap[chrome.glassBlur] || blurMap.glass)
}

export function useWorkspaceChrome() {
  const [chrome, setChrome] = useState<WorkspaceChromePrefs>(() => readChrome())

  useEffect(() => {
    applyVisualPrefsToElement(chrome)
  }, [chrome])

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
