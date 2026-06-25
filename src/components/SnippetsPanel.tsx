import { useCallback, useEffect, useState } from 'react'
import { Plus, Save, Trash2, X } from 'lucide-react'

import { vaultLoadSnippets, vaultSaveSnippets } from '../bridge/commands'
import { useEscapeToClose } from '../hooks/useEscapeToClose'
import type { VaultSnippet } from '../types/vault'

interface SnippetsPanelProps {
  vaultOpen: boolean
  onClose: () => void
  onSaved?: () => void
}

export function SnippetsPanel({ vaultOpen, onClose, onSaved }: SnippetsPanelProps) {
  const [snippets, setSnippets] = useState<VaultSnippet[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEscapeToClose(true, onClose)

  useEffect(() => {
    if (!vaultOpen) return
    void vaultLoadSnippets()
      .then((loaded) => {
        setSnippets(loaded)
        setSelected(loaded[0]?.name ?? null)
      })
      .catch((caught) => setError(caught instanceof Error ? caught.message : String(caught)))
  }, [vaultOpen])

  const active = snippets.find((snippet) => snippet.name === selected) ?? null

  const updateActive = useCallback((patch: Partial<VaultSnippet>) => {
    if (!selected) return
    setSnippets((current) =>
      current.map((snippet) => (snippet.name === selected ? { ...snippet, ...patch } : snippet)),
    )
  }, [selected])

  const addSnippet = () => {
    const name = `snippet-${snippets.length + 1}`
    const next = { name, content: '${1:placeholder}', description: 'New snippet' }
    setSnippets((current) => [...current, next])
    setSelected(name)
  }

  const removeSnippet = () => {
    if (!selected) return
    setSnippets((current) => current.filter((snippet) => snippet.name !== selected))
    setSelected(null)
  }

  const save = async () => {
    setIsSaving(true)
    setError(null)
    try {
      await vaultSaveSnippets(snippets)
      onSaved?.()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught))
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <section className="snippets-panel" role="dialog" aria-label="Snippet catalog" onClick={(event) => event.stopPropagation()}>
        <header>
          <div>
            <h2>Snippet catalog</h2>
            <p className="health-subtitle">Manage `.scriptor/snippets.json` for editor autocomplete and palette inserts.</p>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close">
            <X />
          </button>
        </header>

        {error ? <p className="preview-error">{error}</p> : null}

        <div className="snippets-layout">
          <aside>
            <button type="button" className="toolbar-button" onClick={addSnippet}>
              <Plus size={14} />
              New snippet
            </button>
            <ul>
              {snippets.map((snippet) => (
                <li key={snippet.name}>
                  <button
                    type="button"
                    className={selected === snippet.name ? 'active' : undefined}
                    onClick={() => setSelected(snippet.name)}
                  >
                    {snippet.name}
                  </button>
                </li>
              ))}
            </ul>
          </aside>

          {active ? (
            <div className="snippets-editor">
              <label>
                <span>Name</span>
                <input
                  value={active.name}
                  onChange={(event) => {
                    const nextName = event.target.value
                    setSnippets((current) =>
                      current.map((snippet) =>
                        snippet.name === selected ? { ...snippet, name: nextName } : snippet,
                      ),
                    )
                    setSelected(nextName)
                  }}
                />
              </label>
              <label>
                <span>Description</span>
                <input
                  value={active.description ?? ''}
                  onChange={(event) => updateActive({ description: event.target.value })}
                />
              </label>
              <label>
                <span>Content</span>
                <textarea
                  rows={12}
                  value={active.content}
                  onChange={(event) => updateActive({ content: event.target.value })}
                  spellCheck={false}
                />
              </label>
            </div>
          ) : (
            <p className="empty-state">Select or create a snippet.</p>
          )}
        </div>

        <footer className="snippets-footer">
          <button type="button" className="toolbar-button" disabled={!selected} onClick={removeSnippet}>
            <Trash2 size={14} />
            Delete
          </button>
          <button type="button" className="primary-button" disabled={isSaving} onClick={() => void save()}>
            <Save size={14} />
            {isSaving ? 'Saving…' : 'Save catalog'}
          </button>
        </footer>
      </section>
    </div>
  )
}
