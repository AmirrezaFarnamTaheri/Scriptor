import { useState, useMemo, useEffect, useRef, useCallback, lazy, Suspense } from 'react'
import { countCharacters, countWords, type EditorThemeId, type MarkdownEditorHandle, type TocEntry, loadHunspellDictionary } from '@scriptor/editor'
import { applyRendererExtensions, type MarkdownPreviewHandle } from '@scriptor/renderer'

import { useEditorLintProblems } from './hooks/useEditorLintProblems'
import { plantumlRender } from './bridge/commands'
import { isNativeBridgeAvailable } from './bridge/platform'
import { VaultSidebar } from './components/app/VaultSidebar'
import { buildPaletteCommands } from './lib/buildPaletteCommands'
import { planDailyNotePreview } from './lib/knowledge/templates'
import { generateTocFromMarkdown } from './lib/tocFromMarkdown'
import { AppTopBar } from './components/shell/AppTopBar'
import { EditorWorkspace } from './components/shell/EditorWorkspace'
import { InspectorRail } from './components/shell/InspectorRail'
import { WorkspaceStatusFooter } from './components/shell/WorkspaceStatusFooter'
import { MobileWorkspaceNav } from './components/shell/MobileWorkspaceNav'
import { useTextPrompt } from './hooks/useTextPrompt'
import { TextPromptDialog } from './components/TextPromptDialog'
import { useRecentVaults } from './hooks/useRecentVaults'
import { RenameNoteDialog } from './components/RenameNoteDialog'
import { RenameBlockDialog } from './components/RenameBlockDialog'
import { RenameSectionDialog } from './components/RenameSectionDialog'
import { RenameTagDialog } from './components/RenameTagDialog'
import { CommandPalette } from './components/CommandPalette'
import { AppToast } from './components/AppToast'
import type { SystemInfoSnapshot } from './components/SettingsPanel'
import { type StatusDockTab } from './components/StatusDockPanel'
import { ConflictResolverModal } from './components/ConflictResolverModal'
import { FrontmatterInspector } from './components/FrontmatterInspector'
import { CheatsheetPanel } from './components/CheatsheetPanel'
import { SupportPanel } from './components/SupportPanel'
import { StickyNotesLayer } from './components/portal/StickyNotesLayer'
import { WritingTargetsPanel, recordWritingSession } from './components/WritingTargetsPanel'
import type { KnowledgeWorkbenchTab } from './components/KnowledgeWorkbench'
import { useCommandPalette } from './hooks/useCommandPalette'
import { useAiProvider } from './hooks/useAiProvider'
import { useDiagnosticsSettings } from './hooks/useDiagnosticsSettings'
import { useEscapeToClose } from './hooks/useEscapeToClose'
import { useMcpRuntime } from './hooks/useMcpRuntime'
import { useAppTheme } from './hooks/useAppTheme'
import { usePluginRegistry } from './hooks/usePluginRegistry'
import { useVaultWorkspace } from './hooks/useVaultWorkspace'
import { useWorkspaceStore } from './hooks/useWorkspaceStore'
import { usePortalShortcuts } from './hooks/usePortalShortcuts'
import { useEditorPreviewScrollSync } from './hooks/useEditorPreviewScrollSync'
import { usePersistedBoolean } from './hooks/usePersistedBoolean'
import { useAppToast } from './hooks/useAppToast'
import { useHeadlessEngine } from './hooks/useHeadlessEngine'
import { usePreviewBridge } from './hooks/usePreviewBridge'
import { useScreenshotAutoOpen } from './screenshot/useScreenshotAutoOpen'
import { useSplitPaneResize } from './hooks/useSplitPaneResize'
import { useCiteprocPreview } from './hooks/useCiteprocPreview'
import { useWorkspaceMode, usePersistedMobilePane, type WorkspaceMode } from './hooks/useWorkspaceMode'
import { useWorkspaceChrome } from './hooks/useWorkspaceChrome'
import { useWorkspaceLayout } from './hooks/useWorkspaceLayout'
import { runPluginCommand } from './lib/runPluginCommand'
import { vaultDeleteNote, vaultListRecentNotes } from './bridge/commands'
import { useJourneyMetrics } from './hooks/useJourneyMetrics'
import { usePanelPresentation } from './hooks/usePanelPresentation'
import { extractPandocCitationKeys } from './lib/citationExtract'
import {
  gitReadConflictMarkers,
  gitResolveConflict,
  gitShowHeadFile,
  indexerExecuteDql,
  indexerListBibliography,
  indexerListTags,
  indexerResolveWikilink,
  systemInfo as fetchSystemInfo,
  vaultReadNote,
  vaultSaveNote,
  vaultSaveConfig,
  codeChunkRun,
  vaultPublishStarlight,
} from './bridge/commands'
import type { BibliographyEntry } from './types/vault'
import { BRAND_WORKSPACE_LABEL } from './brand/identity'
import { editorFontFamilyCss } from './brand/support'
import { readInspectorPreset, writeInspectorPreset, type InspectorPreset } from './lib/inspectorPresets'
import './App.css'
import './styles/motion.css'

const CanvasPanel = lazy(() => import('./components/CanvasPanel').then((module) => ({ default: module.CanvasPanel })))
const GraphPanel = lazy(() => import('./components/GraphPanel').then((module) => ({ default: module.GraphPanel })))
const GitPanel = lazy(() => import('./components/GitPanel').then((module) => ({ default: module.GitPanel })))
const McpPanel = lazy(() => import('./components/McpPanel').then((module) => ({ default: module.McpPanel })))
const SettingsPanel = lazy(() => import('./components/SettingsPanel').then((module) => ({ default: module.SettingsPanel })))
const KnowledgeWorkbench = lazy(() =>
  import('./components/KnowledgeWorkbench').then((module) => ({ default: module.KnowledgeWorkbench })),
)
const PublishCenter = lazy(() => import('./components/PublishCenter').then((module) => ({ default: module.PublishCenter })))
const VaultHealthDashboard = lazy(() =>
  import('./components/VaultHealthDashboard').then((module) => ({ default: module.VaultHealthDashboard })),
)
const PortalPanel = lazy(() => import('./components/portal/PortalPanel').then((module) => ({ default: module.PortalPanel })))
const QuickCapturePanel = lazy(() =>
  import('./components/portal/QuickCapturePanel').then((module) => ({ default: module.QuickCapturePanel })),
)
const BibliographyPanel = lazy(() =>
  import('./components/BibliographyPanel').then((module) => ({ default: module.BibliographyPanel })),
)
const SnippetsPanelLazy = lazy(() => import('./components/SnippetsPanel').then((module) => ({ default: module.SnippetsPanel })))

