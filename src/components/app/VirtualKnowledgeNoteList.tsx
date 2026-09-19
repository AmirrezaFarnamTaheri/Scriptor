import { useEffect, useRef, useState, memo } from 'react'

import type { KnowledgeNoteSummary } from '../../types/vault'

const BASE_ROW_HEIGHT = 72
const ROW_HEIGHT_REM = 4.5

function readRowHeight(): number {
  if (typeof document === 'undefined') return BASE_ROW_HEIGHT
  const rootFontSize = Number.parseFloat(getComputedStyle(document.documentElement).fontSize)
  if (!Number.isFinite(rootFontSize) || rootFontSize <= 0) return BASE_ROW_HEIGHT
  return Math.max(BASE_ROW_HEIGHT, Math.ceil(rootFontSize * ROW_HEIGHT_REM))
}

interface VirtualKnowledgeNoteListProps {
  notes: KnowledgeNoteSummary[]
  onOpenNote: (path: string) => void
  triageLabel?: string
  triageActionPath?: string
  onTriageNext?: (path: string) => void
}

function VirtualKnowledgeNoteListImpl({
  notes,
  onOpenNote,
  triageLabel,
  triageActionPath,
  onTriageNext,
}: VirtualKnowledgeNoteListProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [viewportHeight, setViewportHeight] = useState(360)
  const [scrollTop, setScrollTop] = useState(0)
  const [rowHeight, setRowHeight] = useState(readRowHeight)

  useEffect(() => {
    const element = containerRef.current
    if (!element) return
    const syncGeometry = () => {
      setViewportHeight(element.clientHeight)
      setRowHeight((current) => {
        const next = readRowHeight()
        return next === current ? current : next
      })
    }
    const observer = new ResizeObserver(syncGeometry)
    const rootObserver = new MutationObserver(syncGeometry)
    observer.observe(element)
    rootObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class', 'style'],
    })
    window.addEventListener('resize', syncGeometry)
    return () => {
      observer.disconnect()
      rootObserver.disconnect()
      window.removeEventListener('resize', syncGeometry)
    }
  }, [])

  const totalHeight = notes.length * rowHeight
  const startIndex = Math.max(0, Math.floor(scrollTop / rowHeight) - 4)
  const visibleCount = Math.ceil(viewportHeight / rowHeight) + 8
  const endIndex = Math.min(notes.length, startIndex + visibleCount)

  return (
    <div
      ref={containerRef}
      onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
      style={{ maxHeight: 'min(52vh, 560px)', overflow: 'auto' }}
    >
      <ul
        className="virtual-note-list knowledge-note-list virtual-knowledge-list"
        style={{ height: totalHeight, position: 'relative' }}
      >
        {notes.slice(startIndex, endIndex).map((note, offset) => {
          const index = startIndex + offset
          return (
            <li
              key={note.path}
              style={{
                position: 'absolute',
                top: index * rowHeight,
                left: 0,
                right: 0,
                height: rowHeight,
              }}
            >
              <button type="button" className="knowledge-note-open" onClick={() => onOpenNote(note.path)}>
                <span>{note.title}</span>
                <small>{note.path}</small>
              </button>
              <span className="knowledge-note-meta">
                in {note.inbound_links} · out {note.outbound_links}
              </span>
              {onTriageNext && triageActionPath === note.path ? (
                <button type="button" className="knowledge-triage-next" onClick={() => onTriageNext(note.path)}>
                  {triageLabel ?? 'Triage'}
                </button>
              ) : null}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

/**
 * Memoized: this subtree re-renders on every App-level render (including every
 * keystroke in the editor draft) even though its own props rarely change.
 */
export const VirtualKnowledgeNoteList = memo(VirtualKnowledgeNoteListImpl)
