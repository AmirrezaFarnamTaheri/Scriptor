import type { PaletteCommand } from '../components/CommandPalette'
import type { StatusDockTab } from '../components/StatusDockPanel'
import { toPaletteCommands, type AppCommandDefinition } from './appCommandRegistry'

export interface PaletteCommandContext {
  workspace: {
    chooseVaultFolder: () => Promise<void>
    rebuildIndex: () => Promise<void>
    refreshHealth: () => Promise<void>
    fixVaultLint: () => Promise<unknown>
    loadGraph: (focusPath: string | null, options?: { depth?: number; fullVault?: boolean }) => Promise<void>
    activePath: string | null
    draftMarkdown: string
    generateLinkReferences: () => void
    organizeNote: (path: string) => Promise<void>
    createDailyNote: () => Promise<void>
    createNoteOfType: (typeName: string, title?: string) => Promise<void>
    createNoteFromTemplate: (templatePath: string, title?: string) => Promise<void>
    exportWithProfile?: (profileId: string) => Promise<void>
    inboxNotes: { path: string; title: string }[]
    noteTypes: { name: string }[]
    templatePaths: { name: string; path: string }[]
    snippetCatalog: { name: string; content: string; description?: string }[]
    setSidebarView: (view: 'vault' | 'inbox') => void
    reopenClosedTab?: () => void
    closedTabCount?: number
  }
  ai: {
    enabled: boolean
    proposeDraftFromPrompt: (prompt: string, currentMarkdown: string) => Promise<string>
  }
  mcp: {
    proposeDraftForActiveNote: (proposedMarkdown: string, summary: string) => Promise<unknown>
  }
  graphDepth: number
  graphFullVault: boolean
  splitPreview: boolean
  setSplitPreview: (updater: (value: boolean) => boolean) => void
  setStatusDockTab: (tab: StatusDockTab) => void
  setGraphOpen: (open: boolean) => void
  setCanvasOpen: (open: boolean) => void
  setGitPanelOpen: (open: boolean) => void
  setHealthDashboardOpen: (open: boolean) => void
  setMcpPanelOpen: (open: boolean) => void
  setSettingsOpen: (open: boolean) => void
  openKnowledgeWorkbench?: (tab?: 'repair' | 'views' | 'collections' | 'tags' | 'discover') => void
  setPublishCenterOpen?: (open: boolean) => void
  setCheatsheetOpen?: (open: boolean) => void
  setSupportOpen?: (open: boolean) => void
  setPortalOpen?: (open: boolean) => void
  setQuickCaptureOpen?: (open: boolean) => void
  setBibliographyOpen: (open: boolean) => void
  setSnippetsOpen?: (open: boolean) => void
  insertSnippet?: (text: string) => void
  publishStarlight?: () => void
  promptText?: (request: {
    title: string
    label: string
    defaultValue: string
    submitLabel?: string
  }) => Promise<string | null>
  pluginCommands?: Array<{ pluginId: string; command: import('@scriptor/core/contracts/plugin').PluginCommandContribution }>
  runPluginCommand?: (command: import('@scriptor/core/contracts/plugin').PluginCommandContribution) => void | Promise<void>
  deleteActiveNote?: () => void | Promise<void>
  openRecentNote?: (path: string) => void | Promise<void>
  recentNotes?: Array<{ path: string; title: string }>
  setEditorSurfaceMode?: (mode: 'source' | 'split' | 'rendered') => void
  toggleVaultSidebar?: () => void
  toggleInspector?: () => void
  vaultSidebarCollapsed?: boolean
  inspectorCollapsed?: boolean
}

