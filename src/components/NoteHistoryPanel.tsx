import { memo, useEffect, useMemo, useState } from 'react'
import { Clock, RotateCcw } from 'lucide-react'

import {
  vaultListNoteHistory,
  vaultReadNote,
  vaultReadNoteHistoryRevision,
  vaultRestoreNoteHistoryRevision,
} from '../bridge/commands'
import { MutationConfirmation } from './chrome/MutationConfirmation'
import { diffLines } from '../lib/lineDiff'
import { UnifiedPanelShell } from './chrome/UnifiedPanelShell'
import { revisionHeatmap, vocabularyMetrics } from '../lib/researchStudio'
import { VocabularyEvolution } from './history/VocabularyEvolution'
import '../styles/components/research-studio.css'

export interface NoteHistoryRevision {
  id: string
  saved_at: string
  content_hash: string
  word_count: number
  preview: string
}

interface NoteHistoryPanelProps {
  path: string | null
  vaultId?: string | null
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

interface PreviewErrorState {
  path: string
  revisionId: string
  message: string
}

interface CurrentErrorState {
  path: string
  message: string
}

/** Formats persisted revision timestamps for compact, locale-aware timeline display. */
function formatRevisionDate(value: string) {
  return new Date(value).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

/** Browses local note revisions and requires an explicit current-vs-revision comparison before restore. */
export const NoteHistoryPanel = memo(function NoteHistoryPanel({ path, vaultId=null, onClose, onRestored }: NoteHistoryPanelProps) {
  const [revisionState, setRevisionState] = useState<RevisionState | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [previewState, setPreviewState] = useState<PreviewState | null>(null)
  const [currentState, setCurrentState] = useState<CurrentNoteState | null>(null)
  const [status, setStatus] = useState('')
  const [previewError, setPreviewError] = useState<PreviewErrorState | null>(null)
  const [currentError, setCurrentError] = useState<CurrentErrorState | null>(null)
  const [busy, setBusy] = useState(false)
  const [confirmRestore, setConfirmRestore] = useState(false)
  // The raw panes stay available; the diff is an additional reading aid.
  const [showDiff, setShowDiff] = useState(true)

  useEffect(() => {
    if (!path) return
    let cancelled = false
    const requestedPath = path
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
        setCurrentError(null)
      } else {
        setCurrentState(null)
        setCurrentError({
          path: requestedPath,
          message: currentResult.reason instanceof Error ? currentResult.reason.message : 'Could not read the current note',
        })
      }
      setConfirmRestore(false)
    })
    return () => {
      cancelled = true
    }
  }, [path])

  const loadedHistoryPath = revisionState?.path ?? null

  useEffect(() => {
    if (!path || !selectedId || loadedHistoryPath !== path) return
    let cancelled = false
    const requestedPath = path
    const requestedRevision = selectedId
    void vaultReadNoteHistoryRevision(requestedPath, requestedRevision)
      .then((markdown) => {
        if (!cancelled) {
          setPreviewState({ path: requestedPath, revisionId: requestedRevision, markdown })
          setPreviewError(null)
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setPreviewState(null)
          setPreviewError({
            path: requestedPath,
            revisionId: requestedRevision,
            message: error instanceof Error ? error.message : 'Could not load this revision',
          })
        }
      })
    return () => {
      cancelled = true
    }
  }, [loadedHistoryPath, path, selectedId])

  const revisions = useMemo(() => loadedHistoryPath === path ? revisionState?.rows ?? [] : [], [loadedHistoryPath, path, revisionState])
  const activity = useMemo(() => revisionHeatmap(revisions), [revisions])
  const selectedRevision = revisions.find((revision) => revision.id === selectedId) ?? null
  const previewReady = previewState?.path === path && previewState.revisionId === selectedId
  const currentReady = currentState?.path === path
  const preview = previewReady ? previewState.markdown : ''
  const currentMarkdown = currentReady ? currentState.markdown : ''
  const vocabulary = useMemo(() => {
    if (!previewReady || !currentReady || preview.length > 3 * 1024 * 1024 || currentMarkdown.length > 3 * 1024 * 1024) return null
    return { current: vocabularyMetrics(currentMarkdown), revision: vocabularyMetrics(preview) }
  }, [previewReady, currentReady, preview, currentMarkdown])
  const previewErrorMessage =
    previewError?.path === path && previewError.revisionId === selectedId ? previewError.message : null
  const currentErrorMessage = currentError?.path === path ? currentError.message : null
  const canRestore = Boolean(
    selectedId && previewReady && currentReady && !previewErrorMessage && !currentErrorMessage,
  )

  // The diff needs both sides in hand. It is derived from the two texts already
  // loaded here, so no extra revision metadata is requested or invented.
  const diffReady = previewReady && currentReady
  const diff = useMemo(
    () => (diffReady ? diffLines(currentMarkdown, preview) : { lines: [], added: 0, removed: 0, truncated: false }),
    [diffReady, currentMarkdown, preview],
  )

