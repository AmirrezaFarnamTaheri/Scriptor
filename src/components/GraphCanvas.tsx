import { useCallback, useEffect, useMemo, useRef } from 'react'

const FOLDER_COLORS = ['#6366f1', '#0ea5e9', '#14b8a6', '#f59e0b', '#ef4444', '#a855f7', '#22c55e']

function folderColor(path: string): string {
  const folder = path.includes('/') ? path.split('/')[0] : '(root)'
  let hash = 0
  for (let i = 0; i < folder.length; i += 1) {
    hash = (hash * 31 + folder.charCodeAt(i)) >>> 0
  }
  return FOLDER_COLORS[hash % FOLDER_COLORS.length]
}

function semanticCanvasColor(canvas: HTMLCanvasElement, property: string, fallback: string): string {
  const value = getComputedStyle(canvas).getPropertyValue(property).trim()
  return value || fallback
}

/**
 * Resolves a CSS variable once and keeps it until the document theme
 * changes. Calling getComputedStyle inside the per-node draw loop forces a
 * style recalculation on every animation frame; this hook removes it from
 * the hot path entirely.
 */
function useSemanticCanvasColor(property: string, fallback: string): string {
  const theme = document.documentElement.dataset.theme
  return useMemo(
    () => {
      const canvas = document.createElement('canvas')
      return semanticCanvasColor(canvas, property, fallback)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- theme switch is the only signal that changes the variable
    [property, fallback, theme],
  )
}

export interface CanvasNode {
  id: string
  x: number
  y: number
  label: string
  path: string
  unresolved: boolean
  color?: string
}

export interface CanvasEdge {
  id: string
  source: string
  target: string
  kind: string
}

interface GraphCanvasProps {
  nodes: CanvasNode[]
  edges: CanvasEdge[]
  focusPath: string | null
  width: number
  height: number
  onSelectNode: (path: string) => void
}

export function GraphCanvas({ nodes, edges, focusPath, width, height, onSelectNode }: GraphCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const hoveredIdRef = useRef<string | null>(null)
  const transformRef = useRef({ x: 0, y: 0, scale: 1 })
  const dragRef = useRef<{ startX: number; startY: number; startTx: number; startTy: number } | null>(null)
  const nodeMap = useRef(new Map<string, CanvasNode>())
  const frameRef = useRef<number | null>(null)
  const backingSizeRef = useRef({ width: 0, height: 0, dpr: 0 })

  useEffect(() => {
    const map = new Map<string, CanvasNode>()
    for (const n of nodes) map.set(n.id, n)
    nodeMap.current = map
  }, [nodes])

  const primaryColor = useSemanticCanvasColor('--primary', FOLDER_COLORS[0])
  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    const backing = backingSizeRef.current
    if (backing.width !== width || backing.height !== height || backing.dpr !== dpr) {
      canvas.width = width * dpr
      canvas.height = height * dpr
      backingSizeRef.current = { width, height, dpr }
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    const { x: tx, y: ty, scale } = transformRef.current
    const hoveredId = hoveredIdRef.current
    ctx.clearRect(0, 0, width, height)
    ctx.save()
    ctx.translate(tx, ty)
    ctx.scale(scale, scale)

    for (const edge of edges) {
      const src = nodeMap.current.get(edge.source)
      const tgt = nodeMap.current.get(edge.target)
      if (!src || !tgt) continue
      ctx.beginPath()
      ctx.moveTo(src.x, src.y)
      ctx.lineTo(tgt.x, tgt.y)
      ctx.strokeStyle = hoveredId && hoveredId !== edge.source && hoveredId !== edge.target
        ? 'rgba(100,116,139,0.2)'
        : edge.kind === 'wikilink'
          ? 'rgba(99,102,241,0.6)'
          : 'rgba(100,116,139,0.5)'
      ctx.lineWidth = 1
      ctx.stroke()
    }

    for (const node of nodes) {
      const isFocus = node.path === focusPath
      const isHovered = hoveredId === node.id
      const r = isFocus || isHovered ? 18 : 14
      const fill = node.color ?? folderColor(node.path)

      ctx.beginPath()
      ctx.arc(node.x, node.y, r, 0, Math.PI * 2)
      ctx.fillStyle = node.unresolved ? '#94a3b8' : fill
      ctx.fill()

      if (isFocus) {
        ctx.beginPath()
        ctx.arc(node.x, node.y, 22, 0, Math.PI * 2)
        ctx.strokeStyle = primaryColor
        ctx.lineWidth = 2
        ctx.stroke()
      }

      ctx.fillStyle = '#1e293b'
      ctx.font = '11px sans-serif'
      ctx.textAlign = 'center'
      const label = node.label.length > 18 ? `${node.label.slice(0, 17)}...` : node.label
      ctx.fillText(label, node.x, node.y + 28)
    }

    ctx.restore()
  }, [nodes, edges, focusPath, width, height, primaryColor])

  useEffect(() => {
    draw()
  }, [draw])

  const screenToCanvas = useCallback((clientX: number, clientY: number) => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    const rect = canvas.getBoundingClientRect()
    const { x: tx, y: ty, scale } = transformRef.current
    return {
      x: (clientX - rect.left - tx) / scale,
      y: (clientY - rect.top - ty) / scale,
    }
  }, [])

  const findNodeAt = useCallback((cx: number, cy: number): CanvasNode | null => {
    for (let i = nodes.length - 1; i >= 0; i -= 1) {
      const n = nodes[i]
      const dx = n.x - cx
      const dy = n.y - cy
      if (dx * dx + dy * dy <= 20 * 20) return n
    }
    return null
  }, [nodes])

  const scheduleDraw = useCallback(() => {
    if (frameRef.current) cancelAnimationFrame(frameRef.current)
    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = null
      draw()
    })
  }, [draw])

  useEffect(() => {
    return () => {
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current)
        frameRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    const endDrag = () => {
      dragRef.current = null
    }
    window.addEventListener('mouseup', endDrag)
    return () => window.removeEventListener('mouseup', endDrag)
  }, [])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (dragRef.current) {
      const { startX, startY, startTx, startTy } = dragRef.current
      transformRef.current.x = startTx + (e.clientX - startX)
      transformRef.current.y = startTy + (e.clientY - startY)
      scheduleDraw()
      return
    }
    const { x, y } = screenToCanvas(e.clientX, e.clientY)
    const node = findNodeAt(x, y)
    const newHoveredId = node?.id ?? null
    if (hoveredIdRef.current !== newHoveredId) {
      hoveredIdRef.current = newHoveredId
      const canvas = canvasRef.current
      if (canvas) canvas.style.cursor = newHoveredId ? 'pointer' : 'grab'
      scheduleDraw()
    }
  }, [screenToCanvas, findNodeAt, scheduleDraw])

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startTx: transformRef.current.x,
      startTy: transformRef.current.y,
    }
  }, [])

  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    if (dragRef.current) {
      const dx = Math.abs(e.clientX - dragRef.current.startX)
      const dy = Math.abs(e.clientY - dragRef.current.startY)
      dragRef.current = null
      if (dx < 3 && dy < 3) {
        const { x, y } = screenToCanvas(e.clientX, e.clientY)
        const node = findNodeAt(x, y)
        if (node?.path) onSelectNode(node.path)
      }
    }
  }, [screenToCanvas, findNodeAt, onSelectNode])

  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault()
    const factor = e.deltaY < 0 ? 1.1 : 0.9
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const mx = e.clientX - rect.left
    const my = e.clientY - rect.top
    const t = transformRef.current
    const newScale = Math.max(0.1, Math.min(5, t.scale * factor))
    t.x = mx - (mx - t.x) * (newScale / t.scale)
    t.y = my - (my - t.y) * (newScale / t.scale)
    t.scale = newScale
    scheduleDraw()
  }, [scheduleDraw])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.addEventListener('wheel', handleWheel, { passive: false })
    return () => canvas.removeEventListener('wheel', handleWheel)
  }, [handleWheel])

  return (
    <canvas
      ref={canvasRef}
      style={{ width, height, cursor: 'grab' }}
      onMouseMove={handleMouseMove}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
    />
  )
}
