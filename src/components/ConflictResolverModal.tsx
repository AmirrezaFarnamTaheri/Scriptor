import { useMemo, useRef, useState } from 'react'
import { X } from 'lucide-react'

import {
  applyConflictChoices,
  estimateBaseHunkStart,
  extractBaseHunk,
  parseConflictHunks,
  type ConflictHunkChoice,
} from '../lib/conflictMerge'
import { useEscapeToClose } from '../hooks/useEscapeToClose'
import { useFocusTrap } from '../hooks/useFocusTrap'

function NumberedConflictBlock({
  title,
  text,
  startLine = 0,
}: {
  title: string
  text: string
  /** 0-indexed line offset — add 1 for display. */
  startLine?: number
}) {
  return (
    <article className="conflict-hunk-column">
      <h3>{title}</h3>
      <pre className="numbered-conflict-pre">
        {text.split('\n').map((line, index) => (
          <div key={`${title}-${index}`} className="numbered-conflict-line">
            <span className="line-num" aria-hidden>
              {startLine + index + 1}
            </span>
            <code>{line || ' '}</code>
          </div>
        ))}
      </pre>
    </article>
  )
}

interface ConflictResolverModalProps {
  path: string
  source: string
  basePreview?: string | null
  onResolveMerged: (mergedMarkdown: string) => void
  onResolveQuick: (strategy: 'ours' | 'theirs') => void
  onClose: () => void
  isBusy: boolean
}

export function ConflictResolverModal({
  path,
  source,
  basePreview,
  onResolveMerged,
  onResolveQuick,
  onClose,
  isBusy,
}: ConflictResolverModalProps) {
  const parsed = useMemo(() => parseConflictHunks(source), [source])
  const [choices, setChoices] = useState<Record<number, ConflictHunkChoice>>(() =>
    Object.fromEntries(parsed.hunks.map((hunk) => [hunk.id, 'ours' as const])),
  )

  const mergedPreview = useMemo(
    () => applyConflictChoices(source, choices, basePreview),
    [basePreview, choices, source],
  )

  const setHunkChoice = (id: number, choice: ConflictHunkChoice) => {
    setChoices((current) => ({ ...current, [id]: choice }))
  }

  const dialogRef = useRef<HTMLElement>(null)
  useEscapeToClose(true, onClose)
  useFocusTrap(dialogRef, { active: true })

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <section
        ref={dialogRef}
        className="conflict-resolver conflict-resolver-3way"
        role="dialog"
        aria-modal="true"
        aria-label="Resolve merge conflict"
        onClick={(event) => event.stopPropagation()}
      >
        <header>
          <h2>3-way merge</h2>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close">
            <X />
          </button>
        </header>
        <p>
          <strong>{path}</strong> — pick a side per conflict hunk, or use quick resolve for the whole file.
        </p>

        {parsed.hunks.length === 0 ? (
          <p className="empty-state">No conflict markers found in this file.</p>
        ) : (
          <div className="conflict-hunks">
            {parsed.hunks.map((hunk) => {
              const contentStart = hunk.startLine + 1
              const contentEnd = hunk.endLine - 1
              const hunkBase = basePreview
                ? extractBaseHunk(
                    basePreview,
                    estimateBaseHunkStart(parsed.hunks, hunk.id),
                    Math.max(hunk.ours.split('\n').length, hunk.theirs.split('\n').length),
                  )
                : null
              return (
                <section key={hunk.id} className="conflict-hunk-card">
                  <header className="conflict-hunk-header">
                    <h3>
                      Hunk {hunk.id + 1}
                      <small>
                        lines {contentStart}–{contentEnd}
                        {hunk.branchLabel ? ` — ${hunk.branchLabel}` : ''}
                      </small>
                    </h3>
                    <fieldset className="conflict-hunk-choices">
                      <legend className="sr-only">Resolution for hunk {hunk.id + 1}</legend>
                      {(['base', 'ours', 'theirs'] as const).map((choice) => (
                        <label key={choice}>
                          <input
                            type="radio"
                            name={`hunk-${hunk.id}`}
                            checked={(choices[hunk.id] ?? 'ours') === choice}
                            disabled={choice === 'base' && !basePreview}
                            onChange={() => setHunkChoice(hunk.id, choice)}
                          />
                          {choice === 'base' ? 'Base (ancestor)' : choice === 'ours' ? 'Ours' : 'Theirs'}
                        </label>
                      ))}
                    </fieldset>
                  </header>
                  <div className={`conflict-preview-grid${basePreview ? ' conflict-preview-grid-3' : ''}`}>
                    {hunkBase != null ? (
                      <NumberedConflictBlock title="Base (ancestor)" text={hunkBase} />
                    ) : null}
                    <NumberedConflictBlock title="Ours" text={hunk.ours} startLine={hunk.startLine + 1} />
                    <NumberedConflictBlock title="Theirs" text={hunk.theirs} startLine={hunk.startLine + 1} />
                  </div>
                </section>
              )
            })}
          </div>
        )}

        <section className="conflict-merged-preview">
          <h3>Merged preview</h3>
          <pre className="numbered-conflict-pre conflict-merged-body">{mergedPreview}</pre>
        </section>

        <footer className="conflict-resolver-actions">
          <button type="button" className="toolbar-button" disabled={isBusy} onClick={() => onResolveQuick('ours')}>
            Keep all ours
          </button>
          <button type="button" className="toolbar-button" disabled={isBusy} onClick={() => onResolveQuick('theirs')}>
            Keep all theirs
          </button>
          <button
            type="button"
            className="primary-button"
            disabled={isBusy || parsed.hunks.length === 0}
            onClick={() => onResolveMerged(mergedPreview)}
          >
            Apply merged result
          </button>
        </footer>
      </section>
    </div>
  )
}
