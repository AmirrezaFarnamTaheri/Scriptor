import { memo, Suspense, useCallback } from 'react'
import { ErrorBoundary } from '../ErrorBoundary'
import { PanelErrorFallback } from '../PanelErrorFallback'
import type { ReaderPanelProps } from '../reader/ReaderPanel'
import {
  BibliographyPanel,
  CanvasPanel,
  GitPanel,
  GmailManagerPanel,
  GraphPanel,
  KanbanPanel,
  McpPanel,
  PanelFallback,
  ReaderPanel,
  TaskPanel,
} from './lazyPanels'
import type { usePluginRegistry } from '../../hooks/usePluginRegistry'
import type { useVaultWorkspace } from '../../hooks/useVaultWorkspace'
import type { useMcpRuntime } from '../../hooks/useMcpRuntime'
import type { useAiProvider } from '../../hooks/useAiProvider'
import type { TextPromptRequest } from '../../hooks/useTextPrompt'
import type { BibliographyEntry } from '../../types/vault'
import type { GitPullStrategy } from '../../bridge/commands/git'
import {
  gitShowHeadFile,
  indexerApplyFilesystemChanges,
  vaultReadNote,
  vaultSaveAsset,
} from '../../bridge/commands'
import { gmailImportedNoteTitle } from '../../lib/gmailRfc5322'

export type WorkspacePanelLaunchersProps = {
  workspace: ReturnType<typeof useVaultWorkspace>
  plugins: ReturnType<typeof usePluginRegistry>
  nativeReady: boolean
  canvasOpen: boolean
  readerOpen: boolean
  readerFilePath: string | null
  tasksOpen: boolean
  kanbanOpen: boolean
  readerPresentation: ReaderPanelProps['presentation']
  onCloseCanvas: () => void
  onCloseReader: () => void
  onCloseTasks: () => void
  onCloseKanban: () => void
  bibliographyOpen?: boolean
  bibliography?: BibliographyEntry[]
  setBibliographyOpen?: (open: boolean) => void
  refreshBibliography?: () => void
  gmailManagerOpen?: boolean
  setGmailManagerOpen?: (open: boolean) => void
  showToast?: (message: string) => void

  // Graph
  graphOpen?: boolean
  graphDepth?: number
  graphFullVault?: boolean
  setGraphDepth?: (depth: number) => void
  setGraphFullVault?: (fullVault: boolean) => void
  onCloseGraph?: () => void
  onOpenWorkbenchFromGraph?: () => void
  hibernateGraph?: boolean
  setHibernateGraph?: (value: boolean | ((prev: boolean) => boolean)) => void

  // Git
  gitPanelOpen?: boolean
  panelPresentation?: ReaderPanelProps['presentation']
  onCloseGit?: () => void
  onRefreshGit?: () => void
  onCommitGit?: (files: string[], message: string) => void
  onPullGit?: (strategy: GitPullStrategy) => void
  onPushGit?: () => void
  onResolveConflictGit?: (path: string) => void
  onOpenNoteFromGit?: (path: string) => void

  // MCP
  mcpPanelOpen?: boolean
  mcp?: ReturnType<typeof useMcpRuntime>
  ai?: ReturnType<typeof useAiProvider>
  editorTheme?: 'light' | 'dark'
  onCloseMcp?: () => void
  promptText?: (request: TextPromptRequest) => Promise<string | null>
}

