import { useCallback, useEffect, useState } from 'react'

import { EDITOR_FONT_FAMILIES, type EditorFontFamilyId } from '../brand/support'
import { expectRecord } from '../lib/runtimeSchema'
import { readVersionedStorage, writeVersionedStorage } from '../lib/versionedStorage'

export type EditorSurfaceMode = 'source' | 'split' | 'rendered'
export type UiFontFamily = 'system' | 'inter' | 'sf-pro' | 'avenir-next' | 'outfit' | 'jetbrains-mono' | 'georgia'
export type UiDensity = 'compact' | 'comfortable' | 'spacious'
export type UiBorderRadius = 'sharp' | 'rounded' | 'curved' | 'pill'
export type GlassBlurIntensity = 'none' | 'subtle' | 'glass' | 'heavy'
export type TopBarGroupId = 'history' | 'modes' | 'command' | 'actions'
export type TopBarGroupWidth = 'compact' | 'auto' | 'wide'

export interface WorkspaceChromePrefs {
  vaultSidebarCollapsed: boolean
  inspectorCollapsed: boolean
  showTopBar: boolean
  showModeStrip: boolean
  showQuickActions: boolean
  /** Top-bar action ids hidden by the user via the customize popover. */
  topBarHiddenActions: string[]
  /** Ordered, user-configurable top-bar groups. */
  topBarGroupOrder: TopBarGroupId[]
  /** Groups the user has removed from the top bar. */
  topBarHiddenGroups: TopBarGroupId[]
  /** Per-group width preference used by the flexible toolbar layout. */
  topBarGroupWidths: Partial<Record<TopBarGroupId, TopBarGroupWidth>>
  /** Lets the action group use one or two rows. */
  topBarActionRows: 1 | 2
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
  // Workspace-mode destinations remain available in the command palette and
  // customizer without competing with the default writing controls.
  topBarHiddenActions: ['workbench', 'publish', 'portal', 'graph', 'canvas', 'paletteStore'],
  topBarGroupOrder: ['history', 'modes', 'command', 'actions'],
  topBarHiddenGroups: [],
  topBarGroupWidths: {},
  topBarActionRows: 1,
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
const LEGACY_VAULT_WIDTH_KEY = 'scriptor:vault-width'
const LEGACY_INSPECTOR_WIDTH_KEY = 'scriptor:inspector-width'

const TOP_BAR_GROUP_IDS = ['history', 'modes', 'command', 'actions'] as const satisfies readonly TopBarGroupId[]
const TOP_BAR_GROUP_WIDTHS = ['compact', 'auto', 'wide'] as const satisfies readonly TopBarGroupWidth[]
const UI_FONT_FAMILIES = ['system', 'inter', 'sf-pro', 'avenir-next', 'outfit', 'jetbrains-mono', 'georgia'] as const satisfies readonly UiFontFamily[]
const UI_DENSITIES = ['compact', 'comfortable', 'spacious'] as const satisfies readonly UiDensity[]
const UI_BORDER_RADII = ['sharp', 'rounded', 'curved', 'pill'] as const satisfies readonly UiBorderRadius[]
const GLASS_BLUR_LEVELS = ['none', 'subtle', 'glass', 'heavy'] as const satisfies readonly GlassBlurIntensity[]
const EDITOR_SURFACE_MODES = ['source', 'split', 'rendered'] as const satisfies readonly EditorSurfaceMode[]
const EDITOR_FONT_IDS = EDITOR_FONT_FAMILIES.map((entry) => entry.id) as readonly EditorFontFamilyId[]

function oneOf<T extends string>(value: unknown, values: readonly T[], fallback: T): T {
  return typeof value === 'string' && values.includes(value as T) ? value as T : fallback
}

function finiteNumber(value: unknown, fallback: number, min: number, max: number): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.min(max, Math.max(min, value))
    : fallback
}

function booleanValue(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback
}

function uniqueStrings(value: unknown, fallback: readonly string[] = []): string[] {
  if (!Array.isArray(value)) return [...fallback]
  return [...new Set(value.filter((entry): entry is string => typeof entry === 'string' && entry.length > 0))]
}

