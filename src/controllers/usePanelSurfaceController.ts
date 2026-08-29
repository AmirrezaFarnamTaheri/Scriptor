import { useCallback } from 'react'
import { useOverlayPanelStore } from '../hooks/useOverlayPanelStore'
import { useRenameDialogStore } from '../hooks/useRenameDialogStore'
import { useConflictStore } from '../hooks/useConflictStore'

export interface PanelSurfaceControllerOptions {
  showStickiesInitial?: boolean
}

export function usePanelSurfaceController(options: PanelSurfaceControllerOptions = {}) {
  const overlayPanels = useOverlayPanelStore(options.showStickiesInitial)
  const renameDialogs = useRenameDialogStore()
  const conflictStore = useConflictStore()

  const {
    activeMode,
    bibliographyOpen,
    canvasOpen,
    cheatsheetOpen,
    frontmatterOpen,
    gitPanelOpen,
    graphOpen,
    healthDashboardOpen,
    kanbanOpen,
    knowledgeWorkbenchOpen,
    knowledgeWorkbenchTab,
    mcpPanelOpen,
    noteHistoryOpen,
    portalOpen,
    publishCenterOpen,
    quickCaptureOpen,
    readerOpen,
    settingsOpen,
    snippetsOpen,
    statusDockTab,
    stickiesVisible,
    supportOpen,
    tasksOpen,
    templatePickerOpen,
    obsidianImportOpen,
    tocOpen,
    writingTargetsOpen,
    setActiveMode,
    setKnowledgeWorkbenchTab,
    setPanel,
    setStatusDockTab,
  } = overlayPanels

  const setBibliographyOpen = useCallback((v: boolean) => setPanel('bibliographyOpen', v), [setPanel])
  const setCanvasOpen = useCallback((v: boolean) => setPanel('canvasOpen', v), [setPanel])
  const setCheatsheetOpen = useCallback((v: boolean) => setPanel('cheatsheetOpen', v), [setPanel])
  const setFrontmatterOpen = useCallback((v: boolean) => setPanel('frontmatterOpen', v), [setPanel])
  const setGitPanelOpen = useCallback((v: boolean) => setPanel('gitPanelOpen', v), [setPanel])
  const setGraphOpen = useCallback((v: boolean) => setPanel('graphOpen', v), [setPanel])
  const setHealthDashboardOpen = useCallback((v: boolean) => setPanel('healthDashboardOpen', v), [setPanel])
  const setKanbanOpen = useCallback((v: boolean) => setPanel('kanbanOpen', v), [setPanel])
  const setKnowledgeWorkbenchOpen = useCallback((v: boolean) => setPanel('knowledgeWorkbenchOpen', v), [setPanel])
  const setMcpPanelOpen = useCallback((v: boolean) => setPanel('mcpPanelOpen', v), [setPanel])
  const setNoteHistoryOpen = useCallback((v: boolean) => setPanel('noteHistoryOpen', v), [setPanel])
  const setPortalOpen = useCallback((v: boolean) => setPanel('portalOpen', v), [setPanel])
  const setPublishCenterOpen = useCallback((v: boolean) => setPanel('publishCenterOpen', v), [setPanel])
  const setQuickCaptureOpen = useCallback((v: boolean) => setPanel('quickCaptureOpen', v), [setPanel])
  const setReaderOpen = useCallback((v: boolean) => setPanel('readerOpen', v), [setPanel])
  const setSettingsOpen = useCallback((v: boolean) => setPanel('settingsOpen', v), [setPanel])
  const setSnippetsOpen = useCallback((v: boolean) => setPanel('snippetsOpen', v), [setPanel])
  const setStickiesVisible = useCallback((v: boolean) => setPanel('stickiesVisible', v), [setPanel])
  const setSupportOpen = useCallback((v: boolean) => setPanel('supportOpen', v), [setPanel])
  const setTasksOpen = useCallback((v: boolean) => setPanel('tasksOpen', v), [setPanel])
  const setTemplatePickerOpen = useCallback((v: boolean) => setPanel('templatePickerOpen', v), [setPanel])
  const setObsidianImportOpen = useCallback((v: boolean) => setPanel('obsidianImportOpen', v), [setPanel])
  const setTocOpen = useCallback((v: boolean | ((open: boolean) => boolean)) => setPanel('tocOpen', v), [setPanel])
  const setWritingTargetsOpen = useCallback((v: boolean) => setPanel('writingTargetsOpen', v), [setPanel])

  const renameOpen = renameDialogs.noteRenameOpen
  const renameTargetPath = renameDialogs.noteRenamePath
  const tagRenameTag = renameDialogs.tagRenameTag
  const sectionRenameTarget = renameDialogs.sectionRenameTarget
  const blockRenameTarget = renameDialogs.blockRenameTarget
  const setRenameOpen = useCallback(
    (v: boolean) => {
      if (!v) renameDialogs.closeNoteRename()
    },
    [renameDialogs],
  )
  const setRenameTargetPath = useCallback(
    (path: string | null) => {
      if (path) renameDialogs.openNoteRename(path)
      else renameDialogs.closeNoteRename()
    },
    [renameDialogs],
  )
  const setTagRenameTag = useCallback(
    (tag: string | null) => {
      if (tag) renameDialogs.openTagRename(tag)
      else renameDialogs.closeTagRename()
    },
    [renameDialogs],
  )
  const setSectionRenameTarget = useCallback(
    (target: { path: string; label: string } | null) => {
      if (target) renameDialogs.openSectionRename(target)
      else renameDialogs.closeSectionRename()
    },
    [renameDialogs],
  )
  const setBlockRenameTarget = useCallback(
    (target: { path: string; label: string } | null) => {
      if (target) renameDialogs.openBlockRename(target)
      else renameDialogs.closeBlockRename()
    },
    [renameDialogs],
  )

  const conflictPath = conflictStore.conflictPath
  const setConflictPath = useCallback(
    (path: string | null) => {
      if (path === null) conflictStore.closeConflict()
      else conflictStore.openConflict({ path, source: conflictStore.conflictSource })
    },
    [conflictStore],
  )

  return {
    activeMode,
    bibliographyOpen,
    canvasOpen,
    cheatsheetOpen,
    frontmatterOpen,
    gitPanelOpen,
    graphOpen,
    healthDashboardOpen,
    kanbanOpen,
    knowledgeWorkbenchOpen,
    knowledgeWorkbenchTab,
    mcpPanelOpen,
    noteHistoryOpen,
    portalOpen,
    publishCenterOpen,
    quickCaptureOpen,
    readerOpen,
    settingsOpen,
    snippetsOpen,
    statusDockTab,
    stickiesVisible,
    supportOpen,
    tasksOpen,
    templatePickerOpen,
    obsidianImportOpen,
    tocOpen,
    writingTargetsOpen,
    setActiveMode,
    setKnowledgeWorkbenchTab,
    setPanel,
    setStatusDockTab,
    setBibliographyOpen,
    setCanvasOpen,
    setCheatsheetOpen,
    setFrontmatterOpen,
    setGitPanelOpen,
    setGraphOpen,
    setHealthDashboardOpen,
    setKanbanOpen,
    setKnowledgeWorkbenchOpen,
    setMcpPanelOpen,
    setNoteHistoryOpen,
    setPortalOpen,
    setPublishCenterOpen,
    setQuickCaptureOpen,
    setReaderOpen,
    setSettingsOpen,
    setSnippetsOpen,
    setStickiesVisible,
    setSupportOpen,
    setTasksOpen,
    setTemplatePickerOpen,
    setObsidianImportOpen,
    setTocOpen,
    setWritingTargetsOpen,
    renameOpen,
    renameTargetPath,
    tagRenameTag,
    sectionRenameTarget,
    blockRenameTarget,
    setRenameOpen,
    setRenameTargetPath,
    setTagRenameTag,
    setSectionRenameTarget,
    setBlockRenameTarget,
    conflictPath,
    setConflictPath,
  }
}
