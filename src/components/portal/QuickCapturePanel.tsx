import { Check, Plus, StickyNote, Trash2 } from 'lucide-react'

import type { QuickTodoItem, ScratchpadState } from '@scriptor/portal'

import { UnifiedPanelShell } from '../chrome/UnifiedPanelShell'
import type { PanelPresentation } from '../../hooks/usePanelPresentation'

interface QuickCapturePanelProps {
  scratchpad: ScratchpadState
  todos: QuickTodoItem[]
  presentation?: PanelPresentation
  onClose: () => void
  onScratchpadChange: (body: string) => void
  onAddTodo: (text: string) => void
  onToggleTodo: (id: string) => void
  onUpdateTodo: (id: string, text: string) => void
  onDeleteTodo: (id: string) => void
  onAddSticky: () => void
  onPromoteScratchpadToNote?: () => void
  onCreateInboxNoteFromScratchpad?: () => void
  onCreateNoteFromTodo?: (id: string) => void
}

export function QuickCapturePanel({
  scratchpad,
  todos,
  presentation = 'dock-right',
  onClose,
  onScratchpadChange,
  onAddTodo,
  onToggleTodo,
  onUpdateTodo,
  onDeleteTodo,
  onAddSticky,
  onPromoteScratchpadToNote,
  onCreateInboxNoteFromScratchpad,
  onCreateNoteFromTodo,
}: QuickCapturePanelProps) {
  return (
    <UnifiedPanelShell
      title="Quick capture"
      subtitle="Scratchpad, todos, and sticky notes"
      icon={<StickyNote size={18} />}
      ariaLabel="Quick capture"
      onClose={onClose}
      presentation={presentation}
      className="quick-capture-panel knowledge-filters-panel"
      wide
    >
      <div className="quick-capture-body knowledge-filter-body">
        <section>
          <div className="quick-capture-section-header">
            <h3>Scratchpad</h3>
            <div className="quick-capture-actions">
              {onCreateInboxNoteFromScratchpad ? (
                <button type="button" onClick={onCreateInboxNoteFromScratchpad}>
                  New inbox note
                </button>
              ) : null}
              {onPromoteScratchpadToNote ? (
                <button type="button" onClick={onPromoteScratchpadToNote}>
                  Insert in active
                </button>
              ) : null}
            </div>
          </div>
          <textarea
            className="scratchpad-editor"
            rows={8}
            value={scratchpad.body}
            onChange={(event) => onScratchpadChange(event.target.value)}
            placeholder="Capture thoughts without creating a vault note…"
          />
        </section>

        <section>
          <div className="quick-capture-section-header">
            <h3>Todos</h3>
            <button type="button" onClick={() => onAddTodo('New task')}>
              <Plus size={14} />
              Add
            </button>
          </div>
          <ul className="quick-todo-list">
            {todos.length === 0 ? (
              <li className="empty-state">No todos yet.</li>
            ) : (
              todos.map((todo) => (
                <li key={todo.id}>
                  <button type="button" className={todo.done ? 'done' : undefined} onClick={() => onToggleTodo(todo.id)}>
                    <Check size={14} />
                  </button>
                  <input value={todo.text} onChange={(event) => onUpdateTodo(todo.id, event.target.value)} />
                  {onCreateNoteFromTodo ? (
                    <button type="button" onClick={() => onCreateNoteFromTodo(todo.id)}>
                      To note
                    </button>
                  ) : null}
                  <button type="button" onClick={() => onDeleteTodo(todo.id)} aria-label="Delete todo">
                    <Trash2 size={14} />
                  </button>
                </li>
              ))
            )}
          </ul>
        </section>

        <section>
          <button type="button" className="primary-button" onClick={onAddSticky}>
            <StickyNote size={14} />
            Add sticky note
          </button>
        </section>
      </div>
    </UnifiedPanelShell>
  )
}
