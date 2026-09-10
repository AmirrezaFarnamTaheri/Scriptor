import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

const FOLDER_COLORS = ['#6366f1', '#0ea5e9', '#14b8a6', '#f59e0b', '#ef4444', '#a855f7', '#22c55e']

function folderColor(path: string): string {
  const folder = path.includes('/') ? path.split('/')[0] : '(root)'
  let hash = 0
  for (let i = 0; i < folder.length; i += 1) {
    hash = (hash * 31 + folder.charCodeAt(i)) >>> 0
  }
  return FOLDER_COLORS[hash % FOLDER_COLORS.length]
}

function semanticColor(property: string, fallback: string): string {
  const value = getComputedStyle(document.documentElement).getPropertyValue(property).trim()
  return value || fallback
}

function useSemanticColor(property: string, fallback: string): string {
  const theme = document.documentElement.dataset.theme
  return useMemo(
    () => semanticColor(property, fallback),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- theme switch is the signal that changes semantic CSS variables
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

function directedPairKey(source: string, target: string): string {
  return source < target ? `${source}\u0000${target}` : `${target}\u0000${source}`
}

export function GraphCanvas({ nodes, edges, focusPath, width, height, onSelectNode }: GraphCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const hoveredIdRef = useRef<string | null>(null)
  const transformRef = useRef({ x: 0, y: 0, scale: 1 })
  const dragRef = useRef<{ startX: number; startY: number; startTx: number; startTy: number } | null>(null)
  const nodeMap = useRef(new Map<string, CanvasNode>())
  const frameRef = useRef<number | null>(null)
  const backingSizeRef = useRef({ width: 0, height: 0, dpr: 0 })
  const [keyboardNodeIndex, setKeyboardNodeIndex] = useState(0)
  const [keyboardFocused, setKeyboardFocused] = useState(false)
  const [keyboardAnnouncement, setKeyboardAnnouncement] = useState('')

  useEffect(() => {
    const map = new Map<string, CanvasNode>()
    for (const node of nodes) map.set(node.id, node)
    nodeMap.current = map
    setKeyboardNodeIndex((current) => Math.min(current, Math.max(nodes.length - 1, 0)))
  }, [nodes])

  const primaryColor = useSemanticColor('--primary', '#6366f1')
  const mutedColor = useSemanticColor('--muted', '#64748b')
  const inkColor = useSemanticColor('--ink', '#1e293b')
  const surfaceColor = useSemanticColor('--surface', '#ffffff')

  const reciprocalPairs = useMemo(() => {
    const directions = new Map<string, Set<string>>()
    for (const edge of edges) {
      const key = directedPairKey(edge.source, edge.target)
      const set = directions.get(key) ?? new Set<string>()
      set.add(`${edge.source}\u0000${edge.target}`)
      directions.set(key, set)
    }
    return directions
  }, [edges])

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
    const keyboardNode = keyboardFocused ? nodes[keyboardNodeIndex] : undefined
    ctx.clearRect(0, 0, width, height)
    ctx.fillStyle = surfaceColor
    ctx.fillRect(0, 0, width, height)
    ctx.save()
    ctx.translate(tx, ty)
    ctx.scale(scale, scale)

    for (const edge of edges) {
      const src = nodeMap.current.get(edge.source)
      const tgt = nodeMap.current.get(edge.target)
      if (!src || !tgt) continue

      const dx = tgt.x - src.x
      const dy = tgt.y - src.y
      const distance = Math.hypot(dx, dy) || 1
      const ux = dx / distance
      const uy = dy / distance
      const nx = -uy
      const ny = ux
      const directions = reciprocalPairs.get(directedPairKey(edge.source, edge.target))
      const reciprocal = (directions?.size ?? 0) > 1
      const directionSign = edge.source < edge.target ? 1 : -1
      const offset = reciprocal ? 5 * directionSign : 0
      const startX = src.x + nx * offset
      const startY = src.y + ny * offset
      const targetRadius = tgt.path === focusPath ? 22 : 17
      const endX = tgt.x + nx * offset - ux * targetRadius
      const endY = tgt.y + ny * offset - uy * targetRadius
      const faded = Boolean(hoveredId && hoveredId !== edge.source && hoveredId !== edge.target)
      const edgeColor = edge.kind === 'wikilink' ? primaryColor : mutedColor

      ctx.save()
      ctx.globalAlpha = faded ? 0.2 : edge.kind === 'wikilink' ? 0.65 : 0.5
      ctx.strokeStyle = edgeColor
      ctx.fillStyle = edgeColor
      ctx.lineWidth = 1.25
      ctx.beginPath()
      ctx.moveTo(startX, startY)
      ctx.lineTo(endX, endY)
      ctx.stroke()

      const arrowSize = 6
      ctx.beginPath()
      ctx.moveTo(endX, endY)
      ctx.lineTo(endX - ux * arrowSize + nx * (arrowSize * 0.6), endY - uy * arrowSize + ny * (arrowSize * 0.6))
      ctx.lineTo(endX - ux * arrowSize - nx * (arrowSize * 0.6), endY - uy * arrowSize - ny * (arrowSize * 0.6))
      ctx.closePath()
      ctx.fill()
      ctx.restore()
    }

    for (const node of nodes) {
      const isFocus = node.path === focusPath
      const isHovered = hoveredId === node.id
      const isKeyboardFocus = keyboardNode?.id === node.id
      const radius = isFocus || isHovered ? 18 : 14
      const fill = node.color ?? folderColor(node.path)

      ctx.beginPath()
      ctx.arc(node.x, node.y, radius, 0, Math.PI * 2)
      ctx.fillStyle = node.unresolved ? mutedColor : fill
      ctx.fill()

      if (isFocus) {
        ctx.beginPath()
        ctx.arc(node.x, node.y, 22, 0, Math.PI * 2)
        ctx.strokeStyle = primaryColor
        ctx.lineWidth = 2
        ctx.stroke()
      }

      if (isKeyboardFocus) {
        ctx.beginPath()
        ctx.arc(node.x, node.y, isFocus ? 26 : 22, 0, Math.PI * 2)
        ctx.strokeStyle = inkColor
        ctx.lineWidth = 2
        ctx.stroke()
      }

      ctx.fillStyle = inkColor
      ctx.font = '11px sans-serif'
      ctx.textAlign = 'center'
      const label = node.label.length > 18 ? `${node.label.slice(0, 17)}…` : node.label
      ctx.fillText(label, node.x, node.y + 28)
    }

    ctx.restore()
  }, [
    nodes,
    edges,
    focusPath,
    width,
    height,
    primaryColor,
    mutedColor,
    inkColor,
    surfaceColor,
    reciprocalPairs,
    keyboardFocused,
    keyboardNodeIndex,
  ])

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
      const node = nodes[i]
      const dx = node.x - cx
      const dy = node.y - cy
      if (dx * dx + dy * dy <= 20 * 20) return node
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

  useEffect(() => () => {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current)
  }, [])

  useEffect(() => {
    const endDrag = () => {
      dragRef.current = null
    }
    window.addEventListener('mouseup', endDrag)
    return () => window.removeEventListener('mouseup', endDrag)
  }, [])

  const handleMouseMove = useCallback((event: React.MouseEvent) => {
    if (dragRef.current) {
      const { startX, startY, startTx, startTy } = dragRef.current
      transformRef.current.x = startTx + (event.clientX - startX)
      transformRef.current.y = startTy + (event.clientY - startY)
      scheduleDraw()
      return
    }
    const { x, y } = screenToCanvas(event.clientX, event.clientY)
    const node = findNodeAt(x, y)
    const newHoveredId = node?.id ?? null
    if (hoveredIdRef.current !== newHoveredId) {
      hoveredIdRef.current = newHoveredId
      const canvas = canvasRef.current
      if (canvas) canvas.style.cursor = newHoveredId ? 'pointer' : 'grab'
      scheduleDraw()
    }
  }, [screenToCanvas, findNodeAt, scheduleDraw])

  const handleMouseDown = useCallback((event: React.MouseEvent) => {
    dragRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      startTx: transformRef.current.x,
      startTy: transformRef.current.y,
    }
  }, [])

  const handleMouseUp = useCallback((event: React.MouseEvent) => {
    if (!dragRef.current) return
    const dx = Math.abs(event.clientX - dragRef.current.startX)
    const dy = Math.abs(event.clientY - dragRef.current.startY)
    dragRef.current = null
    if (dx < 3 && dy < 3) {
      const point = screenToCanvas(event.clientX, event.clientY)
      const node = findNodeAt(point.x, point.y)
      if (node?.path) onSelectNode(node.path)
    }
  }, [screenToCanvas, findNodeAt, onSelectNode])

  const handleWheel = useCallback((event: WheelEvent) => {
    event.preventDefault()
    const factor = event.deltaY < 0 ? 1.1 : 0.9
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const mx = event.clientX - rect.left
    const my = event.clientY - rect.top
    const transform = transformRef.current
    const newScale = Math.max(0.1, Math.min(5, transform.scale * factor))
    transform.x = mx - (mx - transform.x) * (newScale / transform.scale)
    transform.y = my - (my - transform.y) * (newScale / transform.scale)
    transform.scale = newScale
    scheduleDraw()
  }, [scheduleDraw])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.addEventListener('wheel', handleWheel, { passive: false })
    return () => canvas.removeEventListener('wheel', handleWheel)
  }, [handleWheel])

  const handleKeyDown = useCallback((event: React.KeyboardEvent<HTMLCanvasElement>) => {
    if (nodes.length === 0) return
    let nextIndex = keyboardNodeIndex
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      event.preventDefault()
      nextIndex = (keyboardNodeIndex + 1) % nodes.length
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      event.preventDefault()
      nextIndex = (keyboardNodeIndex - 1 + nodes.length) % nodes.length
    } else if (event.key === 'Home') {
      event.preventDefault()
      nextIndex = 0
    } else if (event.key === 'End') {
      event.preventDefault()
      nextIndex = nodes.length - 1
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      const node = nodes[keyboardNodeIndex]
      if (node?.path) onSelectNode(node.path)
      return
    } else {
      return
    }
    setKeyboardNodeIndex(nextIndex)
    const node = nodes[nextIndex]
    if (node) setKeyboardAnnouncement(`${node.label}, node ${nextIndex + 1} of ${nodes.length}`)
  }, [keyboardNodeIndex, nodes, onSelectNode])

  return (
    <div className="graph-canvas-accessible-shell">
      <canvas
        ref={canvasRef}
        style={{ width, height, cursor: 'grab' }}
        role="application"
        tabIndex={0}
        aria-label={`Knowledge graph with ${nodes.length} nodes and ${edges.length} directed edges. Use arrow keys to browse nodes and Enter to open one.`}
        onFocus={() => setKeyboardFocused(true)}
        onBlur={() => setKeyboardFocused(false)}
        onKeyDown={handleKeyDown}
        onMouseMove={handleMouseMove}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
      />
      <span className="sr-only" aria-live="polite">{keyboardAnnouncement}</span>
    </div>
  )
}
