import { useMemo, useState } from 'react'

import { useKeyboardShortcuts, isValidShortcut } from '../hooks/useKeyboardShortcuts'
import { COMMAND_SHORTCUT_REGISTRY } from '../lib/commandShortcutRegistry'
import { formatShortcut } from '../lib/keyboardShortcuts'

interface DraftShortcut {
  value: string
  error: string | null
}

export function KeyboardShortcutsSettingsSection() {
  const shortcuts = useKeyboardShortcuts()
  const [query, setQuery] = useState('')
  const [drafts, setDrafts] = useState<Record<string, DraftShortcut>>({})

  const visibleEntries = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    if (!normalized) return COMMAND_SHORTCUT_REGISTRY
    return COMMAND_SHORTCUT_REGISTRY.filter((entry) =>
      `${entry.label} ${entry.id}`.toLowerCase().includes(normalized),
    )
  }, [query])

  const effectiveValue = (commandId: string, defaultShortcut?: string) => {
    const draft = drafts[commandId]
    if (draft) return draft.value
    return shortcuts.getShortcut(commandId, defaultShortcut) ?? ''
  }

  const save = (commandId: string, defaultShortcut?: string) => {
    const raw = effectiveValue(commandId, defaultShortcut).trim()
    if (raw.length === 0) {
      shortcuts.setShortcut(commandId, null)
      setDrafts((current) => ({ ...current, [commandId]: { value: '', error: null } }))
      return
    }
    if (!isValidShortcut(raw)) {
      setDrafts((current) => ({
        ...current,
        [commandId]: { value: raw, error: 'Use a key with supported modifiers, for example Mod+K or Alt+G.' },
      }))
      return
    }
    shortcuts.setShortcut(commandId, raw)
    setDrafts((current) => ({ ...current, [commandId]: { value: raw, error: null } }))
  }

  const resetAll = () => {
    shortcuts.resetAllShortcuts()
    setDrafts({})
  }

  return (
    <section className="settings-section keyboard-shortcuts-settings" aria-labelledby="keyboard-shortcuts-heading">
      <div className="settings-section-heading-row">
        <div>
          <h3 id="keyboard-shortcuts-heading">Keyboard shortcuts</h3>
          <p className="health-subtitle">
            Customize command shortcuts. Leave a field empty to disable that shortcut; reset restores the built-in value.
          </p>
        </div>
        <button type="button" className="toolbar-button" onClick={resetAll}>
          Reset all
        </button>
      </div>

      <label className="settings-field">
        Search commands
        <input
          type="search"
          value={query}
          placeholder="Search commands…"
          onChange={(event) => setQuery(event.target.value)}
        />
      </label>

      <div className="shortcut-table" role="table" aria-label="Keyboard shortcuts">
        <div className="shortcut-table-header" role="row">
          <span role="columnheader">Command</span>
          <span role="columnheader">Shortcut</span>
          <span role="columnheader">Actions</span>
        </div>
        {visibleEntries.map((entry) => {
          const value = effectiveValue(entry.id, entry.defaultShortcut)
          const draft = drafts[entry.id]
          const hasOverride = shortcuts.hasOverride(entry.id)
          return (
            <div className="shortcut-table-row" role="row" key={entry.id}>
              <div role="cell" className="shortcut-command-copy">
                <strong>{entry.label}</strong>
                <small>{entry.id}</small>
              </div>
              <div role="cell">
                <label className="sr-only" htmlFor={`shortcut-${entry.id}`}>Shortcut for {entry.label}</label>
                <input
                  id={`shortcut-${entry.id}`}
                  className={draft?.error ? 'shortcut-input invalid' : 'shortcut-input'}
                  value={value}
                  placeholder={entry.defaultShortcut ?? 'Unassigned'}
                  aria-invalid={Boolean(draft?.error)}
                  aria-describedby={draft?.error ? `shortcut-error-${entry.id}` : undefined}
                  onChange={(event) => {
                    const next = event.target.value
                    setDrafts((current) => ({ ...current, [entry.id]: { value: next, error: null } }))
                  }}
                  onKeyDown={(event) => {
                    if (event.key !== 'Enter') return
                    event.preventDefault()
                    save(entry.id, entry.defaultShortcut)
                  }}
                  onBlur={() => {
                    if (!drafts[entry.id]) return
                    save(entry.id, entry.defaultShortcut)
                  }}
                />
                {draft?.error ? (
                  <small id={`shortcut-error-${entry.id}`} className="settings-field-error" role="alert">{draft.error}</small>
                ) : (
                  <small className="shortcut-effective-label">
                    {value ? `Displays as ${formatShortcut(value) ?? value}` : 'Disabled'}
                  </small>
                )}
              </div>
              <div role="cell" className="shortcut-row-actions">
                {hasOverride ? (
                  <button
                    type="button"
                    className="toolbar-button"
                    onClick={() => {
                      shortcuts.resetShortcut(entry.id)
                      setDrafts((current) => {
                        const next = { ...current }
                        delete next[entry.id]
                        return next
                      })
                    }}
                  >
                    Reset
                  </button>
                ) : (
                  <span className="shortcut-default-badge">Default</span>
                )}
              </div>
            </div>
          )
        })}
      </div>
      {visibleEntries.length === 0 ? <p className="empty-state">No commands match this search.</p> : null}
    </section>
  )
}