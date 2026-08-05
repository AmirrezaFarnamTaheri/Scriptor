import type { useVaultWorkspace } from '../../hooks/useVaultWorkspace'
import type { useWorkspaceStore } from '../../hooks/useWorkspaceStore'
import type { PanelPresentation } from '../../hooks/usePanelPresentation'
import { ErrorBoundary } from '../ErrorBoundary'
import { PanelErrorFallback } from '../PanelErrorFallback'
import { StickyNotesLayer } from '../portal/StickyNotesLayer'
import { PanelFallback, QuickCapturePanel } from './lazyPanels'
import { Suspense } from 'react'

type VaultWorkspace = ReturnType<typeof useVaultWorkspace>
type WorkspaceStore = ReturnType<typeof useWorkspaceStore>

interface QuickCaptureWorkspaceLayerProps {
  isOpen: boolean
  stickiesVisible: boolean
  presentation: PanelPresentation
  workspace: VaultWorkspace
  workspaceStore: WorkspaceStore
  onClose: () => void
}

/**
 * Owns quick-capture mutations and sticky-note persistence so the application
 * shell only decides whether the capture surface is visible.
 */
export function QuickCaptureWorkspaceLayer({
  isOpen,
  stickiesVisible,
  presentation,
  workspace,
  workspaceStore,
  onClose,
}: QuickCaptureWorkspaceLayerProps) {
  const reportCaptureFailure = (operation: string, error: unknown) => {
    workspace.logActivity(
      'error',
      `${operation} failed`,
      error instanceof Error ? error.message : String(error),
    )
  }

  const createCaptureNote = (
    operation: string,
    title: string,
    body: string,
    onCreated: () => void,
  ) => {
    void workspace
      .createNote(title, body)
      .then((createdPath) => {
        if (!createdPath) return
        onCreated()
        onClose()
      })
      .catch((error) => reportCaptureFailure(operation, error))
  }

  return (
    <>
      {isOpen ? (
        <ErrorBoundary
          name="quick-capture-panel"
          fallback={<PanelErrorFallback title="Quick capture" onDismiss={onClose} />}
        >
          <Suspense fallback={<PanelFallback />}>
            <QuickCapturePanel
              scratchpad={workspaceStore.quickCapture.scratchpad}
              todos={workspaceStore.quickCapture.todos}
              presentation={presentation}
              onClose={onClose}
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
                      onClose()
                    }
                  : undefined
              }
              onCreateInboxNoteFromScratchpad={() => {
                const body = workspaceStore.quickCapture.scratchpad.body.trim()
                if (!body) return
                createCaptureNote(
                  'Create inbox note from scratchpad',
                  `Capture ${new Date().toISOString().slice(0, 10)}`,
                  body,
                  () =>
                    workspaceStore.updateQuickCapture((capture) => ({
                      ...capture,
                      scratchpad: {
                        kind: 'scratchpad',
                        body: '',
                        updatedAt: new Date().toISOString(),
                      },
                    })),
                )
              }}
              onCreateNoteFromTodo={(id) => {
                const todo = workspaceStore.quickCapture.todos.find((entry) => entry.id === id)
                if (!todo) return
                const body = `# ${todo.text}\n\n- [ ] ${todo.text}\n`
                createCaptureNote('Create note from todo', todo.text.slice(0, 60), body, () =>
                  workspaceStore.updateQuickCapture((capture) => ({
                    ...capture,
                    todos: capture.todos.filter((entry) => entry.id !== id),
                  })),
                )
              }}
            />
          </Suspense>
        </ErrorBoundary>
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
    </>
  )
}
