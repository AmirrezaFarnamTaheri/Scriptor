import { useEffect, useRef, useState } from 'react'
import { FileText } from 'lucide-react'

const ROW_HEIGHT = 32

interface VirtualNoteListProps {
  paths: string[]
  activePath: string | null
  onOpenNote: (path: string) => void
  onRenameNote: (path: string) => void
  onDeleteNote?: (path: string) => void
}

export function VirtualNoteList({
  paths,
  activePath,
  onOpenNote,
  onRenameNote,
  onDeleteNote,
}: VirtualNoteListProps) {
  const containerRef = useRef<HTMLUListElement>(null)
  const [viewportHeight, setViewportHeight] = useState(320)
  const [scrollTop, setScrollTop] = useState(0)

  useEffect(() => {
    const element = containerRef.current
    if (!element) return
    const observer = new ResizeObserver(() => setViewportHeight(element.clientHeight))
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  const totalHeight = paths.length * ROW_HEIGHT
  const startIndex = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - 4)
  const visibleCount = Math.ceil(viewportHeight / ROW_HEIGHT) + 8
  const endIndex = Math.min(paths.length, startIndex + visibleCount)

  return (
    <ul
      ref={containerRef}
      className="virtual-note-list"
      onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
      style={{ maxHeight: 'min(60vh, 640px)', overflow: 'auto' }}
    >
      <div style={{ height: totalHeight, position: 'relative' }}>
        {paths.slice(startIndex, endIndex).map((path, offset) => {
          const index = startIndex + offset
          return (
            <li
              key={path}
              style={{
                position: 'absolute',
                top: index * ROW_HEIGHT,
                left: 0,
                right: 0,
                height: ROW_HEIGHT,
              }}
            >
              <button
                type="button"
                className={activePath === path ? 'note-row active' : 'note-row'}
                onClick={() => onOpenNote(path)}
                onContextMenu={(event) => {
                  event.preventDefault()
                  if (event.shiftKey && onDeleteNote) {
                    onDeleteNote(path)
                    return
                  }
                  onRenameNote(path)
                }}
              >
                <FileText />
                <span>{path.split('/').pop()}</span>
              </button>
            </li>
          )
        })}
      </div>
    </ul>
  )
}
