/**
 * useOverlayPanelStore
 *
 * Single source of truth for all boolean panel-open flags that were previously
 * scattered across the app shell. Each flag is a discrete panel or
 * floating UI element. Rename dialogs and conflict state live in their own
 * stores (useRenameDialogStore, useConflictStore).
 *
 * Design notes:
 * - All state is ephemeral (not persisted) — panels re-close on refresh.
 * - `togglePanel` enables keyboard shortcut implementations that don't need
 *   to know current state.
 * - Companion panels that can occupy the right dock are mutually exclusive;
 *   opening one closes the previous companion instead of stacking two sheets
 *   at the same physical edge.
 * - `closeAll` is useful for "distraction-free" mode transitions.
 */
import { useCallback, useState } from 'react'

import type { KnowledgeWorkbenchTab } from '../components/KnowledgeWorkbench'
import type { StatusDockTab } from '../components/StatusDockPanel'

export interface OverlayPanelState {
  /** Inspector / Preview / Plugins rail mode */
  activeMode: 'inspector' | 'preview' | 'plugins'
  graphOpen: boolean
  canvasOpen: boolean
  kanbanOpen: boolean
  gitPanelOpen: boolean
  healthDashboardOpen: boolean
  statusDockTab: StatusDockTab
  mcpPanelOpen: boolean
  settingsOpen: boolean
  knowledgeWorkbenchOpen: boolean
  knowledgeWorkbenchTab: KnowledgeWorkbenchTab
  publishCenterOpen: boolean
  snippetsOpen: boolean
  cheatsheetOpen: boolean
  supportOpen: boolean
  portalOpen: boolean
  noteHistoryOpen: boolean
  quickCaptureOpen: boolean
  stickiesVisible: boolean
  bibliographyOpen: boolean
  tocOpen: boolean
  writingTargetsOpen: boolean
  frontmatterOpen: boolean
  readerOpen: boolean
  tasksOpen: boolean
  templatePickerOpen: boolean
  obsidianImportOpen: boolean
  gmailManagerOpen: boolean
}

export type OverlayPanelKey = keyof Pick<
  OverlayPanelState,
  | 'graphOpen'
  | 'canvasOpen'
  | 'kanbanOpen'
  | 'gitPanelOpen'
  | 'healthDashboardOpen'
  | 'mcpPanelOpen'
  | 'settingsOpen'
  | 'knowledgeWorkbenchOpen'
  | 'publishCenterOpen'
  | 'snippetsOpen'
  | 'cheatsheetOpen'
  | 'supportOpen'
  | 'portalOpen'
  | 'noteHistoryOpen'
  | 'quickCaptureOpen'
  | 'stickiesVisible'
  | 'bibliographyOpen'
  | 'tocOpen'
  | 'writingTargetsOpen'
  | 'frontmatterOpen'
  | 'readerOpen'
  | 'tasksOpen'
  | 'templatePickerOpen'
  | 'obsidianImportOpen'
  | 'gmailManagerOpen'
>

type BooleanPanelUpdater = boolean | ((current: boolean) => boolean)

const COMPANION_PANEL_KEYS = new Set<OverlayPanelKey>([
  'gitPanelOpen',
  'mcpPanelOpen',
  'portalOpen',
  'quickCaptureOpen',
  'readerOpen',
])

function applyPanelValue(
  previous: OverlayPanelState,
  key: OverlayPanelKey,
  nextValue: boolean,
): OverlayPanelState {
  if (!nextValue || !COMPANION_PANEL_KEYS.has(key)) {
    return previous[key] === nextValue ? previous : { ...previous, [key]: nextValue }
  }

  return {
    ...previous,
    gitPanelOpen: key === 'gitPanelOpen',
    mcpPanelOpen: key === 'mcpPanelOpen',
    portalOpen: key === 'portalOpen',
    quickCaptureOpen: key === 'quickCaptureOpen',
    readerOpen: key === 'readerOpen',
  }
}

