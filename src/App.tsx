import { useState, useMemo, useEffect, useRef, useCallback, useDeferredValue, Suspense } from 'react'
import { applyRendererExtensions } from '@scriptor/renderer'
import { indexerSearch } from './bridge/commands'
import { isNativeBridgeAvailable } from './bridge/platform'
import { useTopBarHeightVar } from './hooks/useTopBarHeightVar'
import { VaultSidebar } from './components/app/VaultSidebar'
import {
  BibliographyPanel,
  GitPanel,
  GraphPanel,
  KnowledgeWorkbench,
  McpPanel,
  PanelFallback,
  PublishCenter,
  SettingsPanel,
  SnippetsPanelLazy,
  VaultHealthDashboard,
} from './components/app/lazyPanels'
import { parseSimpleFrontmatter } from './lib/frontmatter'
import { isReaderDocumentPath } from './hooks/vault/helpers'
import { buildPaletteCommands } from './lib/buildPaletteCommands'
import { planDailyNotePreview } from './lib/knowledge/templates'
import { AppTopBar } from './components/shell/AppTopBar'
import { EditorWorkspace } from './components/shell/EditorWorkspace'
import { InspectorRail } from './components/shell/InspectorRail'
import { WorkspaceStatusFooter } from './components/shell/WorkspaceStatusFooter'
import { MobileWorkspaceNav } from './components/shell/MobileWorkspaceNav'
import { useTextPrompt } from './hooks/useTextPrompt'
import { useNoteDraftStats } from './hooks/useNoteDraftStats'
import { TextPromptDialog } from './components/TextPromptDialog'
import { useRecentVaults } from './hooks/useRecentVaults'
import { CommandPalette } from './components/CommandPalette'
import {
  CheatsheetPanel,
  OnboardingTour,
  PerfHudOverlay,
  SupportPanel,
  WritingTargetsPanel,
} from './components/app/lazyPanels'
import { AppToast, AppToastRegion } from './components/AppToast'
import { ErrorBoundary } from './components/ErrorBoundary'
import { PanelErrorFallback } from './components/PanelErrorFallback'
import { FrontmatterInspector } from './components/FrontmatterInspector'
import { QuickCaptureWorkspaceLayer } from './components/app/QuickCaptureWorkspaceLayer'
import { WorkspacePanelLaunchers } from './components/app/WorkspacePanelLaunchers'
import { WorkspacePortalOverlays } from './components/app/WorkspacePortalOverlays'
import { WorkspaceRenameDialogs } from './components/app/WorkspaceRenameDialogs'
import { recordWritingSession } from './lib/writingTargets'
import type { KnowledgeWorkbenchTab } from './components/KnowledgeWorkbench'
import { useCommandPalette } from './hooks/useCommandPalette'
import { useAiProvider } from './hooks/useAiProvider'
import { useDiagnosticsSettings } from './hooks/useDiagnosticsSettings'
import { useEscapeToClose } from './hooks/useEscapeToClose'
import { useLocalDate } from './hooks/useLocalDate'
import { useMcpRuntime } from './hooks/useMcpRuntime'
import { usePlatformShell, parseDeepLink } from './hooks/usePlatformShell'
import { useOnboarding } from './hooks/useOnboarding'
import { usePerfMetrics } from './hooks/usePerfMetrics'
import { useWorkspaceSession } from './hooks/useWorkspaceSession'
import { usePluginRegistry } from './hooks/usePluginRegistry'
import { useVaultWorkspace } from './hooks/useVaultWorkspace'
import { useWorkspaceStore } from './hooks/useWorkspaceStore'
import { usePortalShortcuts } from './hooks/usePortalShortcuts'
import { useEditorPreferences } from './hooks/useEditorPreferences'
import { useAppToast } from './hooks/useAppToast'
import { useAppTheme } from './hooks/useAppTheme'
import { useHeadlessEngine } from './hooks/useHeadlessEngine'
import { usePreviewBridge } from './hooks/usePreviewBridge'
import { useScreenshotAutoOpen } from './screenshot/useScreenshotAutoOpen'
import { useResizablePanel } from './hooks/useResizablePanel'
import { useSplitPaneResize } from './hooks/useSplitPaneResize'
import { useCiteprocPreview } from './hooks/useCiteprocPreview'
import { useWorkspaceMode, type WorkspaceMode } from './hooks/useWorkspaceMode'
import { useWorkspaceChrome } from './hooks/useWorkspaceChrome'
import {
  DEFAULT_WORKSPACE_LAYOUTS,
  readInitialWorkspaceLayout,
  useWorkspaceLayout,
} from './hooks/useWorkspaceLayout'
import { runPluginCommand } from './lib/runPluginCommand'
import { WorkspacePanelResizer } from './components/app/WorkspaceGridPrimitives'
import { workspaceGridStyle } from './components/app/workspaceGridStyle'
import { WorkspaceRuntimeBanners } from './components/app/WorkspaceRuntimeBanners'
import { useDeleteNoteController } from './hooks/useDeleteNoteController'
import { useWorkspaceNavigationController } from './controllers/useWorkspaceNavigationController'
import { useEditorOrchestrationController } from './controllers/useEditorOrchestrationController'
import { usePanelSurfaceController } from './controllers/usePanelSurfaceController'
import { useWorkspaceAuxiliaryData } from './hooks/useWorkspaceAuxiliaryData'
import { useAppJourneyTelemetry } from './hooks/useAppJourneyTelemetry'
import { useAppKeyboardShortcuts } from './hooks/useAppKeyboardShortcuts'
import { useAppZoom } from './hooks/useAppZoom'
import { useVaultSidebarActions } from './hooks/useVaultSidebarActions'
import { useJourneyMetrics } from './hooks/useJourneyMetrics'
import { useStarlightPublishing } from './hooks/useStarlightPublishing'
import { usePanelPresentation } from './hooks/usePanelPresentation'
import { extractPandocCitationKeys } from './lib/citationExtract'
import {
  gitShowHeadFile,
  indexerApplyFilesystemChanges,
  vaultReadNote,
  vaultSaveNote,
  vaultSaveConfig,
  vaultSaveAsset,
  codeChunkRun,
} from './bridge/commands'
import { ConflictResolverSurface } from './components/app/ConflictResolverSurface'
import { BRAND_WORKSPACE_LABEL } from './brand/identity'
import { editorFontFamilyCss } from './brand/support'
import { useI18n } from './lib/i18n'
import { useStoreSurfaceController } from './hooks/useStoreSurfaceController'
import { CapabilityWorkflowOverlays } from './components/app/CapabilityWorkflowOverlays'
import { usePluginCommandRuntime } from './hooks/usePluginCommandRuntime'
import './styles/tokens/primitives.css'
import './styles/tokens/semantic.css'
import './styles/tokens/components.css'
import './styles/layout/workspace.css'
import './styles/components/modals.css'
import './styles/components/onboarding.css'
import './styles/components/note-history.css'
import './styles/components/vault-skeleton.css'
import './styles/components/command-palette.css'
import './styles/components/unified-panel.css'
import './styles/components/empty-state.css'
import './styles/components/perf-hud.css'
import './styles/components/conflict-resolver.css'
import './styles/components/publish-center.css'
import './styles/components/git-panel.css'
import './styles/components/smart-collections.css'
import './styles/components/markdown-preview.css'
import './styles/components/canvas-graph.css'
import './App.css'
import './styles/motion.css'
function App() {
  const { t } = useI18n()
  const localDate = useLocalDate()
  const { theme, toggleTheme, setTheme } = useAppTheme()
  const [initialWorkspaceLayout] = useState(readInitialWorkspaceLayout)
  const { chrome, patchChrome, resetChrome } = useWorkspaceChrome()
  const { mode: workspaceMode, setMode: setWorkspaceMode } = useWorkspaceMode()
  const { layouts, applyLayout, saveCurrentAsLayout, resetLayout } = useWorkspaceLayout()
  const onboarding = useOnboarding()
  const { presentation: panelPresentation, setPresentation: setPanelPresentation } = usePanelPresentation()
  const journey = useJourneyMetrics()
  const {
    markVaultOpen: journeyMarkVaultOpen,
    markIndexRebuild: journeyMarkIndexRebuild,
    markExport: journeyMarkExport,
    recordPanelOpen: journeyRecordPanelOpen,
  } = journey

  // ── Surface and Navigation Controllers ──────────────────────────────────────
  const panelSurfaces = usePanelSurfaceController({
    showStickiesInitial: initialWorkspaceLayout.showStickies,
  })
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
  } = panelSurfaces
  const nav = useWorkspaceNavigationController({
    initialGraphDepth: initialWorkspaceLayout.graphDepth,
  })
  const {
    collapsedFolders,
    setCollapsedFolders,
    graphDepth,
    setGraphDepth,
    graphFullVault,
    setGraphFullVault,
    mobilePane,
    setMobilePane,
    inspectorPreset,
    setInspectorPreset,
    readerFilePath,
    setReaderFilePath,
    pluginManagerOpen,
    setPluginManagerOpen,
    perfHudOpen,
    setPerfHudOpen,
  } = nav
  const editorWorkspaceRef = useRef<HTMLDivElement | null>(null)
  const workspaceGridRef = useRef<HTMLElement | null>(null)
  const {
    distractionFree,
    editorMode,
    editorTheme,
    hibernateGit,
    hibernateGraph,
    hibernateMcp,
    hibernateSpellcheck,
    hibernateWatcher,
    languageTool,
    languageToolEndpoint,
    setDistractionFree,
    setHibernateGit,
    setHibernateGraph,
    setHibernateMcp,
    setHibernateSpellcheck,
    setHibernateWatcher,
    setLanguageTool,
    setLanguageToolEndpoint,
    setSpellcheck,
    setSpellcheckLocale,
    setSplitPreview,
    setTypewriter,
    setVimMode,
    setWysiwyg,
    spellcheck,
    spellcheckLocale,
    splitPreview,
    toggleEditorMode,
    toggleEditorTheme,
    typewriter,
    vimMode,
    wysiwyg,
  } = useEditorPreferences(theme, initialWorkspaceLayout)
  const { toastMessage, showToast, dismissToast } = useAppToast()
  const perfMetrics = usePerfMetrics()
  const {
    markVaultOpenStart: perfMarkVaultOpenStart,
    markVaultOpenEnd: perfMarkVaultOpenEnd,
    setWorkspaceCounts: perfSetWorkspaceCounts,
    setGraphNodeCount: perfSetGraphNodeCount,
  } = perfMetrics
  const commandPalette = useCommandPalette()
  const nativeReady = isNativeBridgeAvailable() || import.meta.env.VITE_E2E_MODE === 'true'
  const [pluginVaultId, setPluginVaultId] = useState<string | null>(null)
  const plugins = usePluginRegistry(pluginVaultId, { marketplaceActive: activeMode === 'plugins' })
  const setSidebarViewRef = useRef<(view: 'vault' | 'inbox') => void>(() => {})
  const workspace = useVaultWorkspace({
    onSearchComplete: (hits) => {
      if (hits.length > 0) {
        setStatusDockTab('search')
      }
    },
    onSearchTiming: perfMetrics.recordSearchMs,
    pluginExportProfiles: plugins.contributions.exportProfiles,
    onVaultChanged: setPluginVaultId,
    onSessionLayoutRestore: (layout) => {
      setCollapsedFolders(layout.collapsedFolders)
      setSidebarViewRef.current(layout.sidebarView)
    },
    hibernateWatcher,
    hibernateGit,
  })
  const deleteNoteController = useDeleteNoteController({
    enabled: nativeReady,
    closeTab: workspace.closeTab,
    rebuildIndex: workspace.rebuildIndex,
    refreshVault: workspace.refreshVault,
    showToast,
  })
  useEffect(() => {
    setSidebarViewRef.current = workspace.setSidebarView
  }, [workspace.setSidebarView])
  useWorkspaceSession(workspace.vault?.id, {
    activePath: workspace.activePath,
    openTabs: workspace.openTabs,
    collapsedFolders,
    sidebarView: workspace.sidebarView,
  })
  useScreenshotAutoOpen(workspace.openVaultAt, workspace.status)
  usePlatformShell({
    onQuickCapture: () => setQuickCaptureOpen(true),
    onDeepLink: (url) => {
      const target = parseDeepLink(url)
      if (!target) return
      if (target.kind === 'vault') {
        void workspace.openVaultAt(target.path)
        return
      }
      void workspace.openNote(target.path)
    },
  })

  const { promptRequest, promptText, submitPrompt, cancelPrompt } = useTextPrompt()
  const {
    applyStarlightPlan,
    publishApplying,
    publishOutputPath,
    publishPlan,
    publishStarlight,
  } = useStarlightPublishing({
    promptText,
    showToast,
    openPublishCenter: () => setPublishCenterOpen(true),
  })
  const recentVaults = useRecentVaults()
  const rememberRecentVault = recentVaults.remember
  useEffect(() => {
    if (workspace.vault?.root_path) {
      rememberRecentVault(workspace.vault.root_path)
    }
  }, [rememberRecentVault, workspace.vault?.root_path])
  const { activePath: workspaceActivePath, loadGraph: loadWorkspaceGraph } = workspace
  const { refreshHealth, fixVaultLint, exportWithProfile } = workspace
  const pluginCommandRuntime = usePluginCommandRuntime({
    refreshHealth, fixVaultLint, exportWithProfile, setStatusDockTab, setHealthDashboardOpen,
    setCanvasOpen, setBibliographyOpen,
  })
  const mcp = useMcpRuntime(
    Boolean(workspace.vault),
    workspace.vault?.id,
    workspace.vaultConfig,
    workspace.setVaultConfig,
    workspace.activePath,
    workspace.activeNote?.metadata.content_hash ?? null,
    plugins.contributions.exportProfiles,
    plugins.contributions.mcpTools,
    pluginCommandRuntime,
    plugins.canExecutePluginCommand,
    hibernateMcp,
  )
  const storeSurface = useStoreSurfaceController({
    workspaceMode,
    currentLayout: { splitPreview, showStickies: stickiesVisible, graphDepth, distractionFree },
    applyLayout,
    setSplitPreview,
    setStickiesVisible,
    setGraphDepth,
    setDistractionFree,
    mcp,
    hibernation: { graph: hibernateGraph, mcp: hibernateMcp, watcher: hibernateWatcher, git: hibernateGit, spellcheck: hibernateSpellcheck },
    setHibernation: { graph: setHibernateGraph, mcp: setHibernateMcp, watcher: setHibernateWatcher, git: setHibernateGit, spellcheck: setHibernateSpellcheck },
  })
  const ai = useAiProvider()
  const diagnostics = useDiagnosticsSettings(Boolean(workspace.vault))
  const rendererExtensions = plugins.contributions.rendererExtensions
  const previewPostProcess = useCallback(
    (html: string) => applyRendererExtensions(html, rendererExtensions),
    [rendererExtensions],
  )
  const {
    headlessEngine,
    setHeadlessEngine,
    daemonVersion,
    daemonError,
    refreshDaemonStatus,
    startDaemon,
  } = useHeadlessEngine({
    vaultRootPath: workspace.vault?.root_path,
    settingsOpen,
  })
  const {
    bibliographyRaw,
    conflictBasePreview,
    conflictSource,
    recentNotes,
    refreshBibliography,
    systemInfo,
    vaultTags,
  } = useWorkspaceAuxiliaryData({
    nativeReady,
    vaultId: workspace.vault?.id ?? null,
    activePath: workspace.activePath,
    rebuildRevision: workspace.lastRebuildMs,
    conflictPath,
    settingsOpen,
  })
  // Auto-open last vault or default cache vault on startup
  useEffect(() => {
    if (!nativeReady || workspace.vault || workspace.status !== 'idle') return

    void (async () => {
      // 1. Try to open the most recent vault
      if (recentVaults.recent.length > 0) {
        try {
          await workspace.openVaultAt(recentVaults.recent[0])
          return
        } catch {
          // If it fails (e.g. folder deleted), forget it and fall through to default
          recentVaults.forget(recentVaults.recent[0])
        }
      }

      // 2. Fall back to default cache folder
      try {
        const { documentDir, join } = await import('@tauri-apps/api/path')
        const docDir = await documentDir()
        const defaultVaultPath = await join(docDir, 'ScriptorVault')
        await workspace.openVaultAt(defaultVaultPath)
      } catch (err) {
        console.error('Failed to auto-open default vault:', err)
      }
    })()
  }, [nativeReady, recentVaults, workspace])
  const bibliography = useMemo(
    () => (workspace.vault && nativeReady ? bibliographyRaw : []),
    [bibliographyRaw, nativeReady, workspace.vault],
  )
  const showSplitPreview =
    (chrome.editorSurfaceMode === 'split' || splitPreview) && Boolean(workspace.activePath)
  const {
    editorWidth: splitEditorWidth,
    dragging: splitDragging,
    onHandlePointerDown: onSplitHandlePointerDown,
    onHandlePointerMove: onSplitHandlePointerMove,
    onHandlePointerUp: onSplitHandlePointerUp,
    onHandlePointerCancel: onSplitHandlePointerCancel,
    onHandleDoubleClick: onSplitHandleDoubleClick,
    ratio: splitRatioPct,
    nudgeRatio: onSplitHandleNudge,
  } = useSplitPaneResize(showSplitPreview && !chrome.layoutLocked, editorWorkspaceRef)

  const vaultResizer = useResizablePanel(
    !chrome.vaultSidebarCollapsed && !chrome.layoutLocked,
    workspaceGridRef,
    'left',
    chrome.vaultWidth,
    200,
    600,
    'scriptor:vault-width',
    (collapsed) => patchChrome({ vaultSidebarCollapsed: collapsed })
  )

  const inspectorResizer = useResizablePanel(
    !chrome.inspectorCollapsed && !chrome.layoutLocked,
    workspaceGridRef,
    'right',
    chrome.inspectorWidth,
    300,
    800,
    'scriptor:inspector-width',
    (collapsed) => patchChrome({ inspectorCollapsed: collapsed })
  )
  const showInspectorPreview =
    (chrome.editorSurfaceMode === 'rendered' || activeMode === 'preview') &&
    Boolean(workspace.activePath) &&
    !showSplitPreview

  const editorOrchestration = useEditorOrchestrationController({
    activePath: workspace.activePath,
    draftMarkdown: workspace.draftMarkdown,
    activeTitle: workspace.activeNote?.metadata.title,
    activeTags: workspace.activeNote?.metadata.tags,
    vaultTags,
    entries: workspace.entries,
    bibliography,
    spellcheck,
    spellcheckLocale,
    hibernateSpellcheck,
    languageToolEndpoint,
    nativeReady,
    showSplitPreview,
    showInspectorPreview,
    baseProblemCount: workspace.problemCount,
  })
  const {
    editorRef,
    previewRef,
    inspectorPanelRef,
    splitPreviewScrollRef,
    scrollSyncEnabled,
    visibleEditorLine,
    handleEditorLine,
    tocEntries,
    editorAutocompleteContext,
    monacoCompletionContext,
    snippetContext,
    editorLintMessages,
    totalProblemCount,
    executeDql,
    previewFetchNote,
    previewPlantUmlLocal,
  } = editorOrchestration

  const previewReadVaultText = useCallback(
    async (path: string): Promise<string | null> => {
      if (!nativeReady) return null
      try {
        const doc = await vaultReadNote(path)
        return doc.markdown
      } catch {
        return null
      }
    },
    [nativeReady],
  )
  const writeVaultText = useCallback(
    async (path: string, text: string): Promise<void> => {
      if (!nativeReady) return
      await vaultSaveNote(path, text)
    },
    [nativeReady],
  )
  const workspaceStore = useWorkspaceStore({
    vaultOpen: Boolean(workspace.vault),
    vaultId: workspace.vault?.id,
    readVaultText: nativeReady ? previewReadVaultText : undefined,
    writeVaultText: nativeReady ? writeVaultText : undefined,
  })
  usePortalShortcuts({
    items: workspaceStore.portal.items,
    enabled: workspaceStore.hydrated,
    onInsert: (body) => workspace.insertSnippet(body),
    onOpenNote: (path) => void workspace.openNote(path),
  })
  const runCodeChunk = useCallback(
    (language: string, code: string) => codeChunkRun(language, code),
    [],
  )
  const previewBridge = usePreviewBridge({
    nativeReady,
    previewFetchNote,
    previewReadVaultText,
    executeDql,
    runCodeChunk,
    previewPostProcess,
    previewPlantUmlLocal,
  })
  const openKnowledgeWorkbench = useCallback((tab: KnowledgeWorkbenchTab = 'repair') => {
    setKnowledgeWorkbenchTab(tab)
    setKnowledgeWorkbenchOpen(true)
  }, [setKnowledgeWorkbenchOpen, setKnowledgeWorkbenchTab])

  const handleWorkspaceModeChange = useCallback(
    (mode: WorkspaceMode) => {
      saveCurrentAsLayout(workspaceMode, {
        splitPreview,
        showStickies: stickiesVisible,
        graphDepth,
        distractionFree,
      })
      const nextLayout = layouts[mode]
      setSplitPreview(nextLayout.splitPreview)
      setStickiesVisible(nextLayout.showStickies)
      setGraphDepth(nextLayout.graphDepth)
      setDistractionFree(nextLayout.distractionFree)
      setWorkspaceMode(mode)
      if (mode === 'knowledge') openKnowledgeWorkbench('repair')
      if (mode === 'publish') setPublishCenterOpen(true)
      if (mode === 'review') setHealthDashboardOpen(true)
      if (mode === 'automation') setMcpPanelOpen(true)
    },
    [
      distractionFree,
      graphDepth,
      layouts,
      openKnowledgeWorkbench,
      saveCurrentAsLayout,
      setDistractionFree,
      setGraphDepth,
      setHealthDashboardOpen,
      setMcpPanelOpen,
      setPublishCenterOpen,
      setSplitPreview,
      setStickiesVisible,
      setWorkspaceMode,
      splitPreview,
      stickiesVisible,
      workspaceMode,
    ],
  )

  const resetWorkspaceLayout = useCallback(
    (mode: WorkspaceMode) => {
      resetLayout(mode)
      if (mode !== workspaceMode) return
      const nextLayout = DEFAULT_WORKSPACE_LAYOUTS[mode]
      setSplitPreview(nextLayout.splitPreview)
      setStickiesVisible(nextLayout.showStickies)
      setGraphDepth(nextLayout.graphDepth)
      setDistractionFree(nextLayout.distractionFree)
    },
    [
      resetLayout,
      setDistractionFree,
      setGraphDepth,
      setSplitPreview,
      setStickiesVisible,
      workspaceMode,
    ],
  )

  useAppJourneyTelemetry({
    vaultOpen: Boolean(workspace.vault),
    lastRebuildMs: workspace.lastRebuildMs,
    exportCompleted: Boolean(workspace.exportResult),
    panelOpen: {
      git: gitPanelOpen,
      mcp: mcpPanelOpen,
      portal: portalOpen,
      workbench: knowledgeWorkbenchOpen,
    },
    workspaceStatus: workspace.status,
    openTabCount: workspace.openTabs.length,
    sectionCount: workspace.sections.length,
    graphNodeCount: workspace.graph?.nodes.length ?? null,
    perfHudOpen,
    markVaultOpen: journeyMarkVaultOpen,
    markIndexRebuild: journeyMarkIndexRebuild,
    markExport: journeyMarkExport,
    recordPanelOpen: journeyRecordPanelOpen,
    markVaultOpenStart: perfMarkVaultOpenStart,
    markVaultOpenEnd: perfMarkVaultOpenEnd,
    setWorkspaceCounts: perfSetWorkspaceCounts,
    setGraphNodeCount: perfSetGraphNodeCount,
  })

  const isNoteDirty = workspace.isNoteDirty
  const { draftWordCount, wordCountDelta, charCount, readingMinutes } =
    useNoteDraftStats({
      draftMarkdown: workspace.draftMarkdown,
      activeNote: workspace.activeNote,
      isNoteDirty,
    })
  const healthAction = !workspace.health
    ? 'Loading…'
    : workspace.health.broken_links === 0 && workspace.health.unresolved_citations === 0
      ? 'Good'
      : 'Needs review'

  useEscapeToClose(graphOpen, () => setGraphOpen(false))
  useEscapeToClose(statusDockTab === 'problems' && totalProblemCount > 0, () => setStatusDockTab('output'))
  useEscapeToClose(gitPanelOpen, () => setGitPanelOpen(false))
  useEscapeToClose(healthDashboardOpen, () => setHealthDashboardOpen(false))
  useEscapeToClose(mcpPanelOpen, () => setMcpPanelOpen(false))
  useEscapeToClose(settingsOpen, () => setSettingsOpen(false))
  useEscapeToClose(pluginManagerOpen, () => setPluginManagerOpen(false))
  useEscapeToClose(knowledgeWorkbenchOpen, () => setKnowledgeWorkbenchOpen(false))
  useEscapeToClose(publishCenterOpen, () => setPublishCenterOpen(false))
  useEscapeToClose(snippetsOpen, () => setSnippetsOpen(false))
  useEscapeToClose(cheatsheetOpen, () => setCheatsheetOpen(false))
  useEscapeToClose(supportOpen, () => setSupportOpen(false))
  useEscapeToClose(portalOpen, () => setPortalOpen(false))
  useEscapeToClose(quickCaptureOpen, () => setQuickCaptureOpen(false))
  useEscapeToClose(noteHistoryOpen, () => setNoteHistoryOpen(false))
  useEscapeToClose(bibliographyOpen, () => setBibliographyOpen(false))
  useEscapeToClose(renameOpen, () => setRenameOpen(false))

  useEffect(() => {
    if (!graphOpen) return
    void loadWorkspaceGraph(workspaceActivePath, { depth: graphDepth, fullVault: graphFullVault })
  }, [graphOpen, graphDepth, graphFullVault, workspaceActivePath, loadWorkspaceGraph])

  const pluginCommandEntries = useMemo(
    () =>
      plugins.contributions.commands.flatMap((command) =>
        command.pluginId ? [{ pluginId: command.pluginId, command }] : [],
      ),
    [plugins.contributions.commands],
  )

  const setEditorSurfaceMode = useCallback(
    (mode: 'source' | 'split' | 'rendered') => {
      patchChrome({ editorSurfaceMode: mode })
      if (mode === 'source') {
        setSplitPreview(false)
        setActiveMode('inspector')
      } else if (mode === 'split') {
        setSplitPreview(true)
        setActiveMode('inspector')
      } else {
        setSplitPreview(false)
        setActiveMode('preview')
      }
    },
    [patchChrome, setActiveMode, setSplitPreview],
  )

  const deleteActiveNote = useCallback(async () => {
    if (!workspace.activePath || !nativeReady) return
    await deleteNoteController.deleteNote(workspace.activePath)
  }, [deleteNoteController, nativeReady, workspace.activePath])

  const bibliographyKeys = useMemo(() => new Set(bibliography.map((entry) => entry.key)), [bibliography])

  const inboxPaths = useMemo(
    () => new Set(workspace.inboxNotes.map((note) => note.path)),
    [workspace.inboxNotes],
  )
  const readerDocumentPaths = useMemo(
    () =>
      new Set(
        workspace.entries
          .filter((entry) => entry.kind === 'asset' && isReaderDocumentPath(entry.path))
          .map((entry) => entry.path),
      ),
    [workspace.entries],
  )

  const dailyNoteLabel = useMemo(() => {
    const preview = planDailyNotePreview(workspace.vaultConfig.daily_note, localDate)
    return preview.path.split('/').pop()?.replace(/\.md$/i, '') ?? localDate
  }, [localDate, workspace.vaultConfig.daily_note])

  const paletteCommands = useMemo(
    () =>
      buildPaletteCommands({
        workspace: {
          ...workspace,
          reopenClosedTab: workspace.reopenClosedTab,
          closedTabCount: workspace.closedTabs.length,
        },
        ai,
        mcp,
        graphDepth,
        graphFullVault,
        splitPreview,
        setSplitPreview,
        setStatusDockTab,
        setGraphOpen,
        setCanvasOpen,
        setReaderOpen: nativeReady && workspace.vault ? setReaderOpen : undefined,
        setTasksOpen: nativeReady && workspace.vault ? setTasksOpen : undefined,
        setKanbanOpen: nativeReady && workspace.vault && workspace.activePath ? setKanbanOpen : undefined,
        setGitPanelOpen,
        setHealthDashboardOpen,
        setMcpPanelOpen,
        setSettingsOpen,
        setPluginManagerOpen,
        openKnowledgeWorkbench,
        setPublishCenterOpen,
        setCheatsheetOpen,
        setSupportOpen,
        setPortalOpen,
        setQuickCaptureOpen,
        setNoteHistoryOpen,
        setBibliographyOpen,
        setSnippetsOpen,
        setTemplatePickerOpen: nativeReady && workspace.vault ? setTemplatePickerOpen : undefined,
        setObsidianImportOpen: nativeReady && workspace.vault ? setObsidianImportOpen : undefined,
        insertSnippet: (text) => workspace.insertSnippet(text),
        publishStarlight: nativeReady ? () => void publishStarlight() : undefined,
        promptText,
        pluginCommands: pluginCommandEntries,
        runPluginCommand: (entry) => {
          if (!plugins.canExecutePluginCommand(entry.pluginId, entry.command.permission)) return
          void runPluginCommand(entry.command, pluginCommandRuntime, {
            notePath: workspace.activePath,
          })
        },
        deleteActiveNote: nativeReady ? () => void deleteActiveNote() : undefined,
        openRecentNote: (path) => void workspace.openNote(path),
        recentNotes,
        setEditorSurfaceMode,
        toggleVaultSidebar: () => patchChrome({ vaultSidebarCollapsed: !chrome.vaultSidebarCollapsed }),
        toggleInspector: () => patchChrome({ inspectorCollapsed: !chrome.inspectorCollapsed }),
        vaultSidebarCollapsed: chrome.vaultSidebarCollapsed,
        inspectorCollapsed: chrome.inspectorCollapsed,
        applyEditorTransform: (action) => workspace.applyEditorTransform(action),
        setPerfHudOpen,
        perfHudOpen,
        hibernateGraph,
        setHibernateGraph,
        hibernateMcp,
        setHibernateMcp,
        hibernateWatcher,
        setHibernateWatcher,
        hibernateGit,
        setHibernateGit,
        hibernateSpellcheck,
        setHibernateSpellcheck,
      }),
    [
      ai,
      chrome.inspectorCollapsed,
      chrome.vaultSidebarCollapsed,
      deleteActiveNote,
      graphDepth,
      graphFullVault,
      mcp,
      nativeReady,
      openKnowledgeWorkbench,
      patchChrome,
      pluginCommandEntries,
      pluginCommandRuntime,
      publishStarlight,
      promptText,
      recentNotes,
      setBibliographyOpen,
      setCanvasOpen,
      setCheatsheetOpen,
      setEditorSurfaceMode,
      setKanbanOpen,
      setGitPanelOpen,
      setGraphOpen,
      setHealthDashboardOpen,
      setPublishCenterOpen,
      setMcpPanelOpen,
      setNoteHistoryOpen,
      setPerfHudOpen,
      setPortalOpen,
      setPluginManagerOpen,
      setQuickCaptureOpen,
      setReaderOpen,
      setSettingsOpen,
      setSplitPreview,
      setStatusDockTab,
      setSnippetsOpen,
      setTemplatePickerOpen,
      setObsidianImportOpen,
      setSupportOpen,
      setTasksOpen,
      splitPreview,
      workspace,
      perfHudOpen,
      hibernateGraph,
      setHibernateGraph,
      hibernateMcp,
      setHibernateMcp,
      hibernateWatcher,
      setHibernateWatcher,
      hibernateGit,
      setHibernateGit,
      hibernateSpellcheck,
      setHibernateSpellcheck,
    ],
  )

  // Citation key extraction re-scans the whole draft; deferring it keeps
  // that scan off the keystroke frame for large notes.
  const deferredCitationDraft = useDeferredValue(workspace.draftMarkdown)
  const citationRows = useMemo(() => {
    const inline = extractPandocCitationKeys(deferredCitationDraft)
    const unresolved =
      workspace.healthDiagnostics?.issues
        .filter((issue) => issue.kind === 'unresolved_citation' && issue.path === workspace.activePath)
        .map((issue) => issue.detail.replace('missing bibliography entry: ', '')) ?? []
    return Array.from(new Set([...inline, ...unresolved]))
  }, [workspace.activePath, deferredCitationDraft, workspace.healthDiagnostics])

  const { formatInline, formatBibliography } = useCiteprocPreview(bibliography, citationRows)

  useAppZoom()
  useTopBarHeightVar()

  useAppKeyboardShortcuts({
    activePath: workspace.activePath,
    chooseVaultFolder: workspace.chooseVaultFolder,
    setSidebarView: workspace.setSidebarView,
    createDailyNote: workspace.createDailyNote,
    loadGraph: workspace.loadGraph,
    reopenClosedTab: workspace.reopenClosedTab,
    openNoteHistory: () => setNoteHistoryOpen(true),
    openSnippets: () => setSnippetsOpen(true),
    openGraph: () => setGraphOpen(true),
    openCanvas: () => setCanvasOpen(true),
    openKnowledgeWorkbench,
    openGit: () => setGitPanelOpen(true),
    openReader: nativeReady && workspace.vault ? () => setReaderOpen(true) : undefined,
    openTasks: nativeReady && workspace.vault ? () => setTasksOpen(true) : undefined,
    openKanban:
      nativeReady && workspace.vault && workspace.activePath ? () => setKanbanOpen(true) : undefined,
    openTemplates: nativeReady && workspace.vault ? () => setTemplatePickerOpen(true) : undefined,
    toggleVaultSidebar: () => patchChrome({ vaultSidebarCollapsed: !chrome.vaultSidebarCollapsed }),
    toggleInspector: () => patchChrome({ inspectorCollapsed: !chrome.inspectorCollapsed }),
  })

  const gitTitle = workspace.isGitStatusLoading
    ? t('git.checkingStatus')
    : workspace.gitStatusError
      ? t('git.statusUnavailable')
      : workspace.gitStatus?.is_repo
        ? workspace.gitStatus.clean
          ? t('git.repositoryClean')
          : t('git.changedFiles', { count: workspace.gitStatus.changed_files.length })
        : t('git.notARepo')
  const healthMetrics = useMemo(
    () => [
      ['Links', String(workspace.inspectorLinks.length)],
      ['Broken', String(workspace.health?.broken_links ?? 0)],
      ['Orphans', String(workspace.health?.orphan_assets ?? 0)],
      ['Duplicates', String(workspace.health?.duplicate_titles ?? 0)],
      ['Frontmatter', String(workspace.health?.invalid_frontmatter ?? 0)],
      ['Citations', String(workspace.health?.unresolved_citations ?? 0)],
      ['Words', draftWordCount.toLocaleString()],
      ['Vault words', (workspace.health?.total_words ?? 0).toLocaleString()],
    ] as Array<[string, string]>,
    [draftWordCount, workspace.health, workspace.inspectorLinks.length],
  )

  const sidebarActions = useVaultSidebarActions({
    nativeReady,
    chooseVaultFolder: workspace.chooseVaultFolder,
    createNote: workspace.createNote,
    createNoteOfType: workspace.createNoteOfType,
    createNoteFromTemplate: workspace.createNoteFromTemplate,
    rebuildIndex: workspace.rebuildIndex,
    createDailyNote: workspace.createDailyNote,
    createDailyNoteForOffset: workspace.createDailyNoteForOffset,
    organizeNote: workspace.organizeNote,
    openNote: workspace.openNote,
    openReaderDocument: (path) => {
      setReaderFilePath(path)
      setReaderOpen(true)
    },
    refreshVault: workspace.refreshVault,
    importDroppedFiles: workspace.importDroppedFiles,
    deleteNote: deleteNoteController.deleteNote,
    openKnowledgeWorkbench,
    openSnippets: () => setSnippetsOpen(true),
    openSettings: () => setSettingsOpen(true),
    openRename: (path) => {
      setRenameTargetPath(path)
      setRenameOpen(true)
    },
    showToast,
  })

  return (
    <main className="app-shell" aria-label={BRAND_WORKSPACE_LABEL} data-workspace-mode={workspaceMode}>
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {workspace.status === 'ready' ? 'Workspace ready' : `Workspace ${workspace.status}`}
      </div>
      <div className="app-chrome">
        <AppTopBar
        onPatchChrome={patchChrome}
          vault={workspace.vault}
          workspaceMode={workspaceMode}
          onWorkspaceModeChange={handleWorkspaceModeChange}
          onOpenKnowledgeWorkbench={() => openKnowledgeWorkbench('repair')}
          onOpenPublishCenter={() => setPublishCenterOpen(true)}
          canNavigateBack={workspace.canNavigateBack}
          canNavigateForward={workspace.canNavigateForward}
          onNavigateBack={() => workspace.navigateBack()}
          onNavigateForward={() => workspace.navigateForward()}
          onChooseVault={() => void workspace.chooseVaultFolder()}
          recentVaults={recentVaults.recent}
          activeVaultPath={workspace.vault?.root_path ?? null}
          onOpenVault={(path) => void workspace.openVaultAt(path)}
          onOpenCommandPalette={() => commandPalette.setOpen(true)}
          onOpenPortal={() => setPortalOpen(true)}
          onOpenQuickCapture={() => setQuickCaptureOpen(true)}
          onOpenGraph={() => {
            setGraphOpen(true)
            void workspace.loadGraph(workspace.activePath)
          }}
          onOpenCanvas={() => setCanvasOpen(true)}
          gitTitle={gitTitle}
          gitSuccess={
            !workspace.isGitStatusLoading &&
            !workspace.gitStatusError &&
            workspace.gitStatus?.is_repo === true &&
            workspace.gitStatus.clean === true
          }
          gitNeutral={!workspace.isGitStatusLoading && !workspace.gitStatusError && !workspace.gitStatus?.is_repo}
          onOpenGit={() => setGitPanelOpen(true)}
          mcpLabel={`MCP ${mcp.mode}`}
          onOpenMcp={() => setMcpPanelOpen(true)}
          onOpenSupport={() => setSupportOpen(true)}
          onOpenSettings={() => setSettingsOpen(true)}
          onOpenPluginManager={() => setPluginManagerOpen(true)}
          theme={theme}
          onToggleTheme={toggleTheme}
          vaultSidebarCollapsed={chrome.vaultSidebarCollapsed}
          onToggleVaultSidebar={() => patchChrome({ vaultSidebarCollapsed: !chrome.vaultSidebarCollapsed })}
          inspectorCollapsed={chrome.inspectorCollapsed}
          onToggleInspector={() => patchChrome({ inspectorCollapsed: !chrome.inspectorCollapsed })}
        />

        <WorkspaceRuntimeBanners nativeReady={nativeReady} error={workspace.error} />
      </div>

      <section
        className="workspace-grid"
        ref={workspaceGridRef}
        data-mobile-pane={mobilePane}
        data-vault-collapsed={chrome.vaultSidebarCollapsed ? 'true' : 'false'}
        data-inspector-collapsed={chrome.inspectorCollapsed ? 'true' : 'false'}
        style={workspaceGridStyle({
          editorFontSize: chrome.editorFontSize,
          editorFontFamily: editorFontFamilyCss(chrome.editorFontFamily),
          editorLineHeight: chrome.editorLineHeight,
          editorPaddingPx: chrome.editorPaddingPx,
          previewMaxWidthCh: chrome.previewMaxWidthCh,
          vaultWidth: vaultResizer.width,
          inspectorWidth: inspectorResizer.width,
        })}
      >
        <VaultSidebar
          vault={workspace.vault}
          vaultStatus={workspace.status}
          sections={workspace.sections}
          activePath={workspace.activePath}
          searchQuery={workspace.searchQuery}
          isSearching={workspace.isSearching}
          searchResultsCount={workspace.searchResults.length}
          collapsedFolders={collapsedFolders}
          sidebarView={workspace.sidebarView}
          inboxNotes={workspace.inboxNotes}
          noteTypes={workspace.noteTypes}
          templatePaths={workspace.templatePaths}
          onSidebarViewChange={workspace.setSidebarView}
          onCollapsedFoldersChange={setCollapsedFolders}
          onChooseVault={sidebarActions.handleChooseVault}
          onCreateNote={sidebarActions.handleCreateNote}
          onCreateNoteOfType={sidebarActions.handleCreateNoteOfType}
          onOpenTemplatePicker={nativeReady && workspace.vault ? () => setTemplatePickerOpen(true) : undefined}
          onOpenObsidianImport={nativeReady && workspace.vault ? () => setObsidianImportOpen(true) : undefined}
          onRebuildIndex={sidebarActions.handleRebuildIndex}
          onOpenTags={sidebarActions.handleOpenTags}
          onOpenFilters={sidebarActions.handleOpenFilters}
          onOpenSavedViews={sidebarActions.handleOpenSavedViews}
          onOpenSnippets={sidebarActions.handleOpenSnippets}
          onOpenSettings={sidebarActions.handleOpenSettings}
          onCreateDailyNote={sidebarActions.handleCreateDailyNote}
          onCreateDailyNoteOffset={sidebarActions.handleCreateDailyNoteOffset}
          dailyNoteLabel={dailyNoteLabel}
          onOrganizeNote={sidebarActions.handleOrganizeNote}
          onSearchQueryChange={workspace.setVaultSearchQuery}
          onOpenNote={sidebarActions.handleOpenNote}
          onRenameNote={sidebarActions.handleRenameNote}
          onDeleteNote={sidebarActions.handleDeleteNote}
          onImportFiles={sidebarActions.handleImportFiles}
          recentNotes={recentNotes}
          readerDocumentPaths={readerDocumentPaths}
        />

        <WorkspacePanelResizer
          collapsed={chrome.vaultSidebarCollapsed}
          placeholderClassName="vault-collapsed-placeholder"
          dragging={vaultResizer.dragging}
          locked={chrome.layoutLocked}
          onPointerDown={vaultResizer.onHandlePointerDown}
          onPointerMove={vaultResizer.onHandlePointerMove}
          onPointerUp={vaultResizer.onHandlePointerUp}
          onPointerCancel={vaultResizer.onHandlePointerCancel}
          onDoubleClick={vaultResizer.onHandleDoubleClick}
        />

        <EditorWorkspace
          activePath={workspace.activePath}
          onOpenVault={() => void workspace.chooseVaultFolder()}
          hasOpenVault={Boolean(workspace.vault)}
          onCreateNote={sidebarActions.handleCreateNote}
          openTabs={workspace.openTabs}
          layoutLocked={chrome.layoutLocked}
          isNoteDirty={isNoteDirty}
          inboxPaths={inboxPaths}
          canReopenClosedTab={workspace.closedTabs.length > 0}
          onReopenClosedTab={workspace.reopenClosedTab}
          onTogglePinTab={workspace.togglePinTab}
          onOpenTab={(path) => void workspace.openNote(path)}
          onCloseTab={(path) => workspace.closeTab(path)}
          draftMarkdown={workspace.draftMarkdown}
          updateDraft={(markdown) => {
            journey.markFirstEdit()
            workspace.updateDraft(markdown)
          }}
          externalChangeConflict={workspace.externalChangeConflict}
          onReloadExternalChange={() => void workspace.reloadActiveNoteFromDisk()}
          onKeepEditingExternalChange={workspace.keepEditingAfterExternalChange}
          tocOpen={tocOpen}
          onToggleToc={() => setTocOpen((open) => !open)}
          tocEntries={tocEntries}
          visibleEditorLine={visibleEditorLine}
          onJumpToLine={(line) => workspace.jumpToOutlineHeading({ line, level: 1, label: `Line ${line}` })}
          frontmatterOpen={frontmatterOpen}
          onOpenFrontmatter={() => setFrontmatterOpen(true)}
          onOrganizeActive={() => {
            if (workspace.activePath) void workspace.organizeNote(workspace.activePath)
          }}
          onOpenCheatsheet={() => setCheatsheetOpen(true)}
          onOpenWritingTargets={() => setWritingTargetsOpen(true)}
          editorMode={editorMode}
          toggleEditorMode={toggleEditorMode}
          editorTheme={editorTheme}
          toggleEditorTheme={toggleEditorTheme}
          vimMode={vimMode}
          setVimMode={setVimMode}
          spellcheck={spellcheck && !hibernateSpellcheck}
          setSpellcheck={setSpellcheck}
          wysiwyg={wysiwyg}
          setWysiwyg={setWysiwyg}
          typewriter={typewriter}
          setTypewriter={setTypewriter}
          distractionFree={distractionFree}
          setDistractionFree={setDistractionFree}
          languageTool={languageTool && !hibernateSpellcheck}
          setLanguageTool={setLanguageTool}
          stickiesVisible={stickiesVisible}
          setStickiesVisible={setStickiesVisible}
          splitPreview={splitPreview}
          setSplitPreview={setSplitPreview}
          showSplitPreview={showSplitPreview}
          splitEditorWidth={splitEditorWidth}
          splitDragging={splitDragging}
          onSplitHandlePointerDown={onSplitHandlePointerDown}
          onSplitHandlePointerMove={onSplitHandlePointerMove}
          onSplitHandlePointerUp={onSplitHandlePointerUp}
          onSplitHandlePointerCancel={onSplitHandlePointerCancel}
          onSplitHandleDoubleClick={onSplitHandleDoubleClick}
          splitRatioPct={splitRatioPct}
          onSplitHandleNudge={onSplitHandleNudge}
          editorWorkspaceRef={editorWorkspaceRef}
          splitPreviewScrollRef={splitPreviewScrollRef}
          previewRef={previewRef}
          editorRef={editorRef}
          scrollSyncEnabled={scrollSyncEnabled}
          handleEditorLine={handleEditorLine}
          snippetContext={snippetContext}
          snippetCatalog={workspace.snippetCatalog}
          editorAutocompleteContext={editorAutocompleteContext}
          monacoCompletionContext={monacoCompletionContext}
          editorInsertRequest={workspace.editorInsertRequest}
          editorTransformRequest={workspace.editorTransformRequest}
          editorTypographyRequest={workspace.editorTypographyRequest}
          scrollToEditorLine={workspace.scrollToEditorLine}
          saveImageFromClipboard={nativeReady ? workspace.saveVaultImage : undefined}
          previewProps={previewBridge}
          insertSnippet={(content) => workspace.insertSnippet(content)}
          applyEditorTransform={workspace.applyEditorTransform}
          applyEditorTypography={workspace.applyEditorTypography}
          saveActiveNoteNow={() => void workspace.saveActiveNoteNow()}
          renameActiveNote={() => {
            setRenameTargetPath(workspace.activePath)
            setRenameOpen(true)
          }}
          isSaving={workspace.isSaving}
          lastSavedAt={workspace.lastSavedAt}
          draftWordCount={draftWordCount}
          wordCountDelta={wordCountDelta}
          charCount={charCount}
          readingMinutes={readingMinutes}
          brokenLinkCount={workspace.health?.broken_links ?? 0}
          citationCount={workspace.health?.unresolved_citations ?? 0}
          hasFrontmatter={workspace.draftMarkdown.startsWith('---')}
          onOpenPublishCenter={() => setPublishCenterOpen(true)}
          showFormatToolbar={chrome.showFormatToolbar}
          showEditorAssist={chrome.showEditorAssist}
          showEditorStatus={chrome.showEditorStatus}
          showLineNumbers={chrome.showLineNumbers}
          editorSurfaceMode={chrome.editorSurfaceMode}
          onEditorSurfaceModeChange={setEditorSurfaceMode}
        />

        <WorkspacePanelResizer
          collapsed={chrome.inspectorCollapsed}
          placeholderClassName="inspector-collapsed-placeholder"
          dragging={inspectorResizer.dragging}
          locked={chrome.layoutLocked}
          onPointerDown={inspectorResizer.onHandlePointerDown}
          onPointerMove={inspectorResizer.onHandlePointerMove}
          onPointerUp={inspectorResizer.onHandlePointerUp}
          onPointerCancel={inspectorResizer.onHandlePointerCancel}
          onDoubleClick={inspectorResizer.onHandleDoubleClick}
        />

        <InspectorRail
          railRef={inspectorPanelRef}
          activeMode={activeMode}
          onModeChange={setActiveMode}
          splitPreview={splitPreview}
          activePath={workspace.activePath}
          previewRef={previewRef}
          draftMarkdown={workspace.draftMarkdown}
          previewProps={previewBridge}
          inspectorOutline={workspace.inspectorOutline}
          inspectorLinks={workspace.inspectorLinks}
          backlinks={workspace.backlinks}
          jumpToOutlineHeading={workspace.jumpToOutlineHeading}
          openWikilinkTarget={(target) => void workspace.openWikilinkTarget(target)}
          openNote={(path) => void workspace.openNote(path)}
          onRenameSection={(label) =>
            workspace.activePath &&
            setSectionRenameTarget({
              path: workspace.activePath,
              label,
            })
          }
          onRenameBlock={(blockId) =>
            workspace.activePath &&
            setBlockRenameTarget({
              path: workspace.activePath,
              label: blockId,
            })
          }
          citationRows={citationRows}
          bibliography={bibliography}
          bibliographyKeys={bibliographyKeys}
          formatInline={formatInline}
          formatBibliography={formatBibliography}
          insertSnippet={(text) => workspace.insertSnippet(text)}
          logActivity={workspace.logActivity}
          setStatusDockToJobs={() => setStatusDockTab('jobs')}
          exportProfiles={workspace.exportProfiles}
          exportWithProfile={workspace.exportWithProfile}
          isExporting={workspace.isExporting}
          cancelExport={workspace.cancelExport}
          exportResult={workspace.exportResult}
          healthAction={healthAction}
          onOpenHealthDashboard={() => setHealthDashboardOpen(true)}
          healthMetrics={healthMetrics}
          health={workspace.health}
          isNoteDirty={isNoteDirty}
          inspectorPreset={inspectorPreset}
          onInspectorPresetChange={(preset) => {
            setInspectorPreset(preset)
          }}
          showInspectorHealth={chrome.showInspectorHealth}
          onOpenKnowledgeWorkbench={() => openKnowledgeWorkbench('repair')}
          onOpenPublishCenter={() => setPublishCenterOpen(true)}
          onOpenGraph={() => {
            setGraphOpen(true)
            void workspace.loadGraph(workspace.activePath)
          }}
          store={storeSurface.inspectorProps}
          plugins={{
            plugins: plugins.plugins,
            templatePacks: plugins.contributions.templatePacks,
            safeMode: plugins.snapshot.safeMode,
            healthDiagnostics: workspace.healthDiagnostics,
            marketplaceCatalog: plugins.marketplaceCatalog,
            activeVaultId: plugins.activeVaultId,
            pluginPolicies: plugins.pluginPolicies,
            onToggleSafeMode: plugins.setSafeMode,
            onTogglePlugin: plugins.setPluginEnabled,
            onReviewConsent: (pluginId, grantedPermissions, allowedVaultIds) =>
              plugins.setPluginConsent(pluginId, { grantedPermissions, allowedVaultIds }),
            onRevokeConsent: plugins.revokePluginConsent,
            onInstallMarketplace: (pluginId) => {
              void plugins.installFromMarketplace(pluginId).catch((error) => {
                workspace.logActivity('error', 'Plugin install failed', error instanceof Error ? error.message : String(error))
              })
            },
          }}
        />
      </section>

      {chrome.showWorkspaceFooter ? (
      <WorkspaceStatusFooter
        statusDockTab={statusDockTab}
        onStatusDockTabChange={setStatusDockTab}
        totalProblemCount={totalProblemCount}
        diagnosticsPanelProps={{
          issues: workspace.healthDiagnostics?.issues ?? [],
          gitConflicts: workspace.gitStatus?.conflicted_files ?? [],
          externalChange: workspace.externalChangeConflict,
          clientEvents: diagnostics.optIn ? diagnostics.events : [],
          editorLintMessages,
          activeNotePath: workspace.activePath,
          onClose: () => setStatusDockTab('output'),
          onOpenIssue: (path, line) => {
            void workspace.openNoteAt(path, line)
            setStatusDockTab('output')
          },
          onOpenEditorLint: (line) => {
            workspace.jumpToOutlineHeading({ line, level: 1, label: `Line ${line}` })
            setStatusDockTab('output')
          },
          onGenerateLinkReferences: workspace.generateLinkReferences,
          onReloadExternalChange: () => void workspace.reloadActiveNoteFromDisk(),
          onKeepEditingExternalChange: workspace.keepEditingAfterExternalChange,
          onRebuildIndex: () => void workspace.rebuildIndex(),
          onFixVaultLint: () => void workspace.fixVaultLint(),
          isFixingVaultLint: workspace.isFixingVaultLint,
        }}
        activity={workspace.activityLog}
        searchResults={workspace.searchResults}
        searchQuery={workspace.searchQuery}
        isSearching={workspace.isSearching}
        exportResult={workspace.exportResult}
        exportHistory={workspace.exportHistory}
        isExporting={workspace.isExporting}
        isIndexing={workspace.status === 'indexing'}
        graphProgress={workspace.graphProgress}
        onOpenNote={(path) => void workspace.openNote(path)}
        onCancelExport={() => void workspace.cancelExport()}
        workspaceStatus={workspace.status}
        rebuildSummary={workspace.rebuild}
        lastRebuildMs={workspace.lastRebuildMs}
        noteCount={workspace.noteCount}
        health={workspace.health}
        vault={workspace.vault}
        diagnosticsOptIn={diagnostics.optIn}
        onDiagnosticsOptInChange={diagnostics.setOptIn}
        timeToFirstEditMs={journey.timeToFirstEditMs}
        timeToFirstExportMs={journey.timeToFirstExportMs}
        hibernateGraph={hibernateGraph}
        onHibernateGraphChange={setHibernateGraph}
        hibernateMcp={hibernateMcp}
        onHibernateMcpChange={setHibernateMcp}
        hibernateWatcher={hibernateWatcher}
        onHibernateWatcherChange={setHibernateWatcher}
        hibernateGit={hibernateGit}
        onHibernateGitChange={setHibernateGit}
        hibernateSpellcheck={hibernateSpellcheck}
        onHibernateSpellcheckChange={setHibernateSpellcheck}
      />
      ) : null}

      <MobileWorkspaceNav
        activePane={mobilePane}
        workspaceMode={workspaceMode}
        onSelectPane={(pane) => {
          setMobilePane(pane)
          if (pane === 'inspector') setActiveMode('inspector')
        }}
        onOpenCommand={() => commandPalette.setOpen(true)}
        onOpenKnowledgeWorkbench={() => openKnowledgeWorkbench('repair')}
        onOpenPublishCenter={() => setPublishCenterOpen(true)}
        onOpenHealth={() => setHealthDashboardOpen(true)}
        onOpenMcp={() => setMcpPanelOpen(true)}
      />

      <WorkspacePanelLaunchers
        workspace={workspace}
        plugins={plugins}
        nativeReady={nativeReady}
        canvasOpen={canvasOpen}
        readerOpen={readerOpen}
        readerFilePath={readerFilePath}
        tasksOpen={tasksOpen}
        kanbanOpen={kanbanOpen}
        readerPresentation={panelPresentation}
        onCloseCanvas={() => setCanvasOpen(false)}
        onCloseReader={() => {
          setReaderOpen(false)
          setReaderFilePath(null)
        }}
        onCloseTasks={() => setTasksOpen(false)}
        onCloseKanban={() => setKanbanOpen(false)}
      />

      {commandPalette.open ? (
        <CommandPalette
          onClose={() => commandPalette.setOpen(false)}
          commands={paletteCommands}
          searchNotes={workspace.vault ? (query) => indexerSearch(query, 12) : undefined}
          onOpenNote={(path) => void workspace.openNote(path)}
        />
      ) : null}

      {graphOpen && (
        <ErrorBoundary
          name="graph-panel"
          resetKeys={[workspace.activePath]}
          fallback={<PanelErrorFallback title="The graph" onDismiss={() => setGraphOpen(false)} />}
        >
        <Suspense fallback={<PanelFallback />}>
          <GraphPanel
          graph={workspace.graph}
          focusPath={workspace.activePath}
          graphGroups={workspace.vaultConfig.graph_groups ?? []}
          vaultOpen={Boolean(workspace.vault)}
          vaultId={workspace.vault?.id}
          depth={graphDepth}
          fullVault={graphFullVault}
          onDepthChange={setGraphDepth}
          onRefresh={(fullVault) => {
            setGraphFullVault(fullVault)
            void workspace.loadGraph(fullVault ? null : workspace.activePath, {
              depth: graphDepth,
              fullVault,
            })
          }}
          onSelectNode={(path) => {
            void workspace.openNote(path)
            void workspace.loadGraph(path, { depth: graphDepth, fullVault: graphFullVault })
          }}
          onClose={() => setGraphOpen(false)}
          onOpenWorkbench={() => {
            setGraphOpen(false)
            openKnowledgeWorkbench('discover')
          }}
          hibernated={hibernateGraph}
          onToggleHibernate={() => setHibernateGraph((prev) => !prev)}
        />
        </Suspense>
        </ErrorBoundary>
      )}

      {mcpPanelOpen && (
        <ErrorBoundary
          name="mcp-panel"
          fallback={<PanelErrorFallback title="The MCP panel" onDismiss={() => setMcpPanelOpen(false)} />}
        >
        <Suspense fallback={<PanelFallback />}>
          <McpPanel
          mode={mcp.mode}
          tools={mcp.tools}
          audit={mcp.audit}
          drafts={mcp.drafts}
          lastResult={mcp.lastResult}
          activePath={workspace.activePath}
          editorTheme={editorTheme}
          presentation={panelPresentation}
          onClose={() => setMcpPanelOpen(false)}
          onModeChange={mcp.setMode}
          onResetPermissions={mcp.resetPermissions}
          readNoteContent={async (path) => (await vaultReadNote(path)).markdown}
          onInvoke={(toolName, input) => {
            void mcp.invokeTool(toolName, input)
          }}
          onApproveDraft={(patchId) => {
            void mcp.approveDraft(patchId).then((result) => {
              if (result?.ok) {
                void workspace.refreshHealth()
                if (workspace.activePath) {
                  void workspace.openNote(workspace.activePath)
                }
              }
            })
          }}
          onRejectDraft={mcp.rejectDraft}
          aiEnabled={ai.enabled}
          onGenerateDraft={() => {
            void promptText({
              title: 'Assistant draft',
              label: 'Describe the edit you want the assistant to draft',
              defaultValue: '',
              submitLabel: 'Draft',
            }).then((prompt) => {
              if (!prompt || !workspace.activePath) return
              void ai.proposeDraftFromPrompt(prompt, workspace.draftMarkdown).then((proposed) => {
                void mcp.proposeDraftForActiveNote(proposed, `AI draft: ${prompt}`)
              })
            })
          }}
        />
        </Suspense>
        </ErrorBoundary>
      )}

      {gitPanelOpen && (
        <ErrorBoundary
          name="git-panel"
          fallback={<PanelErrorFallback title="The Git panel" onDismiss={() => setGitPanelOpen(false)} />}
        >
        <Suspense fallback={<PanelFallback />}>
          <GitPanel
          status={workspace.gitStatus}
          statusError={workspace.gitStatusError}
          isStatusLoading={workspace.isGitStatusLoading}
          activePath={workspace.activePath}
          isBusy={workspace.isGitBusy}
          presentation={panelPresentation}
          onClose={() => setGitPanelOpen(false)}
          onRefresh={() => void workspace.refreshGit()}
          onCommit={(files, message) => {
            void workspace.commitFiles(files, message)
          }}
          onPull={() => void workspace.pullRemote()}
          onPush={() => void workspace.pushRemote()}
          onResolveConflict={(path) => setConflictPath(path)}
          onOpenNote={(path) => void workspace.openNote(path)}
          readNoteAtHead={async (path) => {
            try {
              return await gitShowHeadFile(path)
            } catch {
              return null
            }
          }}
          readNoteWorking={async (path) =>
            path === workspace.activePath ? workspace.draftMarkdown : (await vaultReadNote(path)).markdown
          }
        />
        </Suspense>
        </ErrorBoundary>
      )}

      {writingTargetsOpen && (
        <ErrorBoundary
          name="writing-targets-panel"
          autoRetryPanelFallback={false}
          fallback={<PanelErrorFallback title="Writing targets" onDismiss={() => setWritingTargetsOpen(false)} />}
        >
        <Suspense fallback={<PanelFallback />}>
        <WritingTargetsPanel
          dailyTarget={workspace.vaultConfig.writing_targets?.daily_words ?? 500}
          wordsToday={draftWordCount}
          onDailyTargetChange={(value) => {
            workspace.setVaultConfig((current) => ({
              ...current,
              writing_targets: {
                ...current.writing_targets,
                daily_words: value,
                history_path: current.writing_targets?.history_path ?? '.scriptor/stats-history.json',
              },
            }))
            if (nativeReady) {
              void vaultSaveConfig({
                ...workspace.vaultConfig,
                writing_targets: {
                  ...workspace.vaultConfig.writing_targets,
                  daily_words: value,
                  history_path: workspace.vaultConfig.writing_targets?.history_path ?? '.scriptor/stats-history.json',
                },
              })
            }
          }}
          onClose={() => {
            recordWritingSession(draftWordCount)
            setWritingTargetsOpen(false)
          }}
        />
        </Suspense>
        </ErrorBoundary>
      )}

      {conflictPath && conflictSource ? (
        <ConflictResolverSurface
          conflictPath={conflictPath}
          conflictSource={conflictSource}
          conflictBasePreview={conflictBasePreview}
          isBusy={workspace.isGitBusy}
          onClose={() => setConflictPath(null)}
          onResolved={() => void workspace.refreshGit()}
        />
      ) : null}

      {healthDashboardOpen && (
        <ErrorBoundary
          name="vault-health-panel"
          fallback={<PanelErrorFallback title="Vault health" onDismiss={() => setHealthDashboardOpen(false)} />}
        >
        <Suspense fallback={<PanelFallback />}>
          <VaultHealthDashboard
          diagnostics={workspace.healthDiagnostics}
          inspectorWidgets={plugins.contributions.inspectorWidgets}
          vaultHealthChecks={plugins.contributions.vaultHealthChecks}
          onClose={() => setHealthDashboardOpen(false)}
          onOpenIssue={(path) => {
            void workspace.openNote(path)
            setHealthDashboardOpen(false)
          }}
          onRebuildIndex={() => void workspace.rebuildIndex()}
          onFixVaultLint={() => void workspace.fixVaultLint()}
          onOpenWorkbench={() => {
            setHealthDashboardOpen(false)
            openKnowledgeWorkbench('repair')
          }}
          onGenerateLinkReferences={() => {
            workspace.generateLinkReferences()
            setStatusDockTab('problems')
          }}
          isFixingVaultLint={workspace.isFixingVaultLint}
        />
        </Suspense>
        </ErrorBoundary>
      )}

      {frontmatterOpen && workspace.activePath ? (
        <FrontmatterInspector
          key={`${workspace.activePath}:${workspace.activeNote?.metadata.content_hash ?? ''}`}
          path={workspace.activePath}
          fields={parseSimpleFrontmatter(workspace.draftMarkdown)}
          onClose={() => setFrontmatterOpen(false)}
          onSaved={() => void workspace.reloadActiveNoteFromDisk()}
        />
      ) : null}

      {settingsOpen && (
        <ErrorBoundary
          name="settings-panel"
          fallback={<PanelErrorFallback title="Settings" onDismiss={() => setSettingsOpen(false)} />}
        >
        <Suspense fallback={<PanelFallback />}>
          <SettingsPanel
          vaultOpen={Boolean(workspace.vault)}
          systemInfo={systemInfo}
          diagnosticsOptIn={diagnostics.optIn}
          onDiagnosticsOptInChange={diagnostics.setOptIn}
          aiProvider={ai.provider}
          aiEndpoint={ai.endpoint}
          aiHasApiKey={ai.hasApiKey}
          aiBusy={ai.busy}
          aiLastError={ai.lastError}
          aiHttpWarning={ai.httpWarning}
          onAiProviderChange={ai.setProvider}
          onAiEndpointChange={ai.setEndpoint}
          onAiSaveApiKey={(secret) => {
            void ai.saveApiKey(secret)
          }}
          onAiClearApiKey={() => {
            void ai.clearApiKey()
          }}
          nativeReady={nativeReady}
          headlessEngine={headlessEngine}
          onHeadlessEngineChange={setHeadlessEngine}
          daemonVersion={daemonVersion}
          daemonError={daemonError}
          onRefreshDaemon={() => {
            void refreshDaemonStatus()
          }}
          onStartDaemon={() => {
            void startDaemon()
          }}
          activePath={workspace.activePath}
          onConfigSaved={() => {
            void workspace.rebuildIndex()
            void workspace.refreshVaultConfig()
          }}
          onClose={() => setSettingsOpen(false)}
          workspaceMode={workspaceMode}
          workspaceLayouts={layouts}
          onSaveWorkspaceLayout={saveCurrentAsLayout}
          onResetWorkspaceLayout={resetWorkspaceLayout}
          panelPresentation={panelPresentation}
          onPanelPresentationChange={setPanelPresentation}
          journey={journey.snapshot}
          timeToFirstEditMs={journey.timeToFirstEditMs}
          timeToFirstExportMs={journey.timeToFirstExportMs}
          hibernateGraph={hibernateGraph}
          onHibernateGraphChange={setHibernateGraph}
          hibernateMcp={hibernateMcp}
          onHibernateMcpChange={setHibernateMcp}
          hibernateWatcher={hibernateWatcher}
          onHibernateWatcherChange={setHibernateWatcher}
          hibernateGit={hibernateGit}
          onHibernateGitChange={setHibernateGit}
          hibernateSpellcheck={hibernateSpellcheck}
          onHibernateSpellcheckChange={setHibernateSpellcheck}
          onResetJourney={journey.reset}
          workspaceChrome={chrome}
          onPatchWorkspaceChrome={patchChrome}
          onResetWorkspaceChrome={resetChrome}
          theme={theme}
          onThemeChange={setTheme}
          onReplayOnboarding={onboarding.replayOnboarding}
          spellcheckLocale={spellcheckLocale}
          onSpellcheckLocaleChange={setSpellcheckLocale}
          languageToolEndpoint={languageToolEndpoint}
          onLanguageToolEndpointChange={setLanguageToolEndpoint}
          onOpenSupport={() => {
            setSettingsOpen(false)
            setSupportOpen(true)
          }}
        />
        </Suspense>
        </ErrorBoundary>
      )}

      <CapabilityWorkflowOverlays
        templatePickerOpen={templatePickerOpen}
        obsidianImportOpen={obsidianImportOpen}
        pluginManagerOpen={pluginManagerOpen}
        templates={workspace.templatePaths}
        onCloseTemplatePicker={() => setTemplatePickerOpen(false)}
        onCloseObsidianImport={() => setObsidianImportOpen(false)}
        onClosePluginManager={() => setPluginManagerOpen(false)}
        theme={theme}
        onThemeChange={setTheme}
        onOpenPluginMarketplace={() => {
          setPluginManagerOpen(false)
          patchChrome({ inspectorCollapsed: false })
          setActiveMode('plugins')
        }}
        onCreateBlankNote={sidebarActions.handleCreateNote}
        onCreateFromTemplate={sidebarActions.handleCreateNoteFromTemplate}
        onObsidianImported={(notesImported) => {
          showToast(`Imported ${notesImported} note${notesImported === 1 ? '' : 's'} from Obsidian`)
          void workspace.refreshVault()
        }}
      />

      {bibliographyOpen && (
        <ErrorBoundary
          name="bibliography-panel"
          fallback={<PanelErrorFallback title="The bibliography" onDismiss={() => setBibliographyOpen(false)} />}
        >
        <Suspense fallback={<PanelFallback />}>
          <BibliographyPanel
          entries={bibliography}
          bibliographyPath={workspace.vaultConfig.export.bibliography_path}
          onClose={() => setBibliographyOpen(false)}
          onInsertCitation={(key) => {
            workspace.insertSnippet(`[@${key}] `)
            setBibliographyOpen(false)
          }}
          onImportBibliography={
            nativeReady
              ? async (files) => {
                  const bibPath = workspace.vaultConfig.export.bibliography_path || 'references.bib'
                  const file = files[0]
                  if (!file) return
                  const bytes = Array.from(new Uint8Array(await file.arrayBuffer()))
                  await vaultSaveAsset(bibPath, bytes)
                  await indexerApplyFilesystemChanges([bibPath])
                  showToast(`Bibliography saved to ${bibPath}`)
                  void refreshBibliography()
                }
              : undefined
          }
        />
        </Suspense>
        </ErrorBoundary>
      )}

      {knowledgeWorkbenchOpen && (
        <ErrorBoundary
          name="knowledge-workbench"
          resetKeys={[workspace.activePath]}
          fallback={<PanelErrorFallback title="The workbench" onDismiss={() => setKnowledgeWorkbenchOpen(false)} />}
        >
        <Suspense fallback={<PanelFallback />}>
          <KnowledgeWorkbench
            key={knowledgeWorkbenchTab}
            vaultOpen={Boolean(workspace.vault)}
            vaultId={workspace.vault?.id}
            initialTab={knowledgeWorkbenchTab}
            activePath={workspace.activePath}
            onClose={() => setKnowledgeWorkbenchOpen(false)}
            onOpenNote={(path) => void workspace.openNote(path)}
            onOpenGraph={() => {
              setKnowledgeWorkbenchOpen(false)
              setGraphOpen(true)
              void workspace.loadGraph(workspace.activePath)
            }}
            onCreateNoteFromWikilink={(target) => {
              void workspace.createNoteFromWikilink(target)
              setKnowledgeWorkbenchOpen(false)
            }}
            onInsertTag={(tag) => workspace.insertSnippet(`#${tag} `)}
            onRenameTag={(tag) => {
              setTagRenameTag(tag)
              workspace.clearLinkRewritePreview()
            }}
            promptText={promptText}
          />
        </Suspense>
        </ErrorBoundary>
      )}

      {publishCenterOpen && (
        <ErrorBoundary
          name="publish-center"
          resetKeys={[workspace.activePath]}
          fallback={<PanelErrorFallback title="Publish Center" onDismiss={() => setPublishCenterOpen(false)} />}
        >
        <Suspense fallback={<PanelFallback />}>
          <PublishCenter
            activePath={workspace.activePath}
            draftMarkdown={workspace.draftMarkdown}
            previewProps={previewBridge}
            exportProfiles={workspace.exportProfiles}
            exportHistory={workspace.exportHistory}
            exportResult={workspace.exportResult}
            isExporting={workspace.isExporting}
            nativeReady={nativeReady}
            onClose={() => setPublishCenterOpen(false)}
            onExport={(profileId, dryRun) => {
              setStatusDockTab('jobs')
              void workspace.exportWithProfile(profileId, dryRun)
            }}
            onCancelExport={() => void workspace.cancelExport()}
            publishPlan={publishPlan}
            applyingPlan={publishApplying}
            publishRequireOptIn
            onPlanStarlight={() => void publishStarlight()}
            onReplanStarlight={() => void publishStarlight(publishOutputPath ?? undefined)}
            onApplyPlan={(selectedPaths, deleteOrphans) => {
              void applyStarlightPlan(selectedPaths, deleteOrphans)
            }}
          />
        </Suspense>
        </ErrorBoundary>
      )}

      {snippetsOpen && (
        <ErrorBoundary
          name="snippets-panel"
          fallback={<PanelErrorFallback title="Snippets" onDismiss={() => setSnippetsOpen(false)} />}
        >
        <Suspense fallback={<PanelFallback />}>
          <SnippetsPanelLazy
          vaultOpen={Boolean(workspace.vault)}
          onClose={() => setSnippetsOpen(false)}
          onSaved={() => void workspace.refreshVaultSnippets()}
        />
        </Suspense>
        </ErrorBoundary>
      )}

      {cheatsheetOpen ? (
        <ErrorBoundary
          name="cheatsheet-panel"
          autoRetryPanelFallback={false}
          fallback={<PanelErrorFallback title="Cheatsheet" onDismiss={() => setCheatsheetOpen(false)} />}
        >
        <Suspense fallback={<PanelFallback />}>
          <CheatsheetPanel onClose={() => setCheatsheetOpen(false)} />
        </Suspense>
        </ErrorBoundary>
      ) : null}
      {onboarding.onboardingOpen ? (
        <ErrorBoundary
          name="onboarding-tour"
          autoRetryPanelFallback={false}
          fallback={<PanelErrorFallback title="Onboarding tour" onDismiss={onboarding.completeOnboarding} />}
        >
        <Suspense fallback={<PanelFallback />}>
          <OnboardingTour
            onComplete={onboarding.completeOnboarding}
            onOpenCheatsheet={() => {
              onboarding.completeOnboarding()
              setCheatsheetOpen(true)
            }}
          />
        </Suspense>
        </ErrorBoundary>
      ) : null}

      {supportOpen ? (
        <ErrorBoundary
          name="support-panel"
          autoRetryPanelFallback={false}
          fallback={<PanelErrorFallback title="Support" onDismiss={() => setSupportOpen(false)} />}
        >
        <Suspense fallback={<PanelFallback />}>
          <SupportPanel onClose={() => setSupportOpen(false)} />
        </Suspense>
        </ErrorBoundary>
      ) : null}

      <QuickCaptureWorkspaceLayer
        isOpen={quickCaptureOpen}
        stickiesVisible={stickiesVisible}
        presentation={panelPresentation}
        workspace={workspace}
        workspaceStore={workspaceStore}
        onClose={() => setQuickCaptureOpen(false)}
      />

      <WorkspacePortalOverlays
        workspace={workspace}
        workspaceStore={workspaceStore}
        portalOpen={portalOpen}
        noteHistoryOpen={noteHistoryOpen}
        panelPresentation={panelPresentation === 'dock-right' ? 'dock-right' : 'modal'}
        onClosePortal={() => setPortalOpen(false)}
        onCloseNoteHistory={() => setNoteHistoryOpen(false)}
      />

      <WorkspaceRenameDialogs
        workspace={workspace}
        tag={tagRenameTag}
        block={blockRenameTarget}
        section={sectionRenameTarget}
        noteOpen={renameOpen}
        notePath={renameTargetPath}
        setTag={setTagRenameTag}
        setBlock={setBlockRenameTarget}
        setSection={setSectionRenameTarget}
        setNoteOpen={setRenameOpen}
        setNotePath={setRenameTargetPath}
        closeKnowledgeWorkbench={() => setKnowledgeWorkbenchOpen(false)}
      />

      {promptRequest ? (
        <TextPromptDialog
          request={promptRequest}
          onSubmit={submitPrompt}
          onCancel={cancelPrompt}
        />
      ) : null}

      {perfHudOpen ? (
        <ErrorBoundary
          name="perf-hud"
          autoRetryPanelFallback={false}
          fallback={<PanelErrorFallback title="Performance HUD" onDismiss={() => setPerfHudOpen(false)} />}
        >
        <Suspense fallback={<PanelFallback />}>
          <PerfHudOverlay metrics={perfMetrics.metrics} />
        </Suspense>
        </ErrorBoundary>
      ) : null}
      {toastMessage ? (
        <AppToastRegion>
          <AppToast message={toastMessage} onDismiss={dismissToast} />
        </AppToastRegion>
      ) : null}
    </main>
  )
}

export default App
