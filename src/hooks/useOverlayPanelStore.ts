/**
 * useOverlayPanelStore
 *
 * Single source of truth for all boolean panel-open flags that were previously
 * scattered across `useAppOverlayState`. Each flag is a discrete panel or
 * floating UI element. Rename dialogs and conflict state live in their own
 * stores (useRenameDialogStore, useConflictStore).
 *
 * Design notes:
 * - All state is ephemeral (not persisted) — panels re-close on refresh.
 * - `togglePanel` enables keyboard shortcut implementations that don't need
 *   to know current state.
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
>

type BooleanPanelUpdater = boolean | ((current: boolean) => boolean)

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
  }
}

export function useOverlayPanelStore(initialStickiesVisible = true) {
  const [state, setState] = useState<OverlayPanelState>(() =>
    makeInitialState(initialStickiesVisible),
  )

  /** Open a specific boolean panel. */
  const openPanel = useCallback((key: OverlayPanelKey) => {
    setState((prev) => (prev[key] === true ? prev : { ...prev, [key]: true }))
  }, [])

  /** Close a specific boolean panel. */
  const closePanel = useCallback((key: OverlayPanelKey) => {
    setState((prev) => (prev[key] === false ? prev : { ...prev, [key]: false }))
  }, [])

  /** Toggle a specific boolean panel. */
  const togglePanel = useCallback((key: OverlayPanelKey) => {
    setState((prev) => ({ ...prev, [key]: !prev[key] }))
  }, [])

  /** Set a panel to an explicit boolean. Prefer openPanel/closePanel for clarity. */
  const setPanel = useCallback((key: OverlayPanelKey, value: BooleanPanelUpdater) => {
    setState((prev) => {
      const nextValue = typeof value === 'function' ? value(prev[key]) : value
      return prev[key] === nextValue ? prev : { ...prev, [key]: nextValue }
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
