import { useEffect, useRef, useState } from 'react'

import type { KnowledgeNoteSummary } from '../../types/vault'

const ROW_HEIGHT = 44

interface VirtualKnowledgeNoteListProps {
  notes: KnowledgeNoteSummary[]
  onOpenNote: (path: string) => void
  triageLabel?: string
  onTriageNext?: (path: string) => void
}

export function VirtualKnowledgeNoteList({
  notes,
  onOpenNote,
  triageLabel,
  onTriageNext,
}: VirtualKnowledgeNoteListProps) {
  const containerRef = useRef<HTMLUListElement>(null)
  const [viewportHeight, setViewportHeight] = useState(360)
  const [scrollTop, setScrollTop] = useState(0)

  useEffect(() => {
    const element = containerRef.current
    if (!element) return
    const observer = new ResizeObserver(() => setViewportHeight(element.clientHeight))
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  const totalHeight = notes.length * ROW_HEIGHT
  const startIndex = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - 4)
  const visibleCount = Math.ceil(viewportHeight / ROW_HEIGHT) + 8
  const endIndex = Math.min(notes.length, startIndex + visibleCount)

  return (
    <ul
      ref={containerRef}
      className="virtual-note-list knowledge-note-list virtual-knowledge-list"
      onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
      style={{ maxHeight: 'min(52vh, 560px)', overflow: 'auto' }}
    >
      <div style={{ height: totalHeight, position: 'relative' }}>
        {notes.slice(startIndex, endIndex).map((note, offset) => {
          const index = startIndex + offset
          return (
            <li
              key={note.path}
              style={{
                position: 'absolute',
                top: index * ROW_HEIGHT,
                left: 0,
                right: 0,
                height: ROW_HEIGHT,
              }}
            >
              <button type="button" onClick={() => onOpenNote(note.path)}>
                <span>{note.title}</span>
                <small>{note.path}</small>
              </button>
              <span className="knowledge-note-meta">
                in {note.inbound_links} · out {note.outbound_links}
              </span>
              {onTriageNext ? (
                <button type="button" className="knowledge-triage-next" onClick={() => onTriageNext(note.path)}>
                  {triageLabel ?? 'Triage'}
                </button>
              ) : null}
            </li>
          )
        })}
      </div>
    </ul>
  )
}