  const restore = async () => {
    if (!path || !selectedId || !canRestore) return
    setBusy(true)
    setStatus('Restoring revision…')
    try {
      const latest = await vaultReadNote(path)
      if (latest.markdown !== currentMarkdown) {
        setCurrentState({ path, markdown: latest.markdown })
        setConfirmRestore(false)
        throw new Error('The current note changed. Compare the updated content before restoring.')
      }
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
      helpTopic="history"
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
          <section aria-label="Revision activity" className="note-history-activity">
            <label>Scrub saved revisions
              <input type="range" min={0} max={Math.max(0, revisions.length - 1)} value={Math.max(0, revisions.findIndex((row) => row.id === selectedId))} disabled={busy || revisions.length < 2} onChange={(event) => { setSelectedId(revisions[Number(event.target.value)]?.id ?? null); setConfirmRestore(false) }} aria-valuetext={selectedRevision ? formatRevisionDate(selectedRevision.saved_at) : 'No revision selected'} />
            </label>
            <p>Retained saves per UTC day, through {activity.at(-1)?.date}. Empty cells mean no retained revision; they do not prove no editing occurred.</p>
            <div className="revision-heatmap-scroll"><ul className="revision-heatmap" aria-label="Saved revisions per UTC day">{activity.map((day) => <li key={day.date} data-level={day.count === 0 ? 'none' : day.count >= 5 ? 'high' : 'low'} title={`${day.date}: ${day.count} retained saves`}><span className="sr-only">{day.date}: {day.count} retained saves</span></li>)}</ul></div>
            <p className="revision-heatmap-legend">Monday to Sunday in each column. Color intensity increases with the number of retained saves.</p>
          </section>
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
              {/* The two raw panes are always rendered below; this only adds or
                  removes the line-by-line view, so the raw Markdown stays available
                  either way. */}
              <button
                type="button"
                className="toolbar-button"
                aria-pressed={showDiff}
                disabled={!diffReady}
                onClick={() => setShowDiff((value) => !value)}
                title={
                  showDiff
                    ? 'Hide the line-by-line changes'
                    : 'Show what changed between this revision and the current note'
                }
              >
                {showDiff ? 'Hide changes' : 'Show changes'}
              </button>
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
            {previewErrorMessage ? (
              <p className="settings-status warn" role="alert">
                Revision preview unavailable: {previewErrorMessage}. Restore is disabled until the revision can be read.
              </p>
            ) : null}
            {currentErrorMessage ? (
              <p className="settings-status warn" role="alert">
                Current note preview unavailable: {currentErrorMessage}. Restore is disabled until the current note can be compared.
              </p>
            ) : null}
            <div className="note-history-compare" aria-label="Current note and selected revision comparison">
              {showDiff && diffReady ? (
                <section className="note-history-diff-section" aria-labelledby="note-history-diff-heading">
                  <h3 id="note-history-diff-heading">Changes</h3>
                  {/* The counts are the accessible summary. The per-line marks
                      below are decoration, so the list is hidden from assistive
                      technology to avoid reading the note out twice. */}
                  <p className="note-history-diff-summary">
                    <span className="note-history-diff-added">+{diff.added}</span>
                    <span className="note-history-diff-removed">−{diff.removed}</span>
                    <span>
                      {diff.added === 0 && diff.removed === 0
                        ? 'No line differences'
                        : `${diff.added} added, ${diff.removed} removed`}
                    </span>
                  </p>
                  {diff.truncated ? (
                    <p className="settings-status warn" role="status">
                      This note is too large to show a line-by-line comparison. Use the
                      two panes below to read both versions.
                    </p>
                  ) : (
                    <ol className="note-history-diff" aria-hidden="true">
                      {diff.lines.map((line, index) => (
                        <li key={`${line.kind}-${index}`} className={`note-history-diff-line is-${line.kind}`}>
                          <span className="note-history-diff-marker" aria-hidden="true">
                            {line.kind === 'add' ? '+' : line.kind === 'remove' ? '−' : ' '}
                          </span>
                          <span className="note-history-diff-text">{line.text || ' '}</span>
                        </li>
                      ))}
                    </ol>
                  )}
                </section>
              ) : null}
              <section aria-labelledby="note-history-current-heading">
                <h3 id="note-history-current-heading">Current note</h3>
                <pre className="note-history-markdown note-history-current-markdown">
                  {currentReady ? currentMarkdown : 'Loading current note…'}
                </pre>
              </section>
              <section aria-labelledby="note-history-revision-heading">
                <h3 id="note-history-revision-heading">Selected revision</h3>
                <pre className="note-history-markdown note-history-revision-markdown">
                  {previewReady ? preview : selectedId ? 'Loading revision…' : 'Select a revision to preview.'}
                </pre>
              </section>
            </div>
          </div>
          <section className="note-history-vocabulary" aria-label="Vocabulary analysis">
            <VocabularyEvolution key={`${vaultId}:${path}`} path={path} vaultId={vaultId} revisions={revisions}/>
            {vocabulary && <details><summary>Vocabulary comparison</summary><p>Measured from the Markdown source, including code and metadata. Distinct word ratio measures repetition; it is not a readability or quality score.</p><table><thead><tr><th>Measure</th><th>Current note</th><th>Selected revision</th></tr></thead><tbody><tr><th>Words</th><td>{vocabulary.current.words}</td><td>{vocabulary.revision.words}</td></tr><tr><th>Distinct words</th><td>{vocabulary.current.uniqueWords}</td><td>{vocabulary.revision.uniqueWords}</td></tr><tr><th>Distinct word ratio</th><td>{vocabulary.current.diversity === null ? 'No words' : `${(vocabulary.current.diversity * 100).toFixed(1)}%`}</td><td>{vocabulary.revision.diversity === null ? 'No words' : `${(vocabulary.revision.diversity * 100).toFixed(1)}%`}</td></tr></tbody></table></details>}
          </section>
        </div>
      )}
      {status ? <p className="health-subtitle" role="status">{status}</p> : null}
    </UnifiedPanelShell>
  )
})
