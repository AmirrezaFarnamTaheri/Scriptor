import { Suspense } from 'react'
import { ErrorBoundary } from '../ErrorBoundary'
import { PanelErrorFallback } from '../PanelErrorFallback'
import type { ReaderPanelProps } from '../reader/ReaderPanel'
import {
  BibliographyPanel,
  CanvasPanel,
  GmailManagerPanel,
  KanbanPanel,
  PanelFallback,
  ReaderPanel,
  TaskPanel,
} from './lazyPanels'
import type { usePluginRegistry } from '../../hooks/usePluginRegistry'
import type { useVaultWorkspace } from '../../hooks/useVaultWorkspace'
import type { BibliographyEntry } from '../../types/vault'
import { indexerApplyFilesystemChanges, vaultSaveAsset } from '../../bridge/commands'
import { gmailImportedNoteTitle } from '../../lib/gmailRfc5322'

type WorkspacePanelLaunchersProps = {
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
}

export function WorkspacePanelLaunchers({
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
}: WorkspacePanelLaunchersProps) {
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

      {gmailManagerOpen && setGmailManagerOpen && (
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
    </>
  )
}
