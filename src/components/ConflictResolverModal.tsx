import { useMemo, useRef, useState } from 'react'
import { AlertTriangle, X } from 'lucide-react'

import {
  applyConflictChoices,
  areConflictChoicesComplete,
  parseConflictHunks,
  type ConflictHunkChoice,
} from '../lib/conflictMerge'
import { useEscapeToClose } from '../hooks/useEscapeToClose'
import { useFocusTrap } from '../hooks/useFocusTrap'

function NumberedConflictBlock({
  title,
  text,
  startLine = 0,
  tone,
}: {
  title: string
  text: string
  /** 0-indexed line offset — add 1 for display. */
  startLine?: number
  tone?: 'ours' | 'theirs' | 'base'
}) {
  return (
    <article className={`conflict-hunk-column${tone ? ` is-${tone}` : ''}`}>
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
  /** Whole-file ancestor kept only as an optional reference; it is never mapped heuristically to hunks. */
  basePreview?: string | null
  onResolveMerged: (mergedMarkdown: string) => void
  onClose: () => void
  isBusy: boolean
}

export function ConflictResolverModal({
  path,
  source,
  basePreview,
  onResolveMerged,
  onClose,
  isBusy,
}: ConflictResolverModalProps) {
  const parsed = useMemo(() => parseConflictHunks(source), [source])
  const [choices, setChoices] = useState<Partial<Record<number, ConflictHunkChoice>>>({})
  const allResolved = areConflictChoicesComplete(parsed, choices)
  const unresolvedCount = parsed.hunks.filter((hunk) => !choices[hunk.id]).length

  const mergedPreview = useMemo(
    () => applyConflictChoices(source, choices),
    [choices, source],
  )

  const setHunkChoice = (id: number, choice: ConflictHunkChoice) => {
    setChoices((current) => ({ ...current, [id]: choice }))
  }

  const chooseAll = (choice: 'ours' | 'theirs') => {
    setChoices(Object.fromEntries(parsed.hunks.map((hunk) => [hunk.id, choice])))
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
        aria-label="Resolve merge conflicts"
        onClick={(event) => event.stopPropagation()}
      >
        <header>
          <div>
            <h2>Resolve merge conflicts</h2>
            <p>Choose a resolution for every conflict. Nothing is selected automatically.</p>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close">
            <X />
          </button>
        </header>
        <p>
          <strong>{path}</strong>
        </p>

        {parsed.hunks.length === 0 ? (
          <p className="empty-state">No complete conflict blocks were found. The file was left unchanged.</p>
        ) : (
          <div className="conflict-hunks">
            {parsed.hunks.map((hunk) => {
              const contentStart = hunk.startLine + 1
              const contentEnd = hunk.endLine - 1
              const availableChoices: ConflictHunkChoice[] = hunk.base === undefined
                ? ['ours', 'theirs']
                : ['base', 'ours', 'theirs']
              return (
                <section key={hunk.id} className={`conflict-hunk-card${choices[hunk.id] ? ' is-resolved' : ' is-unresolved'}`}>
                  <header className="conflict-hunk-header">
                    <div>
                      <h3>Conflict {hunk.id + 1}</h3>
                      <small>
                        Lines {contentStart}–{contentEnd}
                        {hunk.branchLabel ? ` · incoming ${hunk.branchLabel}` : ''}
                      </small>
                    </div>
                    <fieldset className="conflict-hunk-choices">
                      <legend>Resolution</legend>
                      {availableChoices.map((choice) => (
                        <label key={choice}>
                          <input
                            type="radio"
                            name={`hunk-${hunk.id}`}
                            checked={choices[hunk.id] === choice}
                            onChange={() => setHunkChoice(hunk.id, choice)}
                          />
                          {choice === 'base' ? 'Ancestor' : choice === 'ours' ? 'Keep ours' : 'Keep theirs'}
                        </label>
                      ))}
                    </fieldset>
                  </header>
                  <div className={`conflict-preview-grid${hunk.base !== undefined ? ' conflict-preview-grid-3' : ''}`}>
                    {hunk.base !== undefined ? (
                      <NumberedConflictBlock title="Ancestor" text={hunk.base} tone="base" />
                    ) : null}
                    <NumberedConflictBlock title="Ours" text={hunk.ours} startLine={hunk.startLine + 1} tone="ours" />
                    <NumberedConflictBlock title="Theirs" text={hunk.theirs} startLine={hunk.startLine + 1} tone="theirs" />
                  </div>
                </section>
              )
            })}
          </div>
        )}

        {basePreview && parsed.hunks.every((hunk) => hunk.base === undefined) ? (
          <details className="conflict-ancestor-reference">
            <summary>View whole-file common ancestor</summary>
            <p className="health-subtitle">
              Reference only. It is not mapped to individual conflicts unless exact diff3 ancestor markers are present.
            </p>
            <pre className="numbered-conflict-pre conflict-ancestor-body">{basePreview}</pre>
          </details>
        ) : null}

        <section className="conflict-merged-preview">
          <div className="conflict-merged-preview-heading">
            <h3>Merged preview</h3>
            {unresolvedCount > 0 ? (
              <span className="conflict-unresolved-status" role="status">
                <AlertTriangle size={14} />
                {unresolvedCount} unresolved
              </span>
            ) : (
              <span className="conflict-resolved-status" role="status">All conflicts resolved</span>
            )}
          </div>
          <pre className="numbered-conflict-pre conflict-merged-body">{mergedPreview}</pre>
        </section>

        <footer className="conflict-resolver-actions">
          <div className="conflict-bulk-actions" role="group" aria-label="Bulk resolution choices">
            <button type="button" className="toolbar-button" disabled={isBusy || parsed.hunks.length === 0} onClick={() => chooseAll('ours')}>
              Choose ours for all
            </button>
            <button type="button" className="toolbar-button" disabled={isBusy || parsed.hunks.length === 0} onClick={() => chooseAll('theirs')}>
              Choose theirs for all
            </button>
          </div>
          <button
            type="button"
            className="primary-button conflict-apply-button"
            disabled={isBusy || !allResolved}
            onClick={() => onResolveMerged(mergedPreview)}
          >
            Apply resolved file
          </button>
        </footer>
      </section>
    </div>
  )
}
