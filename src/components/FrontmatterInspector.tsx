import { useRef, useState } from 'react'
import { useEscapeToClose } from '../hooks/useEscapeToClose'
import { useFocusTrap } from '../hooks/useFocusTrap'
import { X } from 'lucide-react'

import { vaultReadNote, vaultSaveNote } from '../bridge/commands'
import { applyFrontmatterChanges } from '../lib/frontmatterBatch'

function stringifyFields(fields: Record<string, unknown>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(fields).map(([key, value]) => [key, value == null ? '' : String(value)]),
  )
}

interface FrontmatterInspectorProps {
  path: string
  fields: Record<string, unknown>
  expectedVaultId: string
  expectedContentHash: string
  noteHasUnsavedChanges: boolean
  runNoteMutation: (path: string, mutation: () => Promise<void>) => Promise<boolean>
  onClose: () => void
  onSaved: () => void | Promise<void>
}

export function FrontmatterInspector({
  path, fields, expectedVaultId, expectedContentHash, noteHasUnsavedChanges,
  runNoteMutation, onClose, onSaved,
}: FrontmatterInspectorProps) {
  // Keep both original form values and its compare-and-swap hash frozen for
  // this editing session. They are render data, not imperative refs.
  const [initial] = useState<Record<string, string>>(() => stringifyFields(fields))
  const [revisionAtOpen] = useState(() => expectedContentHash)
  const [draft, setDraft] = useState<Record<string, string>>(() => stringifyFields(fields))
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  const dialogRef = useRef<HTMLElement>(null)
  const entries = Object.keys(draft).sort((left, right) => left.localeCompare(right))
  const changes = entries.filter(field => draft[field] !== initial[field])
  const dirty = changes.length > 0

  const requestClose = () => {
    if (busy) return
    if (dirty) setConfirmDiscard(true)
    else onClose()
  }
  useEscapeToClose(true, () => { if (confirmDiscard) setConfirmDiscard(false); else requestClose() })
  useFocusTrap(dialogRef, { active: true })

  const saveChanges = async () => {
    if (busy || !dirty || !expectedVaultId || !revisionAtOpen || noteHasUnsavedChanges) return
    setBusy(true)
    setStatus('Saving changes…')
    setError('')
    try {
      // Coordinate with the editor autosave queue and write the entire note
      // once with compare-and-swap. Per-field writes can partially commit.
      const allowed = await runNoteMutation(path, async () => {
        const note = await vaultReadNote(path, expectedVaultId)
        if (note.metadata.path !== path || note.metadata.vault_id !== expectedVaultId || note.metadata.content_hash !== revisionAtOpen) {
          throw new Error('The note changed on disk. Your edits were retained; reload the note before saving.')
        }
        const updated = applyFrontmatterChanges(note.markdown,
          Object.fromEntries(changes.map(field => [field, draft[field] ?? ''])))
        await vaultSaveNote(path, updated, revisionAtOpen, false, expectedVaultId)
      })
      if (!allowed) throw new Error('The note is currently saving. Retry once the editor finishes.')
      setStatus('Saved all changed fields.')
      try { await onSaved() } catch {
        setStatus('Changes saved. Refresh the note to display its updated metadata.')
      }
      onClose()
    } catch (caught) {
      setStatus('')
      setError(caught instanceof Error ? caught.message : String(caught))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="modal-backdrop" role="presentation" onClick={requestClose}>
      <section ref={dialogRef} className="rename-dialog frontmatter-inspector" data-help-topic="frontmatter"
        role="dialog" aria-modal="true" aria-label="Frontmatter" onClick={event => event.stopPropagation()}>
        <header>
          <h2>Frontmatter</h2>
          <button type="button" className="icon-button" onClick={requestClose} disabled={busy} aria-label="Close"><X /></button>
        </header>
        <p className="health-subtitle">{path}</p>
        {entries.length === 0 ? <p className="empty-state">No frontmatter fields on this note.</p> : (
          <ul className="frontmatter-fields">
            {entries.map(field => (
              <li key={field} data-dirty={changes.includes(field) ? 'true' : undefined}>
                <label>
                  <span>{field}{changes.includes(field) && <span className="frontmatter-dirty-marker" aria-hidden="true"> · Changed</span>}</span>
                  <input aria-label={field} value={draft[field] ?? ''} disabled={busy || confirmDiscard}
                    onChange={event => { setDraft(current => ({ ...current, [field]: event.target.value })); setError('') }} />
                </label>
              </li>
            ))}
          </ul>
        )}
        {noteHasUnsavedChanges ? <p role="alert">Save the note in the editor first, then reopen Frontmatter to avoid overwriting unsaved text.</p> : null}
        {error ? <p className="settings-status" role="alert">{error}</p>
          : status ? <p className="settings-status" role="status">{status}</p> : null}
        <footer className="frontmatter-actions">
          <span role="status">{dirty ? `${changes.length} unsaved ${changes.length === 1 ? 'field' : 'fields'}` : 'No pending changes'}</span>
          <button type="button" className="toolbar-button" disabled={busy} onClick={requestClose}>Cancel</button>
          <button type="button" className="primary-button" disabled={busy || !dirty || noteHasUnsavedChanges || !revisionAtOpen || !expectedVaultId}
            onClick={() => void saveChanges()}>{busy ? 'Saving…' : 'Save changes'}</button>
        </footer>
        {confirmDiscard ? (
          <div className="frontmatter-discard" role="alert" aria-live="polite">
            <p>Discard your unsaved metadata changes?</p>
            <button type="button" className="toolbar-button" onClick={() => setConfirmDiscard(false)}>Keep editing</button>
            <button type="button" className="danger-button" onClick={onClose}>Discard changes</button>
          </div>
        ) : null}
      </section>
    </div>
  )
}
