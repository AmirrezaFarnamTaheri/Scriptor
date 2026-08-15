/**
 * AnnotationPopover — overlay shown when the user has an active selection.
 *
 * Decomposed from ReaderPanel (D2 — separation of concerns). Receives the
 * pending selection and fires callbacks — no store writes happen inside this
 * component so it remains purely presentational.
 *
 * Keyboard:
 *  - `h` → highlight (default yellow)
 *  - `c` → highlight + open comment input
 *  - `Escape` → dismiss
 */

import { useEffect, useId, useRef, useState } from 'react'
import { MessageSquare, Highlighter, X } from 'lucide-react'

import { useEscapeToClose } from '../../hooks/useEscapeToClose'
import { useFocusTrap } from '../../hooks/useFocusTrap'
import type { ReaderAnnotation, ReaderSelection } from './useReaderStore'

interface AnnotationPopoverProps {
  selection: ReaderSelection
  onAnnotate: (partial: Omit<ReaderAnnotation, 'id' | 'createdAt'>) => void
  onDismiss: () => void
}

const COLORS = [
  { label: 'Yellow', value: '#FFE066' },
  { label: 'Green', value: '#A8F0C6' },
  { label: 'Blue', value: '#93C5FD' },
  { label: 'Pink', value: '#F9A8D4' },
]

export function AnnotationPopover({ selection, onAnnotate, onDismiss }: AnnotationPopoverProps) {
  const [color, setColor] = useState(COLORS[0]!.value)
  const [showComment, setShowComment] = useState(false)
  const [comment, setComment] = useState('')
  const dialogRef = useRef<HTMLDivElement>(null)
  const titleId = useId()
  const descriptionId = useId()
  const commentId = useId()
  const commentRef = useRef<HTMLTextAreaElement>(null)

  useEscapeToClose(true, onDismiss)
  useFocusTrap(dialogRef, { active: true })

  useEffect(() => {
    if (!showComment) return
    const frameId = window.requestAnimationFrame(() => commentRef.current?.focus())
    return () => window.cancelAnimationFrame(frameId)
  }, [showComment])

  const handleHighlight = () => {
    onAnnotate({ anchor: selection.anchor, quote: selection.quote, body: comment, color })
  }

  const handleCommentOpen = () => {
    setShowComment(true)
  }

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      className="annotation-popover"
      onKeyDown={(e) => {
        if (e.key === 'Escape') onDismiss()
        if (!showComment && e.key === 'h') handleHighlight()
        if (!showComment && e.key === 'c') handleCommentOpen()
      }}
    >
      <div className="annotation-popover__header">
        <div className="annotation-popover__copy">
          <h3 id={titleId} className="annotation-popover__title">Annotate selection</h3>
          <p id={descriptionId} className="annotation-popover__description">
            Choose a highlight color or save a short note for the current selection.
          </p>
        </div>
        <button
          type="button"
          className="annotation-popover__btn annotation-popover__btn--dismiss"
          aria-label="Dismiss annotation dialog"
          onClick={onDismiss}
        >
          <X size={14} />
        </button>
      </div>

      <div className="annotation-popover__colors">
        {COLORS.map((c) => (
          <button
            key={c.value}
            type="button"
            className={`annotation-popover__swatch${color === c.value ? ' annotation-popover__swatch--active' : ''}`}
            style={{ background: c.value }}
            aria-label={`Highlight ${selection.quote} in ${c.label}`}
            onClick={() => setColor(c.value)}
          />
        ))}
      </div>

      <div className="annotation-popover__actions">
        <button
          type="button"
          className="annotation-popover__btn"
          aria-label="Highlight (h)"
          onClick={handleHighlight}
        >
          <Highlighter size={14} />
          <span>Highlight</span>
        </button>
        <button
          type="button"
          className="annotation-popover__btn"
          aria-label="Comment (c)"
          onClick={handleCommentOpen}
        >
          <MessageSquare size={14} />
          <span>Comment</span>
        </button>
      </div>

      {showComment && (
        <div className="annotation-popover__comment">
          <label htmlFor={commentId} className="sr-only">
            Add comment
          </label>
          <textarea
            id={commentId}
            ref={commentRef}
            className="annotation-popover__textarea"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Add a comment…"
            rows={3}
          />
          <button type="button" className="annotation-popover__save" onClick={handleHighlight}>
            Save annotation
          </button>
        </div>
      )}
    </div>
  )
}
