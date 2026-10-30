import { useEffect, useRef, useState } from 'react'

import { vaultReadNoteHistoryRevision, vaultSaveNote } from '../bridge/commands'
import { copyReviewedRevisionAsNewNote } from '../lib/workspace/revisionCopy'
import { MutationConfirmation } from './chrome/MutationConfirmation'

interface RevisionCopyFormProps {
  sourcePath: string
  revisionId: string
  vaultId: string
  reviewedMarkdown: string
  disabled?: boolean
}

function suggestedCopyPath(sourcePath: string, revisionId: string): string {
  const cleanId = revisionId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 8) || 'revision'
  return sourcePath.replace(/\.md$/i, '') + '-recovered-' + cleanId + '.md'
}

/** An optional create-only route; it never invokes destructive history restore. */
export function RevisionCopyForm({ sourcePath, revisionId, vaultId, reviewedMarkdown, disabled = false }: RevisionCopyFormProps) {
  const [targetPath, setTargetPath] = useState(() => suggestedCopyPath(sourcePath, revisionId))
  const [confirmCopy, setConfirmCopy] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const current = useRef(false)
  const pending = useRef(false)

  useEffect(() => {
    current.current = true
    return () => { current.current = false }
  }, [])

  // A newer preview is not the reviewed source for an older confirmation.
  useEffect(() => { setConfirmCopy(false) }, [reviewedMarkdown])

  const createCopy = async () => {
    if (pending.current || disabled) return
    pending.current = true
    setBusy(true)
    setConfirmCopy(false)
    setError('')
    setMessage('')
    try {
      const createdPath = await copyReviewedRevisionAsNewNote(
        { sourcePath, revisionId, vaultId, targetPath, reviewedMarkdown },
        {
          readRevision: vaultReadNoteHistoryRevision,
          createNote: (path, markdown, expectedHash, expectedVaultId) =>
            vaultSaveNote(path, markdown, expectedHash, false, expectedVaultId),
          isCurrent: () => current.current,
        },
      )
      if (current.current) {
        setMessage('Created ' + createdPath + '. The original note was not changed.')
      }
    } catch (caught) {
      if (current.current) {
        setError(caught instanceof Error ? caught.message : String(caught))
      }
    } finally {
      pending.current = false
      if (current.current) setBusy(false)
    }
  }

  return (
    <section className="note-history-copy-section" aria-label="Non-destructive revision recovery">
      <details>
        <summary>Keep a separate recovered copy</summary>
        <p className="health-subtitle">Save the selected revision as a new Markdown note. Your current note is preserved, and an existing destination is never replaced.</p>
        <label className="settings-field">
          Destination Markdown path
          <input
            value={targetPath}
            disabled={disabled || busy}
            onChange={event => { setTargetPath(event.target.value); setConfirmCopy(false); setError(''); setMessage('') }}
          />
        </label>
        <div className="settings-actions">
          <button type="button" className="toolbar-button" disabled={disabled || busy || !targetPath.trim()} onClick={() => setConfirmCopy(true)}>
            Review separate copy
          </button>
        </div>
        {confirmCopy ? (
          <MutationConfirmation
            ariaLabel="Confirm separate revision copy"
            message={'Create ' + targetPath.trim() + ' from the reviewed revision? This creates a new note only. Your current note and existing files will not be overwritten.'}
            confirmLabel="Create separate note"
            busy={busy}
            onCancel={() => setConfirmCopy(false)}
            onConfirm={() => { void createCopy() }}
          />
        ) : null}
        {message ? <p className="settings-status ok" role="status">{message}</p> : null}
        {error ? <p className="settings-status warn" role="alert">{error}</p> : null}
      </details>
    </section>
  )
}
