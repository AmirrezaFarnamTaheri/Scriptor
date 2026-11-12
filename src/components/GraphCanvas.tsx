import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useI18n } from '../lib/i18n'
import { graphNodeAppearance } from '../lib/graphNodeAppearance'
import { projectFocusedGraph } from '../lib/graphFocusLayout'
import { placeGraphLabels } from '../lib/graphLabelPlacement'

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
  highlightedNeighborIds?: string[]
  /** De-emphasize the unrelated web of links in a large vault graph. */
  focusNeighborhoodOnly?: boolean
}

function directedPairKey(source: string, target: string): string {
  return source < target ? `${source}\u0000${target}` : `${target}\u0000${source}`
}

/**
 * Perpendicular offset applied to each direction of a reciprocal pair so `A → B`
 * and `B → A` read as two edges rather than one.
 *
 * Every edge is drawn, but the offset was applied along each edge's *own*
 * perpendicular: reversing an edge reverses that perpendicular too, so the sign
 * change meant to push the two directions apart cancelled out and the pair stayed
 * collinear. `reciprocalOffsetFor` derives the normal from a pair-canonical
 * direction instead, which is what actually separates them.
 *
 * The value has to clear the arrowhead, and it is shared with the SVG renderer
 * below the 100-node threshold, whose arrow is wider: its `graph-arrow` marker
 * declares `markerWidth="7"` in `strokeWidth` units, which against the edge's 1.5
 * stroke is really 10.5 units.
 */
const RECIPROCAL_EDGE_OFFSET = 12
const ARROW_SIZE = 6
const LABEL_PLATE_PAD_X = 5
const LABEL_PLATE_HEIGHT = 16

/**
 * The perpendicular offset vector for one direction of a reciprocal pair.
 *
 * The normal is taken from the pair in a fixed order, so both directions share
 * it; the sign then genuinely puts them on opposite sides.
 */
function reciprocalOffsetFor(
  sourceId: string,
  targetId: string,
  source: { x: number; y: number },
  target: { x: number; y: number },
  reciprocal: boolean,
): { ox: number; oy: number } {
  if (!reciprocal) return { ox: 0, oy: 0 }
  const sourceFirst = sourceId < targetId
  const cdx = sourceFirst ? target.x - source.x : source.x - target.x
  const cdy = sourceFirst ? target.y - source.y : source.y - target.y
  const distance = Math.hypot(cdx, cdy) || 1
  const sign = sourceFirst ? 1 : -1
  return {
    ox: (-cdy / distance) * RECIPROCAL_EDGE_OFFSET * sign,
    oy: (cdx / distance) * RECIPROCAL_EDGE_OFFSET * sign,
  }
}

