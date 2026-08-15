import { Suspense } from 'react'
import type { ComponentProps } from 'react'

import { ErrorBoundary } from '../ErrorBoundary'
import { PanelErrorFallback } from '../PanelErrorFallback'
import { ReaderPanel } from '../reader'
import { CanvasPanel, KanbanPanel, PanelFallback, TaskPanel } from './lazyPanels'
import type { usePluginRegistry } from '../../hooks/usePluginRegistry'
import type { useVaultWorkspace } from '../../hooks/useVaultWorkspace'

type WorkspacePanelLaunchersProps = {
  workspace: ReturnType<typeof useVaultWorkspace>
  plugins: ReturnType<typeof usePluginRegistry>
  nativeReady: boolean
  canvasOpen: boolean
  readerOpen: boolean
  readerFilePath: string | null
  tasksOpen: boolean
  kanbanOpen: boolean
  readerPresentation: ComponentProps<typeof ReaderPanel>['presentation']
  onCloseCanvas: () => void
  onCloseReader: () => void
  onCloseTasks: () => void
  onCloseKanban: () => void
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
          <ReaderPanel
            filePath={readerFilePath}
            vaultRoot={workspace.vault?.root_path ?? null}
            presentation={readerPresentation}
            onClose={onCloseReader}
          />
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
    </>
  )
}
