import { memo, useCallback, useEffect, useRef, useState } from 'react'
import { nextAvailableSnippetName, snippetNameTaken } from '../lib/snippetNames'
import { MutationConfirmation } from './chrome/MutationConfirmation'
import { Plus, Save, Trash2, X } from 'lucide-react'

import { vaultLoadSnippets, vaultSaveSnippets } from '../bridge/commands'
import { useEscapeToClose } from '../hooks/useEscapeToClose'
import { useFocusTrap } from '../hooks/useFocusTrap'
import type { VaultSnippet } from '../types/vault'

interface SnippetsPanelProps {
  vaultOpen: boolean
  vaultId?: string
  onClose: () => void
  onSaved?: () => void
}

export const SnippetsPanel = memo(function SnippetsPanel({ vaultOpen, vaultId, onClose, onSaved }: SnippetsPanelProps) {
  const [snippets, setSnippets] = useState<VaultSnippet[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  // Keep the current selection stable while the user replaces a whole name.
  const [nameDraft, setNameDraft] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)
  const [savedBaseline, setSavedBaseline] = useState('[]')
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  const dirty = JSON.stringify(snippets) !== savedBaseline || nameDraft !== null
  const requestClose = () => {
    if (isSaving) return
    if (dirty) setConfirmDiscard(true)
    else onClose()
  }

  useEscapeToClose(true, confirmDiscard ? () => setConfirmDiscard(false) : requestClose)
  const dialogRef = useRef<HTMLElement>(null)
  useFocusTrap(dialogRef, { active: true })

  useEffect(() => {
    if (!vaultOpen) return
    let active = true
    void vaultLoadSnippets()
      .then((loaded) => {
        if (!active) return
        setSnippets(loaded)
        setSavedBaseline(JSON.stringify(loaded))
        setStatus(null)
        setSelected(loaded[0]?.name ?? null)
        setNameDraft(null)
      })
      .catch((caught) => {
        if (!active) return
        setError(caught instanceof Error ? caught.message : String(caught))
      })
    return () => {
      active = false
    }
  }, [vaultOpen, vaultId])

  const active = snippets.find((snippet) => snippet.name === selected) ?? null

  const updateActive = useCallback((patch: Partial<VaultSnippet>) => {
    if (!selected) return
    setStatus(null)
    setSnippets((current) =>
      current.map((snippet) => (snippet.name === selected ? { ...snippet, ...patch } : snippet)),
    )
  }, [selected])

  const addSnippet = () => {
    const name = nextAvailableSnippetName(snippets)
    const next = { name, content: '${1:placeholder}', description: 'New snippet' }
    setSnippets((current) => [...current, next])
    setSelected(name)
    setNameDraft(null)
    setError(null)
    setStatus(null)
  }

  const removeSnippet = () => {
    if (!selected) return
    const index = snippets.findIndex((snippet) => snippet.name === selected)
    const remaining = snippets.filter((snippet) => snippet.name !== selected)
    setSnippets(remaining)
    setSelected(remaining[Math.min(index, remaining.length - 1)]?.name ?? null)
    setNameDraft(null)
    setStatus(null)
    setError(null)
  }

  const save = async () => {
    const stagedName = selected && nameDraft !== null ? nameDraft.trim() : null
    const next = stagedName === null ? snippets : snippets.map((snippet) =>
      snippet.name === selected ? { ...snippet, name: stagedName } : snippet)
    const names = next.map((snippet) => snippet.name.trim().toLowerCase())
    if (new Set(names).size !== names.length || next.some((snippet) => !snippet.name.trim() || !snippet.content.trim())) {
      setError('Each snippet needs a unique name and some text before it can be saved.')
      return
    }
    const saved = next.map((snippet) => ({ ...snippet, name: snippet.name.trim() }))
    setIsSaving(true)
    setError(null)
    setStatus(null)
    try {
      await vaultSaveSnippets(saved, vaultId)
      setSnippets(saved)
      if (stagedName !== null) setSelected(stagedName)
      setNameDraft(null)
      setSavedBaseline(JSON.stringify(saved))
      setStatus('Snippets saved.')
      onSaved?.()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught))
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="modal-backdrop" role="presentation" onClick={requestClose}>
      <section ref={dialogRef} className="snippets-panel" data-help-topic="snippets" role="dialog" aria-modal="true" aria-label="Snippet catalog" onClick={(event) => event.stopPropagation()}>
        <header>
          <div>
            <h2>Snippet catalog</h2>
            <p className="health-subtitle">Save reusable text blocks here, then insert them into notes when you need them.</p>
          </div>
          <button type="button" className="icon-button" onClick={requestClose} aria-label="Close" disabled={isSaving}>
            <X />
          </button>
        </header>

        {error ? <p className="preview-error" role="alert">{error}</p> : null}
        {status ? <p className="settings-status ok" role="status">{status}</p> : null}

        <div className="snippets-layout">
          <aside>
            <button type="button" className="toolbar-button" onClick={addSnippet} disabled={isSaving}>
              <Plus size={14} />
              New snippet
            </button>
            <ul>
              {snippets.map((snippet) => (
                <li key={snippet.name}>
                  <button
                    type="button"
                    className={selected === snippet.name ? 'active' : undefined}
                    aria-current={selected === snippet.name ? 'true' : undefined}
                    onClick={() => {
                      setSelected(snippet.name)
                      setNameDraft(null)
                      setError(null)
                    }}
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
                  aria-label="Name"
                  value={nameDraft ?? active.name}
                  disabled={isSaving}
                  onChange={(event) => {
                    setNameDraft(event.target.value)
                    setError(null)
                    setStatus(null)
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') { event.preventDefault(); event.currentTarget.blur() }
                  }}
                  onBlur={() => {
                    if (nameDraft === null) return
                    const nextName = nameDraft.trim()
                    if (!nextName) { setError('Give this snippet a name.'); return }
                    if (snippetNameTaken(snippets, selected, nextName)) {
                      setError('Another snippet already uses this name.')
                      return
                    }
                    setSnippets((current) => current.map((snippet) =>
                      snippet.name === selected ? { ...snippet, name: nextName } : snippet))
                    setSelected(nextName)
                    setNameDraft(null)
                    setError(null)
                  }}
                />
              </label>
              <label>
                <span>Description</span>
                <input
                  aria-label="Description"
                  value={active.description ?? ''}
                  disabled={isSaving}
                  onChange={(event) => updateActive({ description: event.target.value })}
                />
              </label>
              <label>
                <span>Content</span>
                <textarea
                  aria-label="Content"
                  rows={12}
                  value={active.content}
                  disabled={isSaving}
                  onChange={(event) => updateActive({ content: event.target.value })}
                  spellCheck={false}
                />
              </label>
            </div>
          ) : (
            <p className="empty-state">Select or create a snippet.</p>
          )}
        </div>

        <footer className={`snippets-footer${confirmDiscard ? ' is-confirming' : ''}`}>
          {confirmDiscard ? <MutationConfirmation
            ariaLabel="Discard unsaved snippet edits"
            message="Your snippet changes have not been saved. Close without keeping them?"
            confirmLabel="Discard changes"
            onCancel={() => setConfirmDiscard(false)}
            onConfirm={onClose}
          /> : <>
            <button type="button" className="toolbar-button" disabled={!selected || isSaving} onClick={removeSnippet}>
              <Trash2 size={14} />
              Delete
            </button>
            <button type="button" className="primary-button" disabled={isSaving || !dirty} onClick={() => void save()}>
              <Save size={14} />
              {isSaving ? 'Saving…' : 'Save catalog'}
            </button>
          </>}
        </footer>
      </section>
    </div>
  )
})
