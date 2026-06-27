import { useCallback, useState } from 'react'

import { COMMAND_SHORTCUT_REGISTRY } from '../lib/commandShortcutRegistry'
import { isValidShortcut, useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts'

export function KeyboardShortcutEditor() {
  const { getShortcut, setShortcut, resetShortcut, resetAllShortcuts, hasOverride } =
    useKeyboardShortcuts()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [error, setError] = useState<string | null>(null)

  const handleStartEdit = useCallback(
    (commandId: string) => {
      const current = getShortcut(
        commandId,
        COMMAND_SHORTCUT_REGISTRY.find((c) => c.id === commandId)?.defaultShortcut,
      )
      setEditingId(commandId)
      setDraft(current ?? '')
      setError(null)
    },
    [getShortcut],
  )

  const handleSave = useCallback(
    (commandId: string) => {
      const trimmed = draft.trim()
      if (!trimmed) {
        setShortcut(commandId, null)
        setEditingId(null)
        setError(null)
        return
      }
      if (!isValidShortcut(trimmed)) {
        setError('Invalid shortcut. Use Ctrl+K, Alt+O, Shift+F, F2, etc.')
        return
      }
      setShortcut(commandId, trimmed)
      setEditingId(null)
      setError(null)
    },
    [draft, setShortcut],
  )

  const handleReset = useCallback(
    (commandId: string) => {
      resetShortcut(commandId)
      setEditingId(null)
      setError(null)
    },
    [resetShortcut],
  )

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent, commandId: string) => {
      if (event.key === 'Enter') {
        event.preventDefault()
        handleSave(commandId)
      } else if (event.key === 'Escape') {
        event.preventDefault()
        setEditingId(null)
        setError(null)
      }
    },
    [handleSave],
  )

  return (
    <div className="settings-section">
      <h3>Keyboard shortcuts</h3>
      <p className="health-subtitle">
        Click a shortcut to edit. Use modifiers like Ctrl, Alt, Shift, Meta plus a key.
      </p>
      <div className="settings-actions" style={{ marginBottom: '0.75rem' }}>
        <button
          type="button"
          className="toolbar-button"
          onClick={() => {
            resetAllShortcuts()
            setEditingId(null)
            setError(null)
          }}
        >
          Reset all to defaults
        </button>
      </div>
      {error && editingId ? <p className="settings-status warn">{error}</p> : null}
      <table className="shortcut-editor-table">
        <thead>
          <tr>
            <th>Command</th>
            <th>Shortcut</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {COMMAND_SHORTCUT_REGISTRY.map((entry) => {
            const current = getShortcut(entry.id, entry.defaultShortcut)
            const isEditing = editingId === entry.id
            const overridden = hasOverride(entry.id)

            return (
              <tr key={entry.id}>
                <td>{entry.label}</td>
                <td>
                  {isEditing ? (
                    <input
                      type="text"
                      className="shortcut-input"
                      value={draft}
                      onChange={(event) => {
                        setDraft(event.target.value)
                        setError(null)
                      }}
                      onKeyDown={(event) => handleKeyDown(event, entry.id)}
                      onBlur={() => handleSave(entry.id)}
                      placeholder="e.g. Ctrl+K"
                      autoFocus
                    />
                  ) : (
                    <button
                      type="button"
                      className="shortcut-display"
                      onClick={() => handleStartEdit(entry.id)}
                      title="Click to edit"
                    >
                      {current ?? <span className="shortcut-empty">None</span>}
                    </button>
                  )}
                </td>
                <td>
                  {overridden ? (
                    <button
                      type="button"
                      className="toolbar-button"
                      onClick={() => handleReset(entry.id)}
                      title="Reset to default"
                    >
                      Reset
                    </button>
                  ) : null}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
