import { useEffect, useRef, useState, type ReactNode } from 'react'
import { diagramPan, diagramZoom } from '../lib/diagramViewport'

export function DiagramViewport({ children }: { children: ReactNode }) {
  const viewport = useRef<HTMLDivElement>(null)
  const content = useRef<HTMLDivElement>(null)
  const drag = useRef<{ id: number; x: number; y: number; left: number; top: number } | null>(null)
  const [zoom, setZoom] = useState(1)
  const [dragging, setDragging] = useState(false)
  const [height, setHeight] = useState(180)
  useEffect(() => {
    if (!content.current) return
    const observer = new ResizeObserver(entries => {
      if (entries[0]) setHeight(Math.max(1, entries[0].contentRect.height))
    })
    observer.observe(content.current)
    return () => observer.disconnect()
  }, [])
  const stop = () => { drag.current = null; setDragging(false) }
  return <>
    <div className="research-controls">
      <button type="button" aria-label="Zoom out" disabled={zoom <= 0.5} onClick={() => setZoom(value => diagramZoom(value, -0.25))}>−</button>
      <button type="button" onClick={() => { setZoom(1); viewport.current?.scrollTo({ left: 0, top: 0 }) }}>{Math.round(zoom * 100)}% · Reset</button>
      <button type="button" aria-label="Zoom in" disabled={zoom >= 3} onClick={() => setZoom(value => diagramZoom(value, 0.25))}>+</button>
    </div>
    <p>Drag to pan, use touch scrolling, or focus the diagram and use arrow keys. Shift moves farther.</p>
    <div ref={viewport} className={`research-preview-scroll diagram-viewport${dragging ? ' is-dragging' : ''}`} role="region" aria-label="Diagram viewport" tabIndex={0}
      onKeyDown={event => {
        if (event.target !== event.currentTarget || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return
        event.preventDefault()
        const distance = event.shiftKey ? 160 : 40
        event.currentTarget.scrollBy({ left: event.key === 'ArrowLeft' ? -distance : event.key === 'ArrowRight' ? distance : 0, top: event.key === 'ArrowUp' ? -distance : event.key === 'ArrowDown' ? distance : 0 })
      }}
      onPointerDown={event => {
        if (event.button !== 0 || event.pointerType === 'touch' || (event.target as Element).closest('a,button,input,textarea,select')) return
        const node = event.currentTarget
        drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY, left: node.scrollLeft, top: node.scrollTop }
        node.setPointerCapture(event.pointerId)
        setDragging(true)
      }}
      onPointerMove={event => {
        const start = drag.current
        if (!start || start.id !== event.pointerId) return
        const node = event.currentTarget
        const position = diagramPan(start, { x: event.clientX - start.x, y: event.clientY - start.y }, { width: node.scrollWidth - node.clientWidth, height: node.scrollHeight - node.clientHeight })
        node.scrollTo(position.left, position.top)
      }}
      onPointerUp={stop} onPointerCancel={stop} onLostPointerCapture={stop}>
      <div style={{ width: `${zoom * 100}%`, height: height * zoom }}>
        <div ref={content} style={{ width: `${100 / zoom}%`, transform: `scale(${zoom})`, transformOrigin: 'top left' }}>{children}</div>
      </div>
    </div>
  </>
}