/** Composes launchable workspace panels and their close handlers. */
function WorkspacePanelLaunchersImpl({
  workspace,
  plugins,
  nativeReady,
  canvasOpen,
  readerOpen,
  readerFilePath,
  tasksOpen,
  kanbanOpen,
  readerPresentation,
  onCloseCanvas,
  onCloseReader,
  onCloseTasks,
  onCloseKanban,
  bibliographyOpen,
  bibliography = [],
  setBibliographyOpen,
  refreshBibliography,
  gmailManagerOpen,
  setGmailManagerOpen,
  showToast,
  graphOpen,
  graphDepth = 2,
  graphFullVault = false,
  setGraphDepth,
  setGraphFullVault,
  onCloseGraph,
  onOpenWorkbenchFromGraph,
  hibernateGraph = false,
  setHibernateGraph,
  gitPanelOpen,
  panelPresentation = 'modal',
  onCloseGit,
  onRefreshGit,
  onCommitGit,
  onPullGit,
  onPushGit,
  onResolveConflictGit,
  onOpenNoteFromGit,
  mcpPanelOpen,
  mcp,
  ai,
  editorTheme = 'dark',
  onCloseMcp,
  promptText,
}: WorkspacePanelLaunchersProps) {
  const gmailEnabled = plugins.activePlugins.some((plugin) => plugin.manifest.id === 'scriptor.gmail-manager')

  const gitReadHead = useCallback(async (path: string) => {
    try {
      return await gitShowHeadFile(path)
    } catch {
      return null
    }
  }, [])

  const gitActivePath = workspace.activePath
  const gitDraftMarkdown = workspace.draftMarkdown
  const gitReadWorking = useCallback(
    async (path: string) =>
      path === gitActivePath ? gitDraftMarkdown : (await vaultReadNote(path)).markdown,
    [gitActivePath, gitDraftMarkdown],
  )

  const hasAnyPanelOpen =
    canvasOpen ||
    readerOpen ||
    tasksOpen ||
    kanbanOpen ||
    Boolean(bibliographyOpen) ||
    Boolean(gmailManagerOpen) ||
    Boolean(graphOpen) ||
    Boolean(gitPanelOpen) ||
    Boolean(mcpPanelOpen)

  if (!hasAnyPanelOpen) {
    return null
  }

  return (
    <>
      {canvasOpen && (
        <ErrorBoundary
          name="canvas-panel"
          resetKeys={[workspace.activePath]}
          fallback={<PanelErrorFallback title="The canvas" onDismiss={onCloseCanvas} />}
        >
          <Suspense fallback={<PanelFallback />}>
            <CanvasPanel
              key={workspace.vault?.id ?? 'no-vault'}
              vaultId={workspace.vault?.id ?? null}
              vaultOpen={Boolean(workspace.vault)}
              crdtEnabled={workspace.vaultConfig.canvas?.crdt_enabled ?? false}
              activePath={workspace.activePath}
              templatePacks={plugins.contributions.templatePacks}
              canvasTools={plugins.contributions.canvasTools}
              onClose={onCloseCanvas}
              onOpenNote={(path) => void workspace.openNote(path)}
            />
          </Suspense>
        </ErrorBoundary>
      )}

      {readerOpen && (
        <ErrorBoundary
          name="reader-panel"
          fallback={<PanelErrorFallback title="The reader" onDismiss={onCloseReader} />}
        >
          <Suspense fallback={<PanelFallback />}>
            <ReaderPanel
              filePath={readerFilePath}
              vaultRoot={workspace.vault?.root_path ?? null}
              presentation={readerPresentation}
              onClose={onCloseReader}
            />
          </Suspense>
        </ErrorBoundary>
      )}

      {tasksOpen && nativeReady && workspace.vault ? (
        <ErrorBoundary
          name="tasks-panel"
          fallback={<PanelErrorFallback title="Tasks" onDismiss={onCloseTasks} />}
        >
          <Suspense fallback={<PanelFallback />}>
            <TaskPanel
              vaultOpen={Boolean(workspace.vault)}
              onClose={onCloseTasks}
              onOpenNote={(path) => void workspace.openNote(path)}
              runSourceNoteMutation={workspace.runNoteMutation}
              calendarConfig={workspace.vaultConfig.calendar_sync}
            />
          </Suspense>
        </ErrorBoundary>
      ) : null}

      {kanbanOpen && nativeReady && workspace.vault && workspace.activePath ? (
        <ErrorBoundary
          name="kanban-panel"
          resetKeys={[workspace.activePath]}
          fallback={<PanelErrorFallback title="Kanban" onDismiss={onCloseKanban} />}
        >
          <Suspense fallback={<PanelFallback />}>
            <KanbanPanel
              notePath={workspace.activePath}
              onClose={onCloseKanban}
              runSourceNoteMutation={workspace.runNoteMutation}
            />
          </Suspense>
        </ErrorBoundary>
      ) : null}

      {bibliographyOpen && setBibliographyOpen && (
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
                      showToast?.(`Bibliography saved to ${bibPath}`)
                      refreshBibliography?.()
                    }
                  : undefined
              }
              onImportZotero={
                nativeReady
                  ? async (apiKey: string) => {
                      const { ZoteroConnector } = await import('@scriptor/zotero-connector')
                      const connector = new ZoteroConnector()
                      await connector.connect(apiKey)
                      const bibtex = await connector.exportBibTeX()
                      const bibPath = workspace.vaultConfig.export.bibliography_path || 'references.bib'
                      const encoder = new TextEncoder()
                      await vaultSaveAsset(bibPath, Array.from(encoder.encode(bibtex)))
                      await indexerApplyFilesystemChanges([bibPath])
                      showToast?.(`Zotero library imported to ${bibPath}`)
                      refreshBibliography?.()
                    }
                  : undefined
              }
            />
          </Suspense>
        </ErrorBoundary>
      )}

      {gmailManagerOpen && setGmailManagerOpen && nativeReady && workspace.vault && gmailEnabled && (
        <ErrorBoundary
          name="gmail-manager-panel"
          fallback={<PanelErrorFallback title="Gmail Manager" onDismiss={() => setGmailManagerOpen(false)} />}
        >
          <Suspense fallback={<PanelFallback />}>
            <GmailManagerPanel
              onClose={() => setGmailManagerOpen(false)}
              onImportNote={async (subject, markdown, messageId) => {
                const title = gmailImportedNoteTitle(subject, messageId)
                const path = await workspace.createNote(title, markdown, { requireMissing: true })
                if (!path) {
                  throw new Error(`Could not import Gmail message ${messageId}; the target note already exists or could not be saved.`)
                }
                showToast?.(`Imported email to ${path}`)
              }}
            />
          </Suspense>
        </ErrorBoundary>
      )}

      {graphOpen && (
        <ErrorBoundary
          name="graph-panel"
          resetKeys={[workspace.activePath]}
          fallback={<PanelErrorFallback title="The graph" onDismiss={onCloseGraph ?? (() => {})} />}
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
              onDepthChange={(depth) => setGraphDepth?.(depth)}
              onRefresh={(fullVault) => {
                setGraphFullVault?.(fullVault)
                void workspace.loadGraph(fullVault ? null : workspace.activePath, {
                  depth: graphDepth,
                  fullVault,
                })
              }}
              onSelectNode={(path) => {
                void workspace.openNote(path)
                void workspace.loadGraph(path, { depth: graphDepth, fullVault: graphFullVault })
              }}
              onClose={onCloseGraph ?? (() => {})}
              onOpenWorkbench={() => {
                onCloseGraph?.()
                onOpenWorkbenchFromGraph?.()
              }}
              hibernated={hibernateGraph}
              onToggleHibernate={() => setHibernateGraph?.((prev) => !prev)}
            />
          </Suspense>
        </ErrorBoundary>
      )}

      {gitPanelOpen && (
        <ErrorBoundary
          name="git-panel"
          fallback={<PanelErrorFallback title="The Git panel" onDismiss={onCloseGit ?? (() => {})} />}
        >
          <Suspense fallback={<PanelFallback />}>
            <GitPanel
              status={workspace.gitStatus}
              statusError={workspace.gitStatusError}
              isStatusLoading={workspace.isGitStatusLoading}
              activePath={workspace.activePath}
              isBusy={workspace.isGitBusy}
              presentation={panelPresentation}
              onClose={onCloseGit ?? (() => {})}
              onRefresh={onRefreshGit ?? (() => {})}
              onCommit={onCommitGit ?? (() => {})}
              onPull={onPullGit ?? (() => {})}
              onPush={onPushGit ?? (() => {})}
              onResolveConflict={onResolveConflictGit ?? (() => {})}
              onOpenNote={onOpenNoteFromGit ?? (() => {})}
              readNoteAtHead={gitReadHead}
              readNoteWorking={gitReadWorking}
            />
          </Suspense>
        </ErrorBoundary>
      )}

      {mcpPanelOpen && mcp && (
        <ErrorBoundary
          name="mcp-panel"
          fallback={<PanelErrorFallback title="The MCP panel" onDismiss={onCloseMcp ?? (() => {})} />}
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
              onClose={onCloseMcp ?? (() => {})}
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
              aiEnabled={ai?.enabled ?? false}
              onGenerateDraft={() => {
                if (!promptText || !ai) return
                void (async () => {
                  try {
                    const prompt = await promptText({
                      title: 'Assistant draft',
                      label: 'Describe the edit you want the assistant to draft',
                      defaultValue: '',
                      submitLabel: 'Draft',
                    })
                    if (!prompt || !workspace.activePath) return
                    const proposed = await ai.proposeDraftFromPrompt(prompt, workspace.draftMarkdown)
                    await mcp.proposeDraftForActiveNote(proposed, `AI draft: ${prompt}`)
                  } catch (error) {
                    showToast?.(`Assistant draft failed: ${error instanceof Error ? error.message : String(error)}`)
                  }
                })()
              }}
            />
          </Suspense>
        </ErrorBoundary>
      )}
    </>
  )
}

export const WorkspacePanelLaunchers = memo(WorkspacePanelLaunchersImpl)
