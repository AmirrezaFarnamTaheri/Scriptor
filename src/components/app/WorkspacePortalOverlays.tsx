import { Suspense } from 'react'
import type { ComponentProps } from 'react'

import { ErrorBoundary } from '../ErrorBoundary'
import { PanelErrorFallback } from '../PanelErrorFallback'
import { NoteHistoryPanel, PanelFallback, PortalPanel } from './lazyPanels'
import type { useVaultWorkspace } from '../../hooks/useVaultWorkspace'
import type { useWorkspaceStore } from '../../hooks/useWorkspaceStore'

type WorkspacePortalOverlaysProps = {
  workspace: ReturnType<typeof useVaultWorkspace>
  workspaceStore: ReturnType<typeof useWorkspaceStore>
  portalOpen: boolean
  noteHistoryOpen: boolean
  panelPresentation: ComponentProps<typeof PortalPanel>['presentation']
  onClosePortal: () => void
  onCloseNoteHistory: () => void
}

export function WorkspacePortalOverlays({
  workspace,
  workspaceStore,
  portalOpen,
  noteHistoryOpen,
  panelPresentation,
  onClosePortal,
  onCloseNoteHistory,
}: WorkspacePortalOverlaysProps) {
  return (
    <>
      {portalOpen ? (
        <ErrorBoundary
          name="portal-panel"
          fallback={<PanelErrorFallback title="The portal" onDismiss={onClosePortal} />}
        >
          <Suspense fallback={<PanelFallback />}>
            <PortalPanel
              categories={workspaceStore.portal.categories}
              itemsByCategory={workspaceStore.portalItemsByCategory}
              presentation={panelPresentation}
              onClose={onClosePortal}
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
        </ErrorBoundary>
      ) : null}

      {noteHistoryOpen ? (
        <ErrorBoundary
          name="note-history-panel"
          resetKeys={[workspace.activePath]}
          fallback={<PanelErrorFallback title="Note history" onDismiss={onCloseNoteHistory} />}
        >
          <Suspense fallback={<PanelFallback />}>
            <NoteHistoryPanel
              path={workspace.activePath}
              onClose={onCloseNoteHistory}
              onRestored={() => {
                void workspace.reloadActiveNoteFromDisk()
                onCloseNoteHistory()
              }}
            />
          </Suspense>
        </ErrorBoundary>
      ) : null}
    </>
  )
}