export function buildPaletteCommands(context: PaletteCommandContext): PaletteCommand[] {
  const {
    workspace,
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
    insertSnippet,
    publishStarlight,
    promptText,
    pluginCommands = [],
    runPluginCommand,
    deleteActiveNote,
    openRecentNote,
    recentNotes = [],
    setEditorSurfaceMode,
    toggleVaultSidebar,
    toggleInspector,
    vaultSidebarCollapsed,
    inspectorCollapsed,
  } = context

  const baseCommands: AppCommandDefinition[] = [
    {
      id: 'open-inbox',
      label: workspace.inboxNotes.length > 0 ? `Open inbox (${workspace.inboxNotes.length})` : 'Open inbox',
      shortcut: 'Alt+I',
      run: () => workspace.setSidebarView('inbox'),
    },
    {
      id: 'organize-active-note',
      label: 'Mark active note organized',
      run: () => {
        if (!workspace.activePath) return
        void workspace.organizeNote(workspace.activePath)
      },
    },
    {
      id: 'open-daily-note',
      label: "Open today's daily note",
      shortcut: 'Alt+D',
      run: () => void workspace.createDailyNote(),
    },
    ...(setSnippetsOpen
      ? [
          {
            id: 'manage-snippets',
            label: 'Manage snippet catalog',
            shortcut: 'Alt+S',
            run: () => setSnippetsOpen(true),
          } satisfies AppCommandDefinition,
        ]
      : []),
    { id: 'open-vault', label: 'Open vault', shortcut: 'Alt+O', run: () => void workspace.chooseVaultFolder() },
    { id: 'rebuild-index', label: 'Rebuild index', run: () => void workspace.rebuildIndex() },
    {
      id: 'generate-link-references',
      label: 'Generate Foam link references',
      run: () => {
        workspace.generateLinkReferences()
        setStatusDockTab('problems')
      },
    },
    {
      id: 'lint-vault',
      label: 'Refresh vault lint',
      run: () => {
        setStatusDockTab('problems')
        void workspace.refreshHealth()
      },
    },
    {
      id: 'fix-vault-lint',
      label: 'Fix vault lint issues',
      run: () => {
        setStatusDockTab('problems')
        void workspace.fixVaultLint()
      },
    },
    {
      id: 'open-graph',
      label: 'Open graph',
      shortcut: 'Alt+G',
      run: () => {
        setGraphOpen(true)
        void workspace.loadGraph(workspace.activePath, { depth: graphDepth, fullVault: graphFullVault })
      },
    },
    { id: 'open-canvas', label: 'Open canvas', shortcut: 'Alt+C', run: () => setCanvasOpen(true) },
    { id: 'open-git', label: 'Open Git panel', run: () => setGitPanelOpen(true) },
    { id: 'open-health', label: 'Open vault health', run: () => setHealthDashboardOpen(true) },
    { id: 'open-mcp', label: 'Open MCP panel', run: () => setMcpPanelOpen(true) },
    { id: 'open-settings', label: 'Open settings', run: () => setSettingsOpen(true) },
    {
      id: 'open-knowledge-workbench',
      label: 'Open knowledge workbench',
      shortcut: 'Alt+K',
      run: () => openKnowledgeWorkbench?.('repair'),
    },
    {
      id: 'open-publish-center',
      label: 'Open publish center',
      run: () => setPublishCenterOpen?.(true),
    },
    { id: 'open-tags', label: 'Browse tags', run: () => openKnowledgeWorkbench?.('tags') },
    { id: 'open-filters', label: 'Knowledge repair queue', run: () => openKnowledgeWorkbench?.('repair') },
    { id: 'open-saved-views', label: 'Saved views', run: () => openKnowledgeWorkbench?.('views') },
    {
      id: 'open-smart-collections',
      label: 'Smart collections (DQL)',
      run: () => openKnowledgeWorkbench?.('collections'),
    },
    {
      id: 'reopen-closed-tab',
      label:
        workspace.closedTabCount && workspace.closedTabCount > 0
          ? `Reopen closed tab (${workspace.closedTabCount})`
          : 'Reopen closed tab',
      shortcut: 'Ctrl+Shift+T',
      run: () => workspace.reopenClosedTab?.(),
    },
    { id: 'open-cheatsheet', label: 'Markdown cheatsheet', run: () => setCheatsheetOpen?.(true) },
    { id: 'open-support', label: 'Support Scriptor', keywords: ['donate', 'github', 'star'], run: () => setSupportOpen?.(true) },
    { id: 'open-portal', label: 'Open portal clipboard', run: () => setPortalOpen?.(true) },
    { id: 'open-quick-capture', label: 'Quick capture (scratchpad & todos)', run: () => setQuickCaptureOpen?.(true) },
    { id: 'open-bibliography', label: 'Browse bibliography', run: () => setBibliographyOpen(true) },
    {
      id: 'toggle-split-preview',
      label: splitPreview ? 'Close split preview' : 'Open split preview',
      run: () => setSplitPreview((value) => !value),
    },
    ...(setEditorSurfaceMode
      ? [
          {
            id: 'editor-view-source',
            label: 'Editor view: source only',
            run: () => setEditorSurfaceMode('source'),
          } satisfies AppCommandDefinition,
          {
            id: 'editor-view-split',
            label: 'Editor view: split source + preview',
            run: () => setEditorSurfaceMode('split'),
          } satisfies AppCommandDefinition,
          {
            id: 'editor-view-rendered',
            label: 'Editor view: rendered preview (inspector)',
            run: () => setEditorSurfaceMode('rendered'),
          } satisfies AppCommandDefinition,
        ]
      : []),
    ...(toggleVaultSidebar
      ? [
          {
            id: 'toggle-vault-sidebar',
            label: vaultSidebarCollapsed ? 'Show vault sidebar' : 'Hide vault sidebar',
            run: toggleVaultSidebar,
          } satisfies AppCommandDefinition,
        ]
      : []),
    ...(toggleInspector
      ? [
          {
            id: 'toggle-inspector',
            label: inspectorCollapsed ? 'Show inspector' : 'Hide inspector',
            run: toggleInspector,
          } satisfies AppCommandDefinition,
        ]
      : []),
    ...(deleteActiveNote && workspace.activePath
      ? [
          {
            id: 'delete-active-note',
            label: 'Delete active note',
            run: () => void deleteActiveNote(),
          } satisfies AppCommandDefinition,
        ]
      : []),
    {
      id: 'focus-search',
      label: 'Focus vault search',
      shortcut: 'F',
      run: () => document.querySelector<HTMLInputElement>('.vault-search input')?.focus(),
    },
  ]
  const commands: PaletteCommand[] = toPaletteCommands(baseCommands)

  for (const type of workspace.noteTypes) {
    commands.push({
      id: `create-note-type-${type.name}`,
      label: `New ${type.name} note`,
      run: () => void workspace.createNoteOfType(type.name),
    })
  }

  for (const template of workspace.templatePaths) {
    commands.push({
      id: `create-from-template-${template.path}`,
      label: `New note from template: ${template.name}`,
      run: () => void workspace.createNoteFromTemplate(template.path),
    })
  }

  if (insertSnippet && workspace.activePath) {
    for (const snippet of workspace.snippetCatalog) {
      commands.push({
        id: `insert-snippet-${snippet.name}`,
        label: snippet.description
          ? `Insert snippet: ${snippet.name} — ${snippet.description}`
          : `Insert snippet: ${snippet.name}`,
        run: () => insertSnippet(snippet.content),
      })
    }

    for (const snippet of [
      { id: 'insert-mermaid-flow', label: 'Insert Mermaid flowchart', text: '```mermaid\nflowchart TD\n    A[Start] --> B[End]\n```\n' },
      { id: 'insert-mermaid-seq', label: 'Insert Mermaid sequence', text: '```mermaid\nsequenceDiagram\n    A->>B: Hello\n```\n' },
      { id: 'insert-math-block', label: 'Insert math block', text: '$$\n\\sum_{i=1}^{n} x_i\n$$\n' },
    ]) {
      commands.push({
        id: snippet.id,
        label: snippet.label,
        run: () => insertSnippet(snippet.text),
      })
    }
  }

  if (workspace.exportWithProfile && workspace.activePath) {
    commands.push({
      id: 'export-reveal-slides',
      label: 'Export active note as Reveal.js slides',
      run: () => {
        setStatusDockTab('jobs')
        void workspace.exportWithProfile?.('reveal-slides')
      },
    })
  }

  if (publishStarlight) {
    commands.push({
      id: 'publish-starlight',
      label: 'Publish Starlight site',
      run: publishStarlight,
    })
  }

  for (const entry of pluginCommands) {
    if (!runPluginCommand) break
    commands.push({
      id: `plugin-${entry.pluginId}-${entry.command.commandId}`,
      label: `${entry.command.label} (${entry.command.category})`,
      run: () => void runPluginCommand(entry.command),
    })
  }

  for (const note of recentNotes.slice(0, 12)) {
    if (!openRecentNote) break
    commands.push({
      id: `recent-note-${note.path}`,
      label: `Recent: ${note.title}`,
      run: () => void openRecentNote(note.path),
    })
  }

  if (ai.enabled && workspace.activePath && promptText) {
    commands.push({
      id: 'ai-draft-note',
      label: 'AI draft active note',
      run: () => {
        void promptText({
          title: 'Assistant draft',
          label: 'Describe the edit you want the assistant to draft',
          defaultValue: '',
          submitLabel: 'Draft',
        }).then((prompt) => {
          if (!prompt) return
          void ai.proposeDraftFromPrompt(prompt, workspace.draftMarkdown).then((proposed) => {
            void mcp.proposeDraftForActiveNote(proposed, `AI draft: ${prompt}`)
            setMcpPanelOpen(true)
          })
        })
      },
    })
  }

  return commands
}
