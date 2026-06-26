import { useCallback, useEffect, useState } from 'react'
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

export function NoteHistoryPanel({ path, onClose, onRestored }: NoteHistoryPanelProps) {
  const [revisions, setRevisions] = useState<NoteHistoryRevision[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [preview, setPreview] = useState('')
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState(false)

  const refresh = useCallback(async () => {
    if (!path) {
      setRevisions([])
      return
    }
    setStatus('')
    try {
      const rows = await vaultListNoteHistory(path)
      setRevisions(rows)
      setSelectedId(rows[0]?.id ?? null)
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not load note history')
    }
  }, [path])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    if (!path || !selectedId) {
      setPreview('')
      return
    }
    void vaultReadNoteHistoryRevision(path, selectedId)
      .then(setPreview)
      .catch(() => setPreview(''))
  }, [path, selectedId])

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
