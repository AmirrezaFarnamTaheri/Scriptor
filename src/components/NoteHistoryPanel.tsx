import { useEffect, useState } from 'react'
import { Clock, RotateCcw } from 'lucide-react'

import {
  vaultListNoteHistory,
  vaultReadNote,
  vaultReadNoteHistoryRevision,
  vaultRestoreNoteHistoryRevision,
} from '../bridge/commands'
import { MutationConfirmation } from './chrome/MutationConfirmation'
import { UnifiedPanelShell } from './chrome/UnifiedPanelShell'

export interface NoteHistoryRevision {
  id: string
  saved_at: string
  content_hash: string
  word_count: number
  preview: string
}

interface NoteHistoryPanelProps {
  path: string | null
  onClose: () => void
  onRestored?: () => void
}

interface RevisionState {
  path: string
  rows: NoteHistoryRevision[]
}

interface PreviewState {
  path: string
  revisionId: string
  markdown: string
}

interface CurrentNoteState {
  path: string
  markdown: string
}

/** Formats persisted revision timestamps for compact, locale-aware timeline display. */
function formatRevisionDate(value: string) {
  return new Date(value).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

/** Browses local note revisions and requires an explicit current-vs-revision comparison before restore. */
export function NoteHistoryPanel({ path, onClose, onRestored }: NoteHistoryPanelProps) {
  const [revisionState, setRevisionState] = useState<RevisionState | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [previewState, setPreviewState] = useState<PreviewState | null>(null)
  const [currentState, setCurrentState] = useState<CurrentNoteState | null>(null)
  const [status, setStatus] = useState('')
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [currentError, setCurrentError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [confirmRestore, setConfirmRestore] = useState(false)

  useEffect(() => {
    if (!path) return
    let cancelled = false
    const requestedPath = path
    setCurrentState(null)
    setCurrentError(null)
    void Promise.allSettled([
      vaultListNoteHistory(requestedPath),
      vaultReadNote(requestedPath),
    ]).then(([historyResult, currentResult]) => {
      if (cancelled) return
      if (historyResult.status === 'fulfilled') {
        const rows = historyResult.value
        setRevisionState({ path: requestedPath, rows })
        setSelectedId(rows[0]?.id ?? null)
        setStatus('')
      } else {
        setRevisionState({ path: requestedPath, rows: [] })
        setStatus(historyResult.reason instanceof Error ? historyResult.reason.message : 'Could not load note history')
      }

      if (currentResult.status === 'fulfilled') {
        setCurrentState({ path: requestedPath, markdown: currentResult.value.markdown })
      } else {
        setCurrentState(null)
        setCurrentError(currentResult.reason instanceof Error ? currentResult.reason.message : 'Could not read the current note')
      }
      setConfirmRestore(false)
    })
    return () => {
      cancelled = true
    }
  }, [path])

  useEffect(() => {
    if (!path || !selectedId) return
    let cancelled = false
    const requestedPath = path
    const requestedRevision = selectedId
    setPreviewState(null)
    setPreviewError(null)
    void vaultReadNoteHistoryRevision(requestedPath, requestedRevision)
      .then((markdown) => {
        if (!cancelled) {
          setPreviewState({ path: requestedPath, revisionId: requestedRevision, markdown })
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setPreviewState(null)
          setPreviewError(error instanceof Error ? error.message : 'Could not load this revision')
        }
      })
    return () => {
      cancelled = true
    }
  }, [path, selectedId])

  const revisions = revisionState?.path === path ? revisionState.rows : []
  const selectedRevision = revisions.find((revision) => revision.id === selectedId) ?? null
  const previewReady = previewState?.path === path && previewState.revisionId === selectedId
  const currentReady = currentState?.path === path
  const preview = previewReady ? previewState.markdown : ''
  const currentMarkdown = currentReady ? currentState.markdown : ''
  const canRestore = Boolean(selectedId && previewReady && currentReady && !previewError && !currentError)

  const restore = async () => {
    if (!path || !selectedId || !canRestore) return
    setBusy(true)
    setStatus('Restoring revision…')
    try {
      await vaultRestoreNoteHistoryRevision(path, selectedId)
      setCurrentState({ path, markdown: preview })
      setStatus('Revision restored.')
      setConfirmRestore(false)
      onRestored?.()
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Restore failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <UnifiedPanelShell
      title="Note history"
      subtitle={path ?? 'Open a note to browse local revisions.'}
      icon={<Clock size={18} />}
      ariaLabel="Note history"
      onClose={onClose}
      className="note-history-panel knowledge-filters-panel"
      wide
    >
      {!path ? (
        <p className="empty-state">Select a note to view its revision timeline.</p>
      ) : revisions.length === 0 ? (
        <p className="empty-state">No saved revisions yet. Edits are captured before each save.</p>
      ) : (
        <div className="note-history-layout">
          <ul className="note-history-timeline" aria-label="Saved revisions">
            {revisions.map((revision) => (
              <li key={revision.id}>
                <button
                  type="button"
                  className={selectedId === revision.id ? 'active' : ''}
                  aria-pressed={selectedId === revision.id}
                  onClick={() => {
                    setSelectedId(revision.id)
                    setConfirmRestore(false)
                  }}
                >
                  <strong>{formatRevisionDate(revision.saved_at)}</strong>
                  <span>{revision.word_count.toLocaleString()} words</span>
                  <span className="note-history-preview">{revision.preview || revision.content_hash.slice(0, 8)}</span>
                </button>
              </li>
            ))}
          </ul>
          <div className="note-history-preview-pane">
            <header className="note-history-preview-header">
              <div>
                <strong>Compare before restoring</strong>
                <span>{selectedRevision ? formatRevisionDate(selectedRevision.saved_at) : 'Select a revision'}</span>
              </div>
              <button
                type="button"
                className="toolbar-button note-history-restore"
                disabled={busy || !canRestore}
                onClick={() => setConfirmRestore(true)}
              >
                <RotateCcw size={14} />
                Restore revision
              </button>
            </header>
            {confirmRestore && selectedRevision ? (
              <MutationConfirmation
                ariaLabel="Confirm revision restore"
                message={`Restore the ${formatRevisionDate(selectedRevision.saved_at)} revision? Your current note content will be replaced.`}
                confirmLabel="Restore revision"
                busy={busy}
                onCancel={() => setConfirmRestore(false)}
                onConfirm={() => void restore()}
                className="note-history-restore-confirmation"
              />
            ) : null}
            {previewError ? (
              <p className="settings-status warn" role="alert">
                Revision preview unavailable: {previewError}. Restore is disabled until the revision can be read.
              </p>
            ) : null}
            {currentError ? (
              <p className="settings-status warn" role="alert">
                Current note preview unavailable: {currentError}. Restore is disabled until the current note can be compared.
              </p>
            ) : null}
            <div className="note-history-compare" aria-label="Current note and selected revision comparison">
              <section aria-labelledby="note-history-current-heading">
                <h3 id="note-history-current-heading">Current note</h3>
                <pre className="note-history-markdown">
                  {currentReady ? currentMarkdown : 'Loading current note…'}
                </pre>
              </section>
              <section aria-labelledby="note-history-revision-heading">
                <h3 id="note-history-revision-heading">Selected revision</h3>
                <pre className="note-history-markdown">
                  {previewReady ? preview : selectedId ? 'Loading revision…' : 'Select a revision to preview.'}
                </pre>
              </section>
            </div>
          </div>
        </div>
      )}
      {status ? <p className="health-subtitle" role="status">{status}</p> : null}
    </UnifiedPanelShell>
  )
}