function normalizeHiddenTopBarActions(value: unknown): string[] {
  const hidden = uniqueStrings(value, DEFAULT_WORKSPACE_CHROME.topBarHiddenActions)
  const previousDefault = ['workbench', 'publish', 'portal', 'graph', 'canvas', 'support', 'paletteStore']
  return hidden.length === previousDefault.length && previousDefault.every((id) => hidden.includes(id))
    ? hidden.filter((id) => id !== 'support')
    : hidden
}

function normalizeGroupOrder(value: unknown): TopBarGroupId[] {
  const incoming = uniqueStrings(value).filter((entry): entry is TopBarGroupId =>
    TOP_BAR_GROUP_IDS.includes(entry as TopBarGroupId),
  )
  return [...incoming, ...TOP_BAR_GROUP_IDS.filter((group) => !incoming.includes(group))]
}

function normalizeHiddenGroups(value: unknown): TopBarGroupId[] {
  return uniqueStrings(value).filter((entry): entry is TopBarGroupId =>
    TOP_BAR_GROUP_IDS.includes(entry as TopBarGroupId),
  )
}

function normalizeGroupWidths(value: unknown): WorkspaceChromePrefs['topBarGroupWidths'] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  const record = value as Record<string, unknown>
  const output: WorkspaceChromePrefs['topBarGroupWidths'] = {}
  for (const group of TOP_BAR_GROUP_IDS) {
    const width = record[group]
    if (typeof width === 'string' && TOP_BAR_GROUP_WIDTHS.includes(width as TopBarGroupWidth)) {
      output[group] = width as TopBarGroupWidth
    }
  }
  return output
}

export function validateWorkspaceChrome(value: unknown): WorkspaceChromePrefs {
  const parsed = expectRecord(value, 'workspace chrome')
  const fallback = DEFAULT_WORKSPACE_CHROME
  return {
    vaultSidebarCollapsed: booleanValue(parsed.vaultSidebarCollapsed, fallback.vaultSidebarCollapsed),
    inspectorCollapsed: booleanValue(parsed.inspectorCollapsed, fallback.inspectorCollapsed),
    showTopBar: booleanValue(parsed.showTopBar, fallback.showTopBar),
    showModeStrip: booleanValue(parsed.showModeStrip, fallback.showModeStrip),
    showQuickActions: booleanValue(parsed.showQuickActions, fallback.showQuickActions),
    topBarHiddenActions: normalizeHiddenTopBarActions(parsed.topBarHiddenActions),
    topBarGroupOrder: normalizeGroupOrder(parsed.topBarGroupOrder),
    topBarHiddenGroups: normalizeHiddenGroups(parsed.topBarHiddenGroups),
    topBarGroupWidths: normalizeGroupWidths(parsed.topBarGroupWidths),
    topBarActionRows: parsed.topBarActionRows === 2 ? 2 : 1,
    showHistoryControls: booleanValue(parsed.showHistoryControls, fallback.showHistoryControls),
    showFormatToolbar: booleanValue(parsed.showFormatToolbar, fallback.showFormatToolbar),
    showEditorAssist: booleanValue(parsed.showEditorAssist, fallback.showEditorAssist),
    showEditorStatus: booleanValue(parsed.showEditorStatus, fallback.showEditorStatus),
    showInspectorHealth: booleanValue(parsed.showInspectorHealth, fallback.showInspectorHealth),
    showWorkspaceFooter: booleanValue(parsed.showWorkspaceFooter, fallback.showWorkspaceFooter),
    showStatusBar: booleanValue(parsed.showStatusBar, fallback.showStatusBar),
    showLineNumbers: booleanValue(parsed.showLineNumbers, fallback.showLineNumbers),
    editorFontSize: finiteNumber(parsed.editorFontSize, fallback.editorFontSize, 11, 24),
    editorFontFamily: oneOf(parsed.editorFontFamily, EDITOR_FONT_IDS, fallback.editorFontFamily),
    editorLineHeight: finiteNumber(parsed.editorLineHeight, fallback.editorLineHeight, 1.1, 2.4),
    editorPaddingPx: finiteNumber(parsed.editorPaddingPx, fallback.editorPaddingPx, 4, 48),
    previewMaxWidthCh: finiteNumber(parsed.previewMaxWidthCh, fallback.previewMaxWidthCh, 40, 120),
    editorSurfaceMode: oneOf(parsed.editorSurfaceMode, EDITOR_SURFACE_MODES, fallback.editorSurfaceMode),
    vaultWidth: finiteNumber(parsed.vaultWidth, fallback.vaultWidth, 200, 600),
    inspectorWidth: finiteNumber(parsed.inspectorWidth, fallback.inspectorWidth, 300, 800),
    layoutLocked: booleanValue(parsed.layoutLocked, fallback.layoutLocked),
    uiFontFamily: oneOf(parsed.uiFontFamily, UI_FONT_FAMILIES, fallback.uiFontFamily),
    uiDensity: oneOf(parsed.uiDensity, UI_DENSITIES, fallback.uiDensity),
    uiBorderRadius: oneOf(parsed.uiBorderRadius, UI_BORDER_RADII, fallback.uiBorderRadius),
    glassBlur: oneOf(parsed.glassBlur, GLASS_BLUR_LEVELS, fallback.glassBlur),
  }
}

