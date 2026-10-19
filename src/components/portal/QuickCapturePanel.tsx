import { memo, useRef, useState, type FormEvent } from 'react'
import { Check, Plus, StickyNote, Trash2 } from 'lucide-react'

import type { QuickTodoItem, ScratchpadState } from '@scriptor/portal'

import { UnifiedPanelShell } from '../chrome/UnifiedPanelShell'
import type { PanelPresentation } from '../../hooks/usePanelPresentation'
import { useI18n } from '../../lib/i18n'

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

export const QuickCapturePanel = memo(function QuickCapturePanel({
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
  const { t } = useI18n()
  const [todoDraft, setTodoDraft] = useState('')
  const todoInputRef = useRef<HTMLInputElement>(null)
  const addTodo = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const text = todoDraft.trim()
    if (!text) return
    onAddTodo(text)
    setTodoDraft('')
    todoInputRef.current?.focus()
  }

  return (
    <UnifiedPanelShell
      title={t('quickCapture.title')}
      subtitle={t('quickCapture.subtitle')}
      icon={<StickyNote size={18} />}
      ariaLabel={t('quickCapture.title')}
      helpTopic="capture"
      onClose={onClose}
      presentation={presentation}
      className="quick-capture-panel knowledge-filters-panel"
    >
      <div className="quick-capture-body knowledge-filter-body">
        <section>
          <div className="quick-capture-section-header">
            <h3>{t('quickCapture.scratchpad')}</h3>
            <div className="quick-capture-actions">
              {onCreateInboxNoteFromScratchpad ? (
                <button type="button" className="toolbar-button" disabled={!scratchpad.body.trim()} onClick={onCreateInboxNoteFromScratchpad}>
                  {t('quickCapture.saveToInbox')}
                </button>
              ) : null}
              {onPromoteScratchpadToNote ? (
                <button type="button" className="toolbar-button" disabled={!scratchpad.body.trim()} onClick={onPromoteScratchpadToNote}>
                  {t('quickCapture.insertIntoOpenNote')}
                </button>
              ) : null}
            </div>
          </div>
          <textarea
            className="scratchpad-editor"
            aria-label={t('quickCapture.scratchpadAria')}
            rows={8}
            value={scratchpad.body}
            onChange={(event) => onScratchpadChange(event.target.value)}
            placeholder={t('quickCapture.scratchpadPlaceholder')}
          />
        </section>

        <section>
          <div className="quick-capture-section-header">
            <h3>{t('quickCapture.todos')}</h3>
          </div>
          <form className="quick-todo-compose" onSubmit={addTodo}>
            <input
              ref={todoInputRef}
              aria-label={t('quickCapture.newTodo')}
              placeholder={t('quickCapture.todoPlaceholder')}
              value={todoDraft}
              onChange={(event) => setTodoDraft(event.target.value)}
            />
            <button type="submit" className="toolbar-button" disabled={!todoDraft.trim()}>
              <Plus size={14} aria-hidden="true" />
              {t('quickCapture.add')}
            </button>
          </form>
          <ul className="quick-todo-list">
            {todos.length === 0 ? (
              <li className="empty-state">{t('quickCapture.noTodos')}</li>
            ) : (
              todos.map((todo) => (
                <li key={todo.id} className={todo.done ? 'done' : undefined}>
                  <button
                    type="button"
                    className={todo.done ? 'icon-button done' : 'icon-button'}
                    aria-label={t(todo.done ? 'quickCapture.markIncomplete' : 'quickCapture.markComplete')}
                    onClick={() => onToggleTodo(todo.id)}
                  >
                    <Check size={14} />
                  </button>
                  <input
                    value={todo.text}
                    aria-label={t('quickCapture.todoText', { text: todo.text.slice(0, 40) })}
                    onChange={(event) => onUpdateTodo(todo.id, event.target.value)}
                  />
                  <div className="quick-todo-actions">
                    {onCreateNoteFromTodo ? (
                      <button type="button" className="toolbar-button" onClick={() => onCreateNoteFromTodo(todo.id)}>
                        {t('quickCapture.toNote')}
                      </button>
                    ) : null}
                    <button type="button" className="icon-button" onClick={() => onDeleteTodo(todo.id)} aria-label={t('quickCapture.deleteTodo')}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </li>
              ))
            )}
          </ul>
        </section>

        <section>
          <button type="button" className="primary-button" onClick={onAddSticky}>
            <StickyNote size={14} />
            {t('quickCapture.addSticky')}
          </button>
        </section>
      </div>
    </UnifiedPanelShell>
  )
})