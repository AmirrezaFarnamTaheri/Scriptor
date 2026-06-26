import { useCallback, useEffect, useRef, useState } from 'react'
import { FileText } from 'lucide-react'

const DEFAULT_ROW_HEIGHT = 32

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
  const rowRefs = useRef<Map<number, HTMLLIElement>>(new Map())
  const [viewportHeight, setViewportHeight] = useState(320)
  const [scrollTop, setScrollTop] = useState(0)
  const [rowHeights, setRowHeights] = useState<Record<number, number>>({})

  useEffect(() => {
    const element = containerRef.current
    if (!element) return
    const observer = new ResizeObserver(() => setViewportHeight(element.clientHeight))
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const observers: ResizeObserver[] = []
    for (const [index, element] of rowRefs.current.entries()) {
      const observer = new ResizeObserver((entries) => {
        const height = Math.max(DEFAULT_ROW_HEIGHT, Math.ceil(entries[0]?.contentRect.height ?? DEFAULT_ROW_HEIGHT))
        setRowHeights((current) => (current[index] === height ? current : { ...current, [index]: height }))
      })
      observer.observe(element)
      observers.push(observer)
    }
    return () => observers.forEach((observer) => observer.disconnect())
  }, [paths.length, scrollTop])

  const offsets = useCallback(() => {
    let offset = 0
    const list: number[] = []
    for (let index = 0; index < paths.length; index += 1) {
      list.push(offset)
      offset += rowHeights[index] ?? DEFAULT_ROW_HEIGHT
    }
    return { offsets: list, totalHeight: offset }
  }, [paths.length, rowHeights])

  const { offsets: rowOffsets, totalHeight } = offsets()

  let startIndex = 0
  while (startIndex < paths.length && rowOffsets[startIndex] + (rowHeights[startIndex] ?? DEFAULT_ROW_HEIGHT) < scrollTop) {
    startIndex += 1
  }
  startIndex = Math.max(0, startIndex - 4)

  let endIndex = startIndex
  let visible = 0
  while (endIndex < paths.length && visible < viewportHeight + DEFAULT_ROW_HEIGHT * 8) {
    visible += rowHeights[endIndex] ?? DEFAULT_ROW_HEIGHT
    endIndex += 1
  }

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
              ref={(element) => {
                if (element) rowRefs.current.set(index, element)
                else rowRefs.current.delete(index)
              }}
              style={{
                position: 'absolute',
                top: rowOffsets[index],
                left: 0,
                right: 0,
                minHeight: DEFAULT_ROW_HEIGHT,
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