function makeInitialState(initialStickiesVisible: boolean): OverlayPanelState {
  return {
    activeMode: 'inspector',
    graphOpen: false,
    canvasOpen: false,
    kanbanOpen: false,
    gitPanelOpen: false,
    healthDashboardOpen: false,
    statusDockTab: 'output',
    mcpPanelOpen: false,
    settingsOpen: false,
    knowledgeWorkbenchOpen: false,
    knowledgeWorkbenchTab: 'repair',
    publishCenterOpen: false,
    snippetsOpen: false,
    cheatsheetOpen: false,
    supportOpen: false,
    portalOpen: false,
    noteHistoryOpen: false,
    quickCaptureOpen: false,
    stickiesVisible: initialStickiesVisible,
    bibliographyOpen: false,
    tocOpen: false,
    writingTargetsOpen: false,
    frontmatterOpen: false,
    readerOpen: false,
    tasksOpen: false,
    templatePickerOpen: false,
    obsidianImportOpen: false,
    gmailManagerOpen: false,
  }
}

export function useOverlayPanelStore(initialStickiesVisible = true) {
  const [state, setState] = useState<OverlayPanelState>(() =>
    makeInitialState(initialStickiesVisible),
  )

  /** Open a specific boolean panel. */
  const openPanel = useCallback((key: OverlayPanelKey) => {
    setState((prev) => applyPanelValue(prev, key, true))
  }, [])

  /** Close a specific boolean panel. */
  const closePanel = useCallback((key: OverlayPanelKey) => {
    setState((prev) => applyPanelValue(prev, key, false))
  }, [])

  /** Toggle a specific boolean panel. */
  const togglePanel = useCallback((key: OverlayPanelKey) => {
    setState((prev) => applyPanelValue(prev, key, !prev[key]))
  }, [])

  /** Set a panel to an explicit boolean. Prefer openPanel/closePanel for clarity. */
  const setPanel = useCallback((key: OverlayPanelKey, value: BooleanPanelUpdater) => {
    setState((prev) => {
      const nextValue = typeof value === 'function' ? value(prev[key]) : value
      return applyPanelValue(prev, key, nextValue)
    })
  }, [])

  const setActiveMode = useCallback(
    (mode: OverlayPanelState['activeMode']) => {
      setState((prev) => (prev.activeMode === mode ? prev : { ...prev, activeMode: mode }))
    },
    [],
  )

  const setStatusDockTab = useCallback((tab: StatusDockTab) => {
    setState((prev) => (prev.statusDockTab === tab ? prev : { ...prev, statusDockTab: tab }))
  }, [])

  const setKnowledgeWorkbenchTab = useCallback((tab: KnowledgeWorkbenchTab) => {
    setState((prev) =>
      prev.knowledgeWorkbenchTab === tab ? prev : { ...prev, knowledgeWorkbenchTab: tab },
    )
  }, [])

  /** Close all panels. Useful for distraction-free mode. */
  const closeAllPanels = useCallback(() => {
    setState((prev) => ({
      ...prev,
      graphOpen: false,
      canvasOpen: false,
      kanbanOpen: false,
      gitPanelOpen: false,
      healthDashboardOpen: false,
      mcpPanelOpen: false,
      settingsOpen: false,
      knowledgeWorkbenchOpen: false,
      publishCenterOpen: false,
      snippetsOpen: false,
      cheatsheetOpen: false,
      supportOpen: false,
      portalOpen: false,
      noteHistoryOpen: false,
      quickCaptureOpen: false,
      bibliographyOpen: false,
      tocOpen: false,
      writingTargetsOpen: false,
      frontmatterOpen: false,
      readerOpen: false,
      tasksOpen: false,
      templatePickerOpen: false,
      obsidianImportOpen: false,
    }))
  }, [])

  return {
    ...state,
    openPanel,
    closePanel,
    togglePanel,
    setPanel,
    setActiveMode,
    setStatusDockTab,
    setKnowledgeWorkbenchTab,
    closeAllPanels,
  }
}