function PanelFallback() {
  return <div className="panel-loading" role="status">Loading panel…</div>
}

function parseSimpleFrontmatter(markdown: string): Record<string, string> {
  const match = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---/)
  if (!match) return {}
  const fields: Record<string, string> = {}
  for (const line of match[1].split('\n')) {
    const kv = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/)
    if (kv) fields[kv[1]] = kv[2]
  }
  return fields
}

function App() {
  const [activeMode, setActiveMode] = useState<'inspector' | 'preview' | 'plugins'>('inspector')
  const [graphOpen, setGraphOpen] = useState(false)
  const [canvasOpen, setCanvasOpen] = useState(false)
  const [renameOpen, setRenameOpen] = useState(false)
  const [renameTargetPath, setRenameTargetPath] = useState<string | null>(null)
  const [gitPanelOpen, setGitPanelOpen] = useState(false)
  const [healthDashboardOpen, setHealthDashboardOpen] = useState(false)
  const [statusDockTab, setStatusDockTab] = useState<StatusDockTab>('output')
  const [mcpPanelOpen, setMcpPanelOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [knowledgeWorkbenchOpen, setKnowledgeWorkbenchOpen] = useState(false)
  const [knowledgeWorkbenchTab, setKnowledgeWorkbenchTab] = useState<KnowledgeWorkbenchTab>('repair')
  const [publishCenterOpen, setPublishCenterOpen] = useState(false)
  const [tagRenameTag, setTagRenameTag] = useState<string | null>(null)
  const [sectionRenameTarget, setSectionRenameTarget] = useState<{ path: string; label: string } | null>(
    null,
  )
  const [blockRenameTarget, setBlockRenameTarget] = useState<{ path: string; label: string } | null>(null)
  const [recentNotes, setRecentNotes] = useState<Array<{ path: string; title: string }>>([])
  const [snippetsOpen, setSnippetsOpen] = useState(false)
  const [cheatsheetOpen, setCheatsheetOpen] = useState(false)
  const [supportOpen, setSupportOpen] = useState(false)
  const [portalOpen, setPortalOpen] = useState(false)
  const [quickCaptureOpen, setQuickCaptureOpen] = useState(false)
  const [stickiesVisible, setStickiesVisible] = useState(true)
  const [bibliographyOpen, setBibliographyOpen] = useState(false)
  const [collapsedFolders, setCollapsedFolders] = useState<Record<string, boolean>>({})
  const [graphDepth, setGraphDepth] = useState(2)
  const [graphFullVault, setGraphFullVault] = useState(false)
  const { mobilePane, setMobilePane } = usePersistedMobilePane('editor')
  const { theme, toggleTheme } = useAppTheme()
  const { mode: workspaceMode, setMode: setWorkspaceMode } = useWorkspaceMode()
  const { chrome, patchChrome, resetChrome } = useWorkspaceChrome()
  const { layouts, saveCurrentAsLayout, resetLayout } = useWorkspaceLayout()
  const journey = useJourneyMetrics()
  const { presentation: panelPresentation, setPresentation: setPanelPresentation } = usePanelPresentation()
  const [inspectorPreset, setInspectorPreset] = useState<InspectorPreset>(() => readInspectorPreset())
  const [bibliographyRaw, setBibliographyRaw] = useState<BibliographyEntry[]>([])
  const [systemInfo, setSystemInfo] = useState<SystemInfoSnapshot | null>(null)
  const editorRef = useRef<MarkdownEditorHandle | null>(null)
  const previewRef = useRef<MarkdownPreviewHandle | null>(null)
  const inspectorPanelRef = useRef<HTMLElement | null>(null)
  const splitPreviewScrollRef = useRef<HTMLElement | null>(null)
  const editorWorkspaceRef = useRef<HTMLDivElement | null>(null)
  const [splitPreview, setSplitPreview] = usePersistedBoolean('scriptor:split-preview', false)
  const [vimMode, setVimMode] = usePersistedBoolean('scriptor:vim-mode', false)
  const [spellcheck, setSpellcheck] = usePersistedBoolean('scriptor:spellcheck', false)
  const [wysiwyg, setWysiwyg] = usePersistedBoolean('scriptor:wysiwyg', false)
  const [typewriter, setTypewriter] = usePersistedBoolean('scriptor:typewriter', false)
  const [distractionFree, setDistractionFree] = usePersistedBoolean('scriptor:distraction-free', false)
  const [editorMode, setEditorMode] = useState<'codemirror' | 'monaco'>(() => {
    try {
      return window.localStorage.getItem('scriptor:editor-mode') === 'monaco' ? 'monaco' : 'codemirror'
    } catch {
      return 'codemirror'
    }
  })
  const [editorTheme, setEditorTheme] = useState<EditorThemeId>(() => {
    try {
      return window.localStorage.getItem('scriptor:editor-theme') === 'dark' ? 'dark' : 'light'
    } catch {
      return 'light'
    }
  })
  const toggleEditorMode = useCallback(() => {
    setEditorMode((current) => {
      const next = current === 'codemirror' ? 'monaco' : 'codemirror'
      try {
        window.localStorage.setItem('scriptor:editor-mode', next)
      } catch {
        /* ignore */
      }
      return next
    })
  }, [])
  const toggleEditorTheme = useCallback(() => {
    setEditorTheme((current) => {
      const next = current === 'light' ? 'dark' : 'light'
      try {
        window.localStorage.setItem('scriptor:editor-theme', next)
      } catch {
        /* ignore */
      }
      return next
    })
  }, [])
  const [languageTool, setLanguageTool] = usePersistedBoolean('scriptor:language-tool', false)
  const { toastMessage, showToast, dismissToast } = useAppToast()
  const [tocOpen, setTocOpen] = useState(false)
  const [writingTargetsOpen, setWritingTargetsOpen] = useState(false)
  const [conflictPath, setConflictPath] = useState<string | null>(null)
  const [conflictPreview, setConflictPreview] = useState<string[]>([])
  const [frontmatterOpen, setFrontmatterOpen] = useState(false)
  const [vaultTags, setVaultTags] = useState<string[]>([])
  const [visibleEditorLine, setVisibleEditorLine] = useState(1)
  const commandPalette = useCommandPalette()
  const workspace = useVaultWorkspace({
    onSearchComplete: (hits) => {
      if (hits.length > 0) {
        setStatusDockTab('search')
      }
    },
  })
  useScreenshotAutoOpen(workspace.openVaultAt, workspace.status)
  const { promptRequest, promptText, submitPrompt, cancelPrompt } = useTextPrompt()
  const recentVaults = useRecentVaults()
  useEffect(() => {
    if (workspace.vault?.root_path) {
      recentVaults.remember(workspace.vault.root_path)
    }
  }, [recentVaults, workspace.vault?.root_path])
  const { activePath: workspaceActivePath, loadGraph: loadWorkspaceGraph, activeNote } = workspace

  useEffect(() => {
    if (spellcheck) {
      void loadHunspellDictionary()
    }
  }, [spellcheck])

  const snippetContext = useMemo(() => {
    if (!workspaceActivePath) {
      return undefined
    }
    const segments = workspaceActivePath.split('/')
    const filename = segments[segments.length - 1] ?? workspaceActivePath
    const directory = segments.slice(0, -1).join('/')
    const extension = filename.includes('.') ? filename.slice(filename.lastIndexOf('.')) : ''
    return {
      filename,
      directory,
      extension,
      title: activeNote?.metadata.title ?? filename.replace(/\.md$/i, ''),
    }
  }, [workspaceActivePath, activeNote?.metadata.title])
  const plugins = usePluginRegistry(Boolean(workspace.vault))
  useEffect(() => {
    workspace.setPluginExportProfiles(plugins.contributions.exportProfiles)
  }, [plugins.contributions.exportProfiles, workspace.setPluginExportProfiles])

  const pluginCommandRuntime = useMemo(
    () => ({
      refreshHealth: () => workspace.refreshHealth(),
      fixVaultLint: () => workspace.fixVaultLint(),
      exportWithProfile: workspace.exportWithProfile,
      setStatusDockTab,
      setHealthDashboardOpen,
      openCanvas: () => setCanvasOpen(true),
    }),
    [
      setHealthDashboardOpen,
      setStatusDockTab,
      workspace.exportWithProfile,
      workspace.fixVaultLint,
      workspace.refreshHealth,
    ],
  )

  const mcp = useMcpRuntime(
    Boolean(workspace.vault),
    workspace.vaultConfig,
    workspace.setVaultConfig,
    workspace.activePath,
    workspace.activeNote?.metadata.content_hash ?? null,
    plugins.contributions.exportProfiles,
    plugins.contributions.mcpTools,
    pluginCommandRuntime,
  )
  const ai = useAiProvider()
  const diagnostics = useDiagnosticsSettings(Boolean(workspace.vault))
  const rendererExtensions = plugins.contributions.rendererExtensions
  const previewPostProcess = useCallback(
    (html: string) => applyRendererExtensions(html, rendererExtensions),
    [rendererExtensions],
  )
  const nativeReady = isNativeBridgeAvailable()
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
  const editorLintMessages = useEditorLintProblems(workspace.draftMarkdown, Boolean(workspace.activePath))
  const totalProblemCount = workspace.problemCount + editorLintMessages.length
  const previewPlantUmlLocal = useCallback(
    async (source: string) => {
      if (!nativeReady) return null
      try {
        const { svg } = await plantumlRender(source)
        return svg
      } catch {
        return null
      }
    },
    [nativeReady],
  )
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
  } = useSplitPaneResize(showSplitPreview, editorWorkspaceRef)
  const showInspectorPreview =
    (chrome.editorSurfaceMode === 'rendered' || activeMode === 'preview') &&
    Boolean(workspace.activePath) &&
    !showSplitPreview
  const scrollSyncEnabled = showSplitPreview || showInspectorPreview
  const scrollContainerRef = showSplitPreview ? splitPreviewScrollRef : inspectorPanelRef
  const { handleEditorLine: syncEditorLine } = useEditorPreviewScrollSync({
    enabled: scrollSyncEnabled,
    editorRef,
    previewRef,
    scrollContainerRef,
  })

  const handleEditorLine = (line: number) => {
    setVisibleEditorLine(line)
    syncEditorLine(line)
  }

  const tocEntries = useMemo<TocEntry[]>(() => {
    if (!workspace.activePath) return []
    if (editorMode !== 'monaco') {
      const fromEditor = editorRef.current?.getToc()
      if (fromEditor && fromEditor.length > 0) return fromEditor
    }
    return generateTocFromMarkdown(workspace.draftMarkdown)
  }, [editorMode, workspace.activePath, workspace.draftMarkdown])

  const editorAutocompleteContext = useMemo(
    () => ({
      notePaths: workspace.entries.filter((entry) => entry.kind === 'note').map((entry) => entry.path),
      tags: [...new Set([...(workspace.activeNote?.metadata.tags ?? []), ...vaultTags])],
      headings: tocEntries.map((entry) => entry.text.replace(/\{#([^}]+)\}/, '').trim()),
      bibliographyKeys: bibliographyRaw.map((entry) => entry.key),
    }),
    [bibliographyRaw, tocEntries, vaultTags, workspace.activeNote?.metadata.tags, workspace.entries],
  )

  const monacoCompletionContext = useMemo(
    () => ({
      notePaths: editorAutocompleteContext.notePaths,
      tags: editorAutocompleteContext.tags,
      headings: editorAutocompleteContext.headings,
    }),
    [editorAutocompleteContext],
  )

  const executeDql = useCallback((query: string) => indexerExecuteDql(query), [])
  const previewFetchNote = useCallback(
    async (target: string): Promise<string | null> => {
      if (!nativeReady) return null
      const trimmed = target.trim()
      if (!trimmed) return null
      try {
        const doc = await vaultReadNote(trimmed)
        return doc.markdown
      } catch {
        try {
          const resolved = await indexerResolveWikilink(trimmed)
          if (resolved.path) {
            const doc = await vaultReadNote(resolved.path)
            return doc.markdown
          }
        } catch {
          return null
        }
      }
      return null
    },
    [nativeReady],
  )
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
  const publishStarlight = useCallback(async () => {
    const output = await promptText({
      title: 'Publish Starlight site',
      label: 'Output folder for Starlight site',
      defaultValue: 'scriptor-publish',
      submitLabel: 'Publish',
    })
    if (!output) return
    void vaultPublishStarlight(output).then((result) => {
      showToast(`Published ${result.notes_copied} notes to ${result.output}`)
    })
  }, [promptText, showToast])

  const openKnowledgeWorkbench = useCallback((tab: KnowledgeWorkbenchTab = 'repair') => {
    setKnowledgeWorkbenchTab(tab)
    setKnowledgeWorkbenchOpen(true)
  }, [])

  const handleWorkspaceModeChange = useCallback(
    (mode: WorkspaceMode) => {
      saveCurrentAsLayout(workspaceMode, {
        splitPreview,
        showStickies: stickiesVisible,
        graphDepth,
        distractionFree,
      })
      setWorkspaceMode(mode)
      if (mode === 'knowledge') openKnowledgeWorkbench('repair')
      if (mode === 'publish') setPublishCenterOpen(true)
      if (mode === 'review') setHealthDashboardOpen(true)
      if (mode === 'automation') setMcpPanelOpen(true)
    },
    [
      distractionFree,
      graphDepth,
      openKnowledgeWorkbench,
      saveCurrentAsLayout,
      setWorkspaceMode,
      splitPreview,
      stickiesVisible,
      workspaceMode,
    ],
  )

  useEffect(() => {
    if (workspace.vault) {
      journey.markVaultOpen()
    }
  }, [workspace.vault?.id])

  useEffect(() => {
    if (workspace.lastRebuildMs != null) {
      journey.markIndexRebuild(workspace.lastRebuildMs)
    }
  }, [workspace.lastRebuildMs])

  useEffect(() => {
    if (workspace.exportResult) {
      journey.markExport()
    }
  }, [workspace.exportResult?.artifact_path])

  useEffect(() => {
    const layout = layouts[workspaceMode]
    setSplitPreview(layout.splitPreview)
    setStickiesVisible(layout.showStickies)
    setGraphDepth(layout.graphDepth)
    setDistractionFree(layout.distractionFree)
  }, [workspaceMode, layouts])

  useEffect(() => {
    if (gitPanelOpen) journey.recordPanelOpen('git')
  }, [gitPanelOpen])
  useEffect(() => {
    if (mcpPanelOpen) journey.recordPanelOpen('mcp')
  }, [mcpPanelOpen])
  useEffect(() => {
    if (portalOpen) journey.recordPanelOpen('portal')
  }, [portalOpen])
  useEffect(() => {
    if (knowledgeWorkbenchOpen) journey.recordPanelOpen('workbench')
  }, [knowledgeWorkbenchOpen])

  useEffect(() => {
    if (!nativeReady || !workspace.vault) {
      setVaultTags([])
      return
    }
    void indexerListTags()
      .then((tags) => setVaultTags(tags.map((entry) => entry.tag)))
      .catch(() => setVaultTags([]))
  }, [nativeReady, workspace.vault, workspace.rebuild])

  useEffect(() => {
    if (!conflictPath || !nativeReady) {
      setConflictPreview([])
      return
    }
    void gitReadConflictMarkers(conflictPath)
      .then((preview) => setConflictPreview(preview))
      .catch(() => setConflictPreview([]))
  }, [conflictPath, nativeReady])

  const draftWordCount = countWords(workspace.draftMarkdown)
  const savedWordCount = workspace.activeNote?.metadata.word_count ?? 0
  const isNoteDirty = workspace.isNoteDirty
  const savedReadingMinutes = workspace.activeNote?.metadata.reading_time_minutes ?? 0
  const draftReadingMinutes =
    draftWordCount === 0 ? 0 : Math.max(1, Math.floor(draftWordCount / 200))
  const readingMinutes = isNoteDirty ? draftReadingMinutes : savedReadingMinutes
  const wordCountDelta = isNoteDirty ? draftWordCount - savedWordCount : 0
  const charCount = countCharacters(workspace.draftMarkdown)
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
  useEscapeToClose(knowledgeWorkbenchOpen, () => setKnowledgeWorkbenchOpen(false))
  useEscapeToClose(publishCenterOpen, () => setPublishCenterOpen(false))
  useEscapeToClose(snippetsOpen, () => setSnippetsOpen(false))
  useEscapeToClose(cheatsheetOpen, () => setCheatsheetOpen(false))
  useEscapeToClose(supportOpen, () => setSupportOpen(false))
  useEscapeToClose(portalOpen, () => setPortalOpen(false))
  useEscapeToClose(quickCaptureOpen, () => setQuickCaptureOpen(false))
  useEscapeToClose(bibliographyOpen, () => setBibliographyOpen(false))
  useEscapeToClose(renameOpen, () => setRenameOpen(false))

  useEffect(() => {
    if (!workspace.vault || !nativeReady) return

    let cancelled = false
    void indexerListBibliography()
      .then((entries) => {
        if (!cancelled) setBibliographyRaw(entries)
      })
      .catch(() => {
        if (!cancelled) setBibliographyRaw([])
      })

    return () => {
      cancelled = true
    }
  }, [nativeReady, workspace.rebuild, workspace.vault])

  useEffect(() => {
    if (!nativeReady || !workspace.vault) {
      setRecentNotes([])
      return
    }
    void vaultListRecentNotes(16)
      .then((entries) =>
        setRecentNotes(
          entries.map((entry) => ({
            path: entry.path,
            title: entry.path.split('/').pop() ?? entry.path,
          })),
        ),
      )
      .catch(() => setRecentNotes([]))
  }, [nativeReady, workspace.activePath, workspace.vault])

  useEffect(() => {
    if (!graphOpen) return
    void loadWorkspaceGraph(workspaceActivePath, { depth: graphDepth, fullVault: graphFullVault })
  }, [graphOpen, graphDepth, graphFullVault, workspaceActivePath, loadWorkspaceGraph])

  const pluginCommandEntries = useMemo(
    () =>
      plugins.plugins.flatMap((plugin) =>
        (plugin.manifest.contributes?.commands ?? []).map((command) => ({
          pluginId: plugin.manifest.id,
          command,
        })),
      ),
    [plugins.plugins],
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
    [patchChrome, setSplitPreview],
  )

  const deleteActiveNote = useCallback(async () => {
    if (!workspace.activePath || !nativeReady) return
    const confirmed = window.confirm(`Delete note "${workspace.activePath}"? This cannot be undone.`)
    if (!confirmed) return
    await vaultDeleteNote(workspace.activePath)
    workspace.closeTab(workspace.activePath)
    await workspace.rebuildIndex()
    await workspace.refreshVault()
    showToast(`Deleted ${workspace.activePath}`)
  }, [nativeReady, showToast, workspace])

  useEffect(() => {
    if (!settingsOpen || !nativeReady) return
    void fetchSystemInfo()
      .then((info) => setSystemInfo(info))
      .catch(() => setSystemInfo(null))
  }, [nativeReady, settingsOpen])

  const bibliographyKeys = useMemo(() => new Set(bibliography.map((entry) => entry.key)), [bibliography])

  const inboxPaths = useMemo(
    () => new Set(workspace.inboxNotes.map((note) => note.path)),
    [workspace.inboxNotes],
  )

  const dailyNoteLabel = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10)
    const preview = planDailyNotePreview(workspace.vaultConfig.daily_note, today)
    return preview.path.split('/').pop()?.replace(/\.md$/i, '') ?? today
  }, [workspace.vaultConfig.daily_note])

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
        setGitPanelOpen,
        setHealthDashboardOpen,
        setMcpPanelOpen,
        setSettingsOpen,
        openKnowledgeWorkbench,
        setPublishCenterOpen,
        setCheatsheetOpen,
        setSupportOpen,
        setPortalOpen,
        setQuickCaptureOpen,
        setBibliographyOpen,
        setSnippetsOpen,
        insertSnippet: (text) => workspace.insertSnippet(text),
        publishStarlight: nativeReady ? () => void publishStarlight() : undefined,
        promptText,
        pluginCommands: pluginCommandEntries,
        runPluginCommand: (command) =>
          void runPluginCommand(command, pluginCommandRuntime, {
            notePath: workspace.activePath,
          }),
        deleteActiveNote: nativeReady ? () => void deleteActiveNote() : undefined,
        openRecentNote: (path) => void workspace.openNote(path),
        recentNotes,
        setEditorSurfaceMode,
        toggleVaultSidebar: () => patchChrome({ vaultSidebarCollapsed: !chrome.vaultSidebarCollapsed }),
        toggleInspector: () => patchChrome({ inspectorCollapsed: !chrome.inspectorCollapsed }),
        vaultSidebarCollapsed: chrome.vaultSidebarCollapsed,
        inspectorCollapsed: chrome.inspectorCollapsed,
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
      setEditorSurfaceMode,
      setGitPanelOpen,
      setGraphOpen,
      setHealthDashboardOpen,
      setPublishCenterOpen,
      setMcpPanelOpen,
      setSettingsOpen,
      setSplitPreview,
      setStatusDockTab,
      setSnippetsOpen,
      setSupportOpen,
      splitPreview,
      workspace,
    ],
  )

  const citationRows = useMemo(() => {
    const inline = extractPandocCitationKeys(workspace.draftMarkdown)
    const unresolved =
      workspace.healthDiagnostics?.issues
        .filter((issue) => issue.kind === 'unresolved_citation' && issue.path === workspace.activePath)
        .map((issue) => issue.detail.replace('missing bibliography entry: ', '')) ?? []
    return Array.from(new Set([...inline, ...unresolved]))
  }, [workspace.activePath, workspace.draftMarkdown, workspace.healthDiagnostics])

  const { formatInline, formatBibliography } = useCiteprocPreview(bibliography, citationRows)

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== 'f' || event.metaKey || event.ctrlKey || event.altKey) return
      const target = event.target
      if (target instanceof HTMLElement && target.closest('input, textarea, [contenteditable="true"]')) {
        return
      }
      event.preventDefault()
      document.querySelector<HTMLInputElement>('.vault-search input')?.focus()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!event.altKey || event.metaKey || event.ctrlKey) return
      const target = event.target
      if (target instanceof HTMLElement && target.closest('input, textarea, [contenteditable="true"]')) {
        return
      }
      switch (event.key.toLowerCase()) {
        case 'o':
          event.preventDefault()
          void workspace.chooseVaultFolder()
          break
        case 'i':
          event.preventDefault()
          workspace.setSidebarView('inbox')
          break
        case 'd':
          event.preventDefault()
          void workspace.createDailyNote()
          break
        case 's':
          event.preventDefault()
          setSnippetsOpen(true)
          break
        case 'g':
          event.preventDefault()
          setGraphOpen(true)
          void workspace.loadGraph(workspace.activePath)
          break
        case 'c':
          event.preventDefault()
          setCanvasOpen(true)
          break
        case 't':
          if (event.shiftKey) {
            event.preventDefault()
            workspace.reopenClosedTab()
          }
          break
        default:
          break
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [workspace])

  const gitLabel = workspace.gitStatus?.is_repo
    ? workspace.gitStatus.clean
      ? `Git clean${workspace.gitStatus.branch ? ` (${workspace.gitStatus.branch})` : ''}`
      : `Git ${workspace.gitStatus.changed_files.length} changed`
    : 'No Git repo'
  const gitTitle = workspace.gitStatus?.is_repo
    ? workspace.gitStatus.clean
      ? 'Repository clean'
      : `${workspace.gitStatus.changed_files.length} changed file(s)`
    : 'Not a Git repository'
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

  return (
    <main className="app-shell" aria-label={BRAND_WORKSPACE_LABEL} data-workspace-mode={workspaceMode}>
      <div className="app-chrome">
        <AppTopBar
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
          gitLabel={gitLabel}
          gitTitle={gitTitle}
          gitSuccess={workspace.gitStatus?.is_repo === true && workspace.gitStatus.clean === true}
          gitNeutral={!workspace.gitStatus?.is_repo}
          onOpenGit={() => setGitPanelOpen(true)}
          mcpLabel={`MCP ${mcp.mode}`}
          onOpenMcp={() => setMcpPanelOpen(true)}
          onOpenSupport={() => setSupportOpen(true)}
          onOpenSettings={() => setSettingsOpen(true)}
          theme={theme}
          onToggleTheme={toggleTheme}
        />

        {!nativeReady && (
          <div className="runtime-banner" role="status">
            Native vault commands require the desktop shell. Run <code>pnpm desktop:dev</code> to open real Markdown vaults.
          </div>
        )}

        {workspace.error && (
          <div className="runtime-banner error" role="alert">
            {workspace.error}
          </div>
        )}
      </div>

      <section
        className="workspace-grid"
        data-mobile-pane={mobilePane}
        data-vault-collapsed={chrome.vaultSidebarCollapsed ? 'true' : 'false'}
        data-inspector-collapsed={chrome.inspectorCollapsed ? 'true' : 'false'}
        style={
          {
            '--editor-font-size': `${chrome.editorFontSize}px`,
            '--editor-font-family': editorFontFamilyCss(chrome.editorFontFamily),
            '--editor-line-height': String(chrome.editorLineHeight),
            '--editor-padding': `${chrome.editorPaddingPx}px`,
            '--preview-max-ch': `${chrome.previewMaxWidthCh}ch`,
          } as React.CSSProperties
        }
      >
        <VaultSidebar
          vault={workspace.vault}
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
          onChooseVault={() => void workspace.chooseVaultFolder()}
          onCreateNote={() => void workspace.createNote()}
          onCreateNoteOfType={(typeName) => void workspace.createNoteOfType(typeName)}
          onCreateNoteFromTemplate={(templatePath) => void workspace.createNoteFromTemplate(templatePath)}
          onRebuildIndex={() => void workspace.rebuildIndex()}
          onOpenTags={() => openKnowledgeWorkbench('tags')}
          onOpenFilters={() => openKnowledgeWorkbench('repair')}
          onOpenSavedViews={() => openKnowledgeWorkbench('views')}
          onOpenSnippets={() => setSnippetsOpen(true)}
          onOpenSettings={() => setSettingsOpen(true)}
          onCreateDailyNote={() => void workspace.createDailyNote()}
          onCreateDailyNoteOffset={(offset) => void workspace.createDailyNoteForOffset(offset)}
          dailyNoteLabel={dailyNoteLabel}
          onOrganizeNote={(path) => void workspace.organizeNote(path)}
          onSearchQueryChange={workspace.setVaultSearchQuery}
          onOpenNote={(path) => void workspace.openNote(path)}
          onRenameNote={(path) => {
            setRenameTargetPath(path)
            setRenameOpen(true)
          }}
          onDeleteNote={
            nativeReady
              ? (path) => {
                  if (!window.confirm(`Delete "${path}"?`)) return
                  void vaultDeleteNote(path).then(() => {
                    workspace.closeTab(path)
                    void workspace.rebuildIndex()
                    void workspace.refreshVault()
                  })
                }
              : undefined
          }
          recentNotes={recentNotes}
        />

        <EditorWorkspace
          activePath={workspace.activePath}
          onOpenVault={() => void workspace.chooseVaultFolder()}
          openTabs={workspace.openTabs}
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
          spellcheck={spellcheck}
          setSpellcheck={setSpellcheck}
          wysiwyg={wysiwyg}
          setWysiwyg={setWysiwyg}
          typewriter={typewriter}
          setTypewriter={setTypewriter}
          distractionFree={distractionFree}
          setDistractionFree={setDistractionFree}
          languageTool={languageTool}
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
          applyEditorTransform={(action) => workspace.applyEditorTransform(action as any)}
          applyEditorTypography={(action) => workspace.applyEditorTypography(action as any)}
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
            writeInspectorPreset(preset)
          }}
          showInspectorHealth={chrome.showInspectorHealth}
          onOpenKnowledgeWorkbench={() => openKnowledgeWorkbench('repair')}
          onOpenPublishCenter={() => setPublishCenterOpen(true)}
          onOpenGraph={() => {
            setGraphOpen(true)
            void workspace.loadGraph(workspace.activePath)
          }}
          plugins={{
            plugins: plugins.plugins,
            templatePacks: plugins.contributions.templatePacks,
            safeMode: plugins.snapshot.safeMode,
            healthDiagnostics: workspace.healthDiagnostics,
            marketplaceCatalog: plugins.marketplaceCatalog,
            onToggleSafeMode: plugins.setSafeMode,
            onTogglePlugin: plugins.setPluginEnabled,
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

      {canvasOpen && (
        <Suspense fallback={<PanelFallback />}>
          <CanvasPanel
          key={workspace.vault?.id ?? 'no-vault'}
          vaultId={workspace.vault?.id ?? null}
          vaultOpen={Boolean(workspace.vault)}
          crdtEnabled={workspace.vaultConfig.canvas?.crdt_enabled ?? false}
          activePath={workspace.activePath}
          templatePacks={plugins.contributions.templatePacks}
          canvasTools={plugins.contributions.canvasTools}
          onClose={() => setCanvasOpen(false)}
          onOpenNote={(path) => void workspace.openNote(path)}
        />
        </Suspense>
      )}

      <CommandPalette
        open={commandPalette.open}
        onClose={() => commandPalette.setOpen(false)}
        commands={paletteCommands}
      />

      {graphOpen && (
        <Suspense fallback={<PanelFallback />}>
          <GraphPanel
          graph={workspace.graph}
          focusPath={workspace.activePath}
          graphGroups={workspace.vaultConfig.graph_groups ?? []}
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
        />
        </Suspense>
      )}

      {mcpPanelOpen && (
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
      )}

      {gitPanelOpen && (
        <Suspense fallback={<PanelFallback />}>
          <GitPanel
          status={workspace.gitStatus}
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
      )}

      {writingTargetsOpen && (
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
      )}

      {conflictPath && (
        <ConflictResolverModal
          path={conflictPath}
          preview={conflictPreview}
          isBusy={workspace.isGitBusy}
          onClose={() => setConflictPath(null)}
          onResolve={(strategy) => {
            void gitResolveConflict(conflictPath, strategy).then(() => {
              setConflictPath(null)
              void workspace.refreshGit()
            })
          }}
        />
      )}

      {healthDashboardOpen && (
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
      )}

      {frontmatterOpen && workspace.activePath ? (
        <FrontmatterInspector
          path={workspace.activePath}
          fields={parseSimpleFrontmatter(workspace.draftMarkdown)}
          onClose={() => setFrontmatterOpen(false)}
          onSaved={() => void workspace.reloadActiveNoteFromDisk()}
        />
      ) : null}

      {settingsOpen && (
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
          onResetWorkspaceLayout={resetLayout}
          panelPresentation={panelPresentation}
          onPanelPresentationChange={setPanelPresentation}
          journey={journey.snapshot}
          timeToFirstEditMs={journey.timeToFirstEditMs}
          timeToFirstExportMs={journey.timeToFirstExportMs}
          onResetJourney={journey.reset}
          workspaceChrome={chrome}
          onPatchWorkspaceChrome={patchChrome}
          onResetWorkspaceChrome={resetChrome}
          onOpenSupport={() => {
            setSettingsOpen(false)
            setSupportOpen(true)
          }}
        />
        </Suspense>
      )}

      {bibliographyOpen && (
        <Suspense fallback={<PanelFallback />}>
          <BibliographyPanel
          entries={bibliography}
          onClose={() => setBibliographyOpen(false)}
          onInsertCitation={(key) => {
            workspace.insertSnippet(`[@${key}] `)
            setBibliographyOpen(false)
          }}
        />
        </Suspense>
      )}

      {knowledgeWorkbenchOpen && (
        <Suspense fallback={<PanelFallback />}>
          <KnowledgeWorkbench
            vaultOpen={Boolean(workspace.vault)}
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
      )}

      {publishCenterOpen && (
        <Suspense fallback={<PanelFallback />}>
          <PublishCenter
            activePath={workspace.activePath}
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
            onPublishStarlight={() => void publishStarlight()}
          />
        </Suspense>
      )}

      {snippetsOpen && (
        <Suspense fallback={<PanelFallback />}>
          <SnippetsPanelLazy
          vaultOpen={Boolean(workspace.vault)}
          onClose={() => setSnippetsOpen(false)}
          onSaved={() => void workspace.refreshVaultSnippets()}
        />
        </Suspense>
      )}

      {cheatsheetOpen ? <CheatsheetPanel onClose={() => setCheatsheetOpen(false)} /> : null}

      {supportOpen ? <SupportPanel onClose={() => setSupportOpen(false)} /> : null}

      {portalOpen ? (
        <Suspense fallback={<PanelFallback />}>
          <PortalPanel
          categories={workspaceStore.portal.categories}
          itemsByCategory={workspaceStore.portalItemsByCategory}
          presentation={panelPresentation === 'dock-right' ? 'dock-right' : 'modal'}
          onClose={() => setPortalOpen(false)}
          onSaveItem={(item) =>
            workspaceStore.updatePortal((portal) => ({
              ...portal,
              items: portal.items.some((entry) => entry.id === item.id)
                ? portal.items.map((entry) => (entry.id === item.id ? item : entry))
                : [...portal.items, item],
            }))
          }
          onDeleteItem={(id) =>
            workspaceStore.updatePortal((portal) => ({
              ...portal,
              items: portal.items.filter((entry) => entry.id !== id),
            }))
          }
          onInsert={(body) => workspace.insertSnippet(body)}
          onOpenNote={(path) => void workspace.openNote(path)}
        />
        </Suspense>
      ) : null}

      {quickCaptureOpen ? (
        <Suspense fallback={<PanelFallback />}>
          <QuickCapturePanel
          scratchpad={workspaceStore.quickCapture.scratchpad}
          todos={workspaceStore.quickCapture.todos}
          presentation={panelPresentation === 'dock-right' ? 'dock-right' : 'modal'}
          onClose={() => setQuickCaptureOpen(false)}
          onScratchpadChange={(body) =>
            workspaceStore.updateQuickCapture((capture) => ({
              ...capture,
              scratchpad: { kind: 'scratchpad', body, updatedAt: new Date().toISOString() },
            }))
          }
          onAddTodo={(text) =>
            workspaceStore.updateQuickCapture((capture) => ({
              ...capture,
              todos: [
                ...capture.todos,
                {
                  id: crypto.randomUUID(),
                  kind: 'todo',
                  text,
                  done: false,
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                },
              ],
            }))
          }
          onToggleTodo={(id) =>
            workspaceStore.updateQuickCapture((capture) => ({
              ...capture,
              todos: capture.todos.map((todo) =>
                todo.id === id
                  ? { ...todo, done: !todo.done, updatedAt: new Date().toISOString() }
                  : todo,
              ),
            }))
          }
          onUpdateTodo={(id, text) =>
            workspaceStore.updateQuickCapture((capture) => ({
              ...capture,
              todos: capture.todos.map((todo) =>
                todo.id === id ? { ...todo, text, updatedAt: new Date().toISOString() } : todo,
              ),
            }))
          }
          onDeleteTodo={(id) =>
            workspaceStore.updateQuickCapture((capture) => ({
              ...capture,
              todos: capture.todos.filter((todo) => todo.id !== id),
            }))
          }
          onAddSticky={() =>
            workspaceStore.updateQuickCapture((capture) => ({
              ...capture,
              stickies: [
                ...capture.stickies,
                {
                  id: crypto.randomUUID(),
                  kind: 'sticky',
                  title: 'Sticky',
                  body: '',
                  color: '#fef9c3',
                  x: 80 + capture.stickies.length * 24,
                  y: 120 + capture.stickies.length * 24,
                  width: 240,
                  height: 180,
                  pinned: false,
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                },
              ],
            }))
          }
          onPromoteScratchpadToNote={
            workspace.activePath
              ? () => {
                  const body = workspaceStore.quickCapture.scratchpad.body.trim()
                  if (!body) return
                  workspace.insertSnippet(`\n${body}\n`)
                  setQuickCaptureOpen(false)
                }
              : undefined
          }
          onCreateInboxNoteFromScratchpad={() => {
            const body = workspaceStore.quickCapture.scratchpad.body.trim()
            if (!body) return
            void (async () => {
              await workspace.createNote(`Capture ${new Date().toISOString().slice(0, 10)}`)
              workspace.updateDraft(body)
              await workspace.saveActiveNoteNow()
              workspaceStore.updateQuickCapture((capture) => ({
                ...capture,
                scratchpad: { kind: 'scratchpad', body: '', updatedAt: new Date().toISOString() },
              }))
              setQuickCaptureOpen(false)
            })()
          }}
          onCreateNoteFromTodo={(id) => {
            const todo = workspaceStore.quickCapture.todos.find((entry) => entry.id === id)
            if (!todo) return
            void (async () => {
              await workspace.createNote(todo.text.slice(0, 60))
              workspace.updateDraft(`# ${todo.text}\n\n- [ ] ${todo.text}\n`)
              await workspace.saveActiveNoteNow()
              workspaceStore.updateQuickCapture((capture) => ({
                ...capture,
                todos: capture.todos.filter((entry) => entry.id !== id),
              }))
              setQuickCaptureOpen(false)
            })()
          }}
        />
        </Suspense>
      ) : null}

      <StickyNotesLayer
        stickies={workspaceStore.quickCapture.stickies}
        visible={stickiesVisible}
        onUpdate={(note) =>
          workspaceStore.updateQuickCapture((capture) => ({
            ...capture,
            stickies: capture.stickies.map((entry) => (entry.id === note.id ? note : entry)),
          }))
        }
        onDelete={(id) =>
          workspaceStore.updateQuickCapture((capture) => ({
            ...capture,
            stickies: capture.stickies.filter((entry) => entry.id !== id),
          }))
        }
      />

      {tagRenameTag && (
        <RenameTagDialog
          oldTag={tagRenameTag}
          preview={workspace.linkRewritePreview}
          isApplying={workspace.isLinkRewriting}
          onClose={() => {
            setTagRenameTag(null)
            workspace.clearLinkRewritePreview()
          }}
          onPreview={(newTag) => void workspace.previewTagRename(tagRenameTag, newTag)}
          onApply={(newTag) => {
            void workspace.applyTagRename(tagRenameTag, newTag).then(() => {
              setTagRenameTag(null)
              setKnowledgeWorkbenchOpen(false)
            })
          }}
        />
      )}

      {blockRenameTarget && (
        <RenameBlockDialog
          notePath={blockRenameTarget.path}
          oldBlock={blockRenameTarget.label}
          preview={workspace.linkRewritePreview}
          isApplying={workspace.isLinkRewriting}
          onClose={() => {
            setBlockRenameTarget(null)
            workspace.clearLinkRewritePreview()
          }}
          onPreview={(newBlock, updateAnchor) =>
            void workspace.previewBlockRename(
              blockRenameTarget.path,
              blockRenameTarget.label,
              newBlock,
              updateAnchor,
            )
          }
          onApply={(newBlock, updateAnchor) => {
            void workspace
              .applyBlockRename(blockRenameTarget.path, blockRenameTarget.label, newBlock, updateAnchor)
              .then(() => setBlockRenameTarget(null))
          }}
        />
      )}

      {sectionRenameTarget && (
        <RenameSectionDialog
          notePath={sectionRenameTarget.path}
          oldSection={sectionRenameTarget.label}
          preview={workspace.linkRewritePreview}
          isApplying={workspace.isLinkRewriting}
          onClose={() => {
            setSectionRenameTarget(null)
            workspace.clearLinkRewritePreview()
          }}
          onPreview={(newSection, updateHeading) =>
            void workspace.previewSectionRename(
              sectionRenameTarget.path,
              sectionRenameTarget.label,
              newSection,
              updateHeading,
            )
          }
          onApply={(newSection, updateHeading) => {
            void workspace
              .applySectionRename(
                sectionRenameTarget.path,
                sectionRenameTarget.label,
                newSection,
                updateHeading,
              )
              .then(() => setSectionRenameTarget(null))
          }}
        />
      )}

      {renameOpen && (renameTargetPath ?? workspace.activePath) && (
        <RenameNoteDialog
          currentPath={renameTargetPath ?? workspace.activePath ?? ''}
          preview={workspace.renamePreview}
          isApplying={workspace.isRenaming}
          onClose={() => {
            setRenameOpen(false)
            setRenameTargetPath(null)
            workspace.clearRenamePreview()
          }}
          onPreview={(toPath, updateLinks) =>
            void workspace.previewRename(toPath, updateLinks, renameTargetPath ?? undefined)
          }
          onApply={(toPath, updateLinks) => {
            void workspace
              .applyRename(toPath, updateLinks, renameTargetPath ?? undefined)
              .then(() => {
                setRenameOpen(false)
                setRenameTargetPath(null)
              })
          }}
        />
      )}

      {promptRequest ? (
        <TextPromptDialog
          request={promptRequest}
          onSubmit={submitPrompt}
          onCancel={cancelPrompt}
        />
      ) : null}

      {toastMessage ? <AppToast message={toastMessage} onDismiss={dismissToast} /> : null}
    </main>
  )
}

export default App