export function GraphCanvas({ nodes, edges, focusPath, width, height, onSelectNode, highlightedNeighborIds = [], focusNeighborhoodOnly = false }: GraphCanvasProps) {
  const { t } = useI18n()
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

  const primaryColor = useSemanticColor('--primary', '#6366f1')
  const mutedColor = useSemanticColor('--muted', '#64748b')
  const inkColor = useSemanticColor('--ink', '#1e293b')
  const surfaceColor = useSemanticColor('--surface', '#ffffff')

  const focusedNodeId = useMemo(
    () => nodes.find(node => node.path === focusPath)?.id ?? null,
    [nodes, focusPath],
  )
  const focusedNeighborhood = useMemo(() => {
    const related = new Set<string>()
    if (!focusedNodeId) return related
    related.add(focusedNodeId)
    for (const edge of edges) {
      if (edge.source === focusedNodeId) related.add(edge.target)
      if (edge.target === focusedNodeId) related.add(edge.source)
    }
    return related
  }, [edges, focusedNodeId])

  // The initial 120-note view is a deliberate neighborhood lens: only direct
  // relationships remain in the drawing and the focus is centered. The full
  // vault stays reachable with the existing Show all links action.
  const renderNodes = useMemo(() =>
    focusNeighborhoodOnly && focusedNodeId
      ? projectFocusedGraph(nodes, edges, focusedNodeId, width, height)
      : nodes,
    [nodes, edges, focusedNodeId, focusNeighborhoodOnly, width, height],
  )
  const renderEdges = useMemo(() => {
    if (!focusNeighborhoodOnly || !focusedNodeId) return edges
    const visible = new Set(renderNodes.map((node) => node.id))
    return edges.filter((edge) => visible.has(edge.source) && visible.has(edge.target))
  }, [renderNodes, edges, focusNeighborhoodOnly, focusedNodeId])
  useEffect(() => {
    nodeMap.current = new Map(renderNodes.map((node) => [node.id, node]))
  }, [renderNodes])
  const activeKeyboardNodeIndex = Math.min(keyboardNodeIndex, Math.max(renderNodes.length - 1, 0))

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
    const keyboardNode = keyboardFocused ? renderNodes[activeKeyboardNodeIndex] : undefined
    // Hovering a background dot must not bring the entire 120-node web to the
    // foreground. Only that note escapes the focused-neighborhood treatment.
    const reduceClutter = focusNeighborhoodOnly && Boolean(focusedNodeId)
    ctx.clearRect(0, 0, width, height)
    ctx.fillStyle = surfaceColor
    ctx.fillRect(0, 0, width, height)
    ctx.save()
    ctx.translate(tx, ty)
    ctx.scale(scale, scale)

    for (const edge of renderEdges) {
      const src = nodeMap.current.get(edge.source)
      const tgt = nodeMap.current.get(edge.target)
      if (!src || !tgt) continue

      const dx = tgt.x - src.x
      const dy = tgt.y - src.y
      const distance = Math.hypot(dx, dy) || 1
      const ux = dx / distance
      const uy = dy / distance
      const directions = reciprocalPairs.get(directedPairKey(edge.source, edge.target))
      const reciprocal = (directions?.size ?? 0) > 1
      const { ox, oy } = reciprocalOffsetFor(edge.source, edge.target, src, tgt, reciprocal)
      const startX = src.x + ox
      const startY = src.y + oy
      const targetRadius = tgt.path === focusPath ? 22 : 17
      const endX = tgt.x + ox - ux * targetRadius
      const endY = tgt.y + oy - uy * targetRadius
      const faded = Boolean(hoveredId && hoveredId !== edge.source && hoveredId !== edge.target)
      const edgeColor = edge.kind === 'wikilink' ? primaryColor : mutedColor

      ctx.save()
      ctx.globalAlpha = faded ? 0.2 : reduceClutter ? 0.85 : edge.kind === 'wikilink' ? 0.65 : 0.50
      ctx.strokeStyle = edgeColor
      ctx.fillStyle = edgeColor
      ctx.lineWidth = reduceClutter ? 1.8 : 1.25
      ctx.beginPath()
      ctx.moveTo(startX, startY)
      ctx.lineTo(endX, endY)
      ctx.stroke()

      const arrowSize = ARROW_SIZE
      // The arrowhead spans the edge's own perpendicular, which is unrelated to
      // the reciprocal offset above.
      const perpX = -uy
      const perpY = ux
      ctx.beginPath()
      ctx.moveTo(endX, endY)
      ctx.lineTo(endX - ux * arrowSize + perpX * (arrowSize * 0.6), endY - uy * arrowSize + perpY * (arrowSize * 0.6))
      ctx.lineTo(endX - ux * arrowSize - perpX * (arrowSize * 0.6), endY - uy * arrowSize - perpY * (arrowSize * 0.6))
      ctx.closePath()
      ctx.fill()
      ctx.restore()
    }

    // The focused note, hovered point and direct neighbors take precedence.
    // Opaque label plates must not overlap when a 120-node view is clustered.
    ctx.font = '11px sans-serif'
    ctx.textAlign = 'center'
    const visibleLabels = renderNodes.filter(node => renderNodes.length < 60 || highlightedNeighborIds.includes(node.id) ||
      node.path === focusPath || hoveredId === node.id || keyboardNode?.id === node.id)
    const labelText = new Map(visibleLabels.map(node => [node.id, node.label.length > 18 ? node.label.slice(0, 17) + '…' : node.label]))
    const placedLabels = placeGraphLabels(visibleLabels.map(node => ({
      id: node.id, x: node.x, y: node.y,
      width: ctx.measureText(labelText.get(node.id) ?? '').width + LABEL_PLATE_PAD_X * 2,
      height: LABEL_PLATE_HEIGHT,
      priority: hoveredId === node.id || keyboardNode?.id === node.id ? 0 : node.path === focusPath ? 1 : 2,
    })), width, height)
    for (const label of placedLabels) {
      ctx.fillStyle = surfaceColor
      ctx.beginPath()
      ctx.roundRect(label.left, label.top, label.right - label.left, label.bottom - label.top, 3)
      ctx.fill()
      ctx.fillStyle = inkColor
      ctx.fillText(labelText.get(label.id) ?? '', (label.left + label.right) / 2, label.bottom - 4)
    }

    for (const node of renderNodes) {
      const isFocus = node.path === focusPath
      const isHovered = hoveredId === node.id
      const isKeyboardFocus = keyboardNode?.id === node.id
      const appearance = graphNodeAppearance({
        focusMode: reduceClutter,
        isFocus,
        isNeighbor: focusedNeighborhood.has(node.id),
        isHovered,
        isKeyboardFocus,
      })
      const fill = node.color ?? folderColor(node.path)

      ctx.save()
      ctx.globalAlpha = appearance.alpha
      ctx.beginPath()
      ctx.arc(node.x, node.y, appearance.radius, 0, Math.PI * 2)
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
      ctx.restore()
    }

    ctx.restore()
  }, [
    nodes,
    renderNodes,
    renderEdges,
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
    activeKeyboardNodeIndex,
    highlightedNeighborIds,
    focusNeighborhoodOnly,
    focusedNodeId,
    focusedNeighborhood,
  ])

  useEffect(() => {
    // A view change must not reuse the pan/zoom from a different projection.
    transformRef.current = { x: 0, y: 0, scale: 1 }
    hoveredIdRef.current = null
    setKeyboardNodeIndex(0)
  }, [focusNeighborhoodOnly, focusedNodeId, width, height])

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
    for (let i = renderNodes.length - 1; i >= 0; i -= 1) {
      const node = renderNodes[i]
      const dx = node.x - cx
      const dy = node.y - cy
      if (dx * dx + dy * dy <= 20 * 20) return node
    }
    return null
  }, [renderNodes])

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
    if (renderNodes.length === 0) return
    let nextIndex: number
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      event.preventDefault()
      nextIndex = (activeKeyboardNodeIndex + 1) % renderNodes.length
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      event.preventDefault()
      nextIndex = (activeKeyboardNodeIndex - 1 + renderNodes.length) % renderNodes.length
    } else if (event.key === 'Home') {
      event.preventDefault()
      nextIndex = 0
    } else if (event.key === 'End') {
      event.preventDefault()
      nextIndex = renderNodes.length - 1
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      const node = renderNodes[activeKeyboardNodeIndex]
      if (node?.path) onSelectNode(node.path)
      return
    } else {
      return
    }
    setKeyboardNodeIndex(nextIndex)
    const node = renderNodes[nextIndex]
    if (node) setKeyboardAnnouncement(t('graph.canvasNodeAnnouncement', { name: node.label, index: nextIndex + 1, total: renderNodes.length }))
  }, [activeKeyboardNodeIndex, renderNodes, onSelectNode, t])

  return (
    <div className="graph-canvas-accessible-shell">
      <canvas
        ref={canvasRef}
        className="graph-canvas graph-canvas-bitmap"
        style={{ cursor: 'grab' }}
        role="application"
        tabIndex={0}
        aria-label={t('graph.canvasAria', { nodes: nodes.length, edges: edges.length }) + (focusNeighborhoodOnly && focusedNodeId ? ' · ' + t('graph.nearbyNotes') + ': ' + (renderNodes.length - 1) : '')}
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