function readLegacyPanelWidth(key: string, min: number, max: number): number | null {
  try {
    const raw = window.localStorage.getItem(key)
    if (raw === null) return null
    const parsed = Number(raw)
    return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : null
  } catch {
    return null
  }
}

function readChrome(): WorkspaceChromePrefs {
  const chrome = readVersionedStorage({
    key: STORAGE_KEY,
    schemaVersion: 1,
    fallback: { ...DEFAULT_WORKSPACE_CHROME },
    validate: validateWorkspaceChrome,
  })

  // Older releases persisted live panel widths under separate keys while the
  // versioned chrome object kept stale defaults. Import those values once, then
  // remove the duplicate owners so reset/import/export all operate on one state.
  const legacyVaultWidth = readLegacyPanelWidth(LEGACY_VAULT_WIDTH_KEY, 200, 600)
  const legacyInspectorWidth = readLegacyPanelWidth(LEGACY_INSPECTOR_WIDTH_KEY, 300, 800)
  return {
    ...chrome,
    ...(legacyVaultWidth === null ? {} : { vaultWidth: legacyVaultWidth }),
    ...(legacyInspectorWidth === null ? {} : { inspectorWidth: legacyInspectorWidth }),
  }
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
    glass: 'blur(16px) saturate(1.6)',
    heavy: 'blur(28px) saturate(2.0)',
  }
  root.style.setProperty('--glass-blur', blurMap[chrome.glassBlur] || blurMap.glass)
}

export function useWorkspaceChrome() {
  const [chrome, setChrome] = useState<WorkspaceChromePrefs>(() => readChrome())

  useEffect(() => {
    applyVisualPrefsToElement(chrome)
    writeVersionedStorage(STORAGE_KEY, 1, chrome)
    // Keep state initialization pure: React StrictMode may invoke initializers
    // more than once. Retire duplicate legacy owners only after the canonical
    // chrome object has been committed.
    try {
      window.localStorage.removeItem(LEGACY_VAULT_WIDTH_KEY)
      window.localStorage.removeItem(LEGACY_INSPECTOR_WIDTH_KEY)
    } catch {
      // Storage can be unavailable; validated runtime state remains authoritative.
    }
  }, [chrome])

  const patchChrome = useCallback((patch: Partial<WorkspaceChromePrefs>) => {
    setChrome((current) => validateWorkspaceChrome({ ...current, ...patch }))
  }, [])

  const resetChrome = useCallback(() => {
    setChrome({ ...DEFAULT_WORKSPACE_CHROME })
  }, [])

  return { chrome, patchChrome, resetChrome }
}
