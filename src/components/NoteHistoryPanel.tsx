import { useEffect, useState } from 'react'
import { Clock, RotateCcw } from 'lucide-react'

import {
  vaultListNoteHistory,
  vaultReadNoteHistoryRevision,
  vaultRestoreNoteHistoryRevision,
} from '../bridge/commands'
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

export function NoteHistoryPanel({ path, onClose, onRestored }: NoteHistoryPanelProps) {
  const [revisionState, setRevisionState] = useState<RevisionState | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [previewState, setPreviewState] = useState<PreviewState | null>(null)
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!path) return
    let cancelled = false
    const requestedPath = path
    void vaultListNoteHistory(requestedPath)
      .then((rows) => {
        if (cancelled) return
        setRevisionState({ path: requestedPath, rows })
        setSelectedId(rows[0]?.id ?? null)
        setStatus('')
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setRevisionState({ path: requestedPath, rows: [] })
          setStatus(error instanceof Error ? error.message : 'Could not load note history')
        }
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
    void vaultReadNoteHistoryRevision(requestedPath, requestedRevision)
      .then((markdown) => {
        if (!cancelled) {
          setPreviewState({ path: requestedPath, revisionId: requestedRevision, markdown })
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPreviewState({ path: requestedPath, revisionId: requestedRevision, markdown: '' })
        }
      })
    return () => {
      cancelled = true
    }
  }, [path, selectedId])

  const revisions = revisionState?.path === path ? revisionState.rows : []
  const preview =
    previewState?.path === path && previewState.revisionId === selectedId
      ? previewState.markdown
      : ''

  const restore = async () => {
    if (!path || !selectedId) return
    setBusy(true)
    setStatus('Restoring revision…')
    try {
      await vaultRestoreNoteHistoryRevision(path, selectedId)
      setStatus('Revision restored.')
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
          <ul className="note-history-timeline">
            {revisions.map((revision) => (
              <li key={revision.id}>
                <button
                  type="button"
                  className={selectedId === revision.id ? 'active' : ''}
                  onClick={() => setSelectedId(revision.id)}
                >
                  <strong>{new Date(revision.saved_at).toLocaleString()}</strong>
                  <span>{revision.word_count.toLocaleString()} words</span>
                  <span className="note-history-preview">{revision.preview || revision.content_hash.slice(0, 8)}</span>
                </button>
              </li>
            ))}
          </ul>
          <div className="note-history-preview-pane">
            <header className="note-history-preview-header">
              <button type="button" className="primary-button" disabled={busy || !selectedId} onClick={() => void restore()}>
                <RotateCcw size={14} />
                Restore revision
              </button>
            </header>
            <pre className="note-history-markdown">{preview || 'Select a revision to preview.'}</pre>
          </div>
        </div>
      )}
      {status ? <p className="health-subtitle">{status}</p> : null}
    </UnifiedPanelShell>
  )
}
