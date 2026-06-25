import { useRef, useState } from 'react'
import type { CanvasBlock, CanvasPoint, CanvasRect } from '@scriptor/core/contracts/canvas'

import { canvasHitTest, canvasQueryBlocks } from '../../bridge/canvas'
import { isNativeBridgeAvailable } from '../../bridge/platform'
import { CanvasTableSurface } from './CanvasTableSurface'
import { useCanvasViewport } from './useCanvasViewport'

interface CanvasStageProps {
  sceneJson: string
  blocks: CanvasBlock[]
  sceneBounds: CanvasRect
  selectedBlockIds: string[]
  activeTool: string
  defaultLayerId: string
  onSelectBlocks: (ids: string[]) => void
  onAddBlock: (block: CanvasBlock) => void
  onUpdateBlock: (blockId: string, updater: (block: CanvasBlock) => CanvasBlock) => void
}

function boundsFromPoints(points: CanvasPoint[]): CanvasRect {
  if (points.length === 0) {
    return { x: 0, y: 0, width: 1, height: 1 }
  }
  const xs = points.map((point) => point.x)
  const ys = points.map((point) => point.y)
  const minX = Math.min(...xs)
  const minY = Math.min(...ys)
  const maxX = Math.max(...xs)
  const maxY = Math.max(...ys)
  return {
    x: minX - 4,
    y: minY - 4,
    width: Math.max(8, maxX - minX + 8),
    height: Math.max(8, maxY - minY + 8),
  }
}

function strokeWidthForPoint(point: CanvasPoint, base = 2.5): number {
  const pressure = point.pressure ?? 0.5
  return 0.8 + pressure * (base * 1.35)
}

function PressureStroke({ points, stroke, opacity = 1 }: { points: CanvasPoint[]; stroke: string; opacity?: number }) {
  if (points.length < 2) return null
  return (
    <>
      {points.slice(1).map((point, index) => {
        const previous = points[index]!
        return (
          <line
            key={`stroke-${index}`}
            x1={previous.x}
            y1={previous.y}
            x2={point.x}
            y2={point.y}
            stroke={stroke}
            strokeWidth={strokeWidthForPoint(point)}
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={opacity}
          />
        )
      })}
    </>
  )
}

function emptyTablePayload(): string {
  return JSON.stringify({ rows: Array.from({ length: 4 }, () => ['', '', '']) })
}

function capturePoint(event: React.PointerEvent, point: CanvasPoint): CanvasPoint {
  return {
    ...point,
    pressure: event.pressure > 0 ? event.pressure : 0.5,
  }
}

function localBlocksInRect(blocks: CanvasBlock[], rect: CanvasRect): string[] {
  return blocks
    .filter((block) => {
      const bounds = block.bounds
      return (
        bounds.x < rect.x + rect.width &&
        bounds.x + bounds.width > rect.x &&
        bounds.y < rect.y + rect.height &&
        bounds.y + bounds.height > rect.y
      )
    })
    .map((block) => block.id)
}

export function CanvasStage({
  sceneJson,
  blocks,
  sceneBounds,
  selectedBlockIds,
  activeTool,
  defaultLayerId,
  onSelectBlocks,
  onAddBlock,
  onUpdateBlock,
}: CanvasStageProps) {
  const svgRef = useRef<SVGSVGElement | null>(null)
  const inkPointsRef = useRef<CanvasPoint[]>([])
  const marqueeRef = useRef<{ start: CanvasPoint; current: CanvasPoint } | null>(null)
  const [marquee, setMarquee] = useState<CanvasRect | null>(null)
  const [draftStroke, setDraftStroke] = useState<CanvasPoint[]>([])
  const {
    viewBox,
    viewport,
    screenToScene,
    onWheel,
    onPointerDown,
    onPointerMove,
    onPointerUp: onViewportPointerUp,
    reset,
    consumePanGesture,
  } = useCanvasViewport(sceneBounds)

  const finishInkStroke = () => {
    const points = inkPointsRef.current
    inkPointsRef.current = []
    setDraftStroke([])
    if (points.length < 2) return

    const maxZ = blocks.reduce((value, block) => Math.max(value, block.zIndex), 0)
    onAddBlock({
      id: crypto.randomUUID(),
      kind: 'shape',
      shapeKind: 'freehand',
      layerId: defaultLayerId,
      bounds: boundsFromPoints(points),
      zIndex: maxZ + 1,
      strokePoints: points,
      style: { stroke: '#0f172a', strokeWidth: 2.5, fill: 'transparent' },
    })
  }

  const placeTableBlock = (point: CanvasPoint) => {
    const maxZ = blocks.reduce((value, block) => Math.max(value, block.zIndex), 0)
    onAddBlock({
      id: crypto.randomUUID(),
      kind: 'table',
      layerId: defaultLayerId,
      bounds: { x: point.x - 90, y: point.y - 70, width: 220, height: 140 },
      zIndex: maxZ + 1,
      contentRef: emptyTablePayload(),
      style: { fill: '#ffffff', stroke: '#64748b', strokeWidth: 1 },
    })
  }

  const finishMarquee = async (rect: CanvasRect) => {
    if (rect.width < 4 && rect.height < 4) return
    const normalized = {
      x: Math.min(rect.x, rect.x + rect.width),
      y: Math.min(rect.y, rect.y + rect.height),
      width: Math.abs(rect.width),
      height: Math.abs(rect.height),
    }

    if (isNativeBridgeAvailable()) {
      try {
        const ids = await canvasQueryBlocks(
          sceneJson,
          normalized.x,
          normalized.y,
          normalized.width,
          normalized.height,
        )
        if (ids.length > 0) {
          onSelectBlocks(ids)
          return
        }
      } catch {
        // Fall through to local hit test.
      }
    }

    onSelectBlocks(localBlocksInRect(blocks, normalized))
  }

  const handleBlockPointer = (event: React.PointerEvent<SVGGElement>, block: CanvasBlock) => {
    if (activeTool !== 'select') return
    event.stopPropagation()

    if (event.shiftKey) {
      const exists = selectedBlockIds.includes(block.id)
      onSelectBlocks(
        exists ? selectedBlockIds.filter((id) => id !== block.id) : [...selectedBlockIds, block.id],
      )
      return
    }

    onSelectBlocks([block.id])
  }

  const handleStagePointerDown = (event: React.PointerEvent<SVGSVGElement>) => {
    if (!svgRef.current) return

    const point = screenToScene(event.clientX, event.clientY, svgRef.current)

    if (activeTool === 'draw') {
      event.currentTarget.setPointerCapture(event.pointerId)
      const captured = capturePoint(event, point)
      inkPointsRef.current = [captured]
      setDraftStroke([captured])
      return
    }

    if (activeTool === 'table') {
      event.currentTarget.setPointerCapture(event.pointerId)
      return
    }

    if (activeTool === 'select') {
      event.currentTarget.setPointerCapture(event.pointerId)
      marqueeRef.current = { start: point, current: point }
      setMarquee({ x: point.x, y: point.y, width: 0, height: 0 })
      if (!event.shiftKey) {
        onSelectBlocks([])
      }
    }
  }

  const handleStagePointerMove = (event: React.PointerEvent<SVGSVGElement>) => {
    if (!svgRef.current) return
    const point = screenToScene(event.clientX, event.clientY, svgRef.current)

    if (activeTool === 'draw' && inkPointsRef.current.length > 0) {
      const captured = capturePoint(event, point)
      inkPointsRef.current.push(captured)
      setDraftStroke([...inkPointsRef.current])
      return
    }

    if (activeTool === 'select' && marqueeRef.current) {
      const start = marqueeRef.current.start
      marqueeRef.current.current = point
      setMarquee({
        x: start.x,
        y: start.y,
        width: point.x - start.x,
        height: point.y - start.y,
      })
    }
  }

  const handleStagePointerUp = async (event: React.PointerEvent<SVGSVGElement>) => {
    onViewportPointerUp(event)
    if (consumePanGesture()) return
    if (!svgRef.current) return

    if (activeTool === 'draw' && inkPointsRef.current.length > 0) {
      finishInkStroke()
      return
    }

    if (activeTool === 'table') {
      const point = screenToScene(event.clientX, event.clientY, svgRef.current)
      placeTableBlock(point)
      return
    }

    if (activeTool === 'select' && marqueeRef.current) {
      const rect = marquee
      marqueeRef.current = null
      setMarquee(null)
      if (rect && (Math.abs(rect.width) > 4 || Math.abs(rect.height) > 4)) {
        await finishMarquee(rect)
        return
      }
    }

    if (activeTool !== 'select') return
    const point = screenToScene(event.clientX, event.clientY, svgRef.current)

    if (isNativeBridgeAvailable()) {
      try {
        const hit = await canvasHitTest(sceneJson, point.x, point.y)
        if (hit?.blockId) {
          onSelectBlocks(event.shiftKey ? [...new Set([...selectedBlockIds, hit.blockId])] : [hit.blockId])
          return
        }
      } catch {
        // Fall through to local bounds hit test.
      }
    }

    const localHit =
      [...blocks]
        .sort((left, right) => right.zIndex - left.zIndex)
        .find(
          (block) =>
            point.x >= block.bounds.x &&
            point.x <= block.bounds.x + block.bounds.width &&
            point.y >= block.bounds.y &&
            point.y <= block.bounds.y + block.bounds.height,
        ) ?? null

    if (localHit) {
      onSelectBlocks(
        event.shiftKey ? [...new Set([...selectedBlockIds, localHit.id])] : [localHit.id],
      )
    }
  }

  return (
    <div className="canvas-stage-shell">
      <div className="canvas-viewport-controls">
        <button type="button" className="toolbar-button" onClick={reset}>
          Reset view
        </button>
        <span className="canvas-zoom-label">{Math.round(viewport.scale * 100)}%</span>
      </div>
      <svg
        ref={svgRef}
        className="canvas-svg"
        viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`}
        role="img"
        aria-label="Canvas blocks"
        onWheel={onWheel}
        onPointerDown={(event) => {
          if (activeTool === 'select') {
            onPointerDown(event)
          }
          handleStagePointerDown(event)
        }}
        onPointerMove={(event) => {
          if (activeTool === 'select') {
            onPointerMove(event)
          }
          handleStagePointerMove(event)
        }}
        onPointerUp={(event) => {
          void handleStagePointerUp(event)
        }}
      >
        <rect x={sceneBounds.x} y={sceneBounds.y} width={sceneBounds.width} height={sceneBounds.height} fill="#f8fafc" />
        {blocks.map((block) => {
          const fill = block.style?.fill ?? '#ffffff'
          const stroke = block.style?.stroke ?? '#64748b'
          const label = block.contentRef ?? block.id
          const rx = block.kind === 'sticky-note' ? 8 : 2
          const selected = selectedBlockIds.includes(block.id)
          const isFreehand = block.shapeKind === 'freehand' && (block.strokePoints?.length ?? 0) >= 2

          return (
            <g
              key={block.id}
              data-block-id={block.id}
              className={selected ? 'canvas-block selected' : 'canvas-block'}
              onPointerDown={(event) => handleBlockPointer(event, block)}
              role="button"
              tabIndex={0}
              aria-label={`${block.kind}: ${label}`}
            >
              {isFreehand ? (
                <PressureStroke
                  points={block.strokePoints!}
                  stroke={selected ? '#2563eb' : stroke}
                />
              ) : block.kind === 'table' ? (
                <>
                  <rect
                    x={block.bounds.x}
                    y={block.bounds.y}
                    width={block.bounds.width}
                    height={block.bounds.height}
                    rx={rx}
                    fill={fill}
                    stroke={selected ? '#2563eb' : stroke}
                    strokeWidth={selected ? 2.5 : (block.style?.strokeWidth ?? 1)}
                  />
                  <foreignObject
                    x={block.bounds.x + 4}
                    y={block.bounds.y + 4}
                    width={Math.max(0, block.bounds.width - 8)}
                    height={Math.max(0, block.bounds.height - 8)}
                  >
                    <CanvasTableSurface
                      contentRef={block.contentRef ?? ''}
                      onChange={(contentRef) =>
                        onUpdateBlock(block.id, (current) => ({ ...current, contentRef }))
                      }
                    />
                  </foreignObject>
                </>
              ) : (
                <>
                  <rect
                    x={block.bounds.x}
                    y={block.bounds.y}
                    width={block.bounds.width}
                    height={block.bounds.height}
                    rx={rx}
                    fill={fill}
                    stroke={selected ? '#2563eb' : stroke}
                    strokeWidth={selected ? 2.5 : (block.style?.strokeWidth ?? 1)}
                  />
                  <text
                    x={block.bounds.x + 12}
                    y={block.bounds.y + 24}
                    fontFamily="Segoe UI, sans-serif"
                    fontSize={14}
                    fill="#0f172a"
                  >
                    {label}
                  </text>
                </>
              )}
            </g>
          )
        })}
        {draftStroke.length >= 2 ? (
          <PressureStroke points={draftStroke} stroke="#0f172a" opacity={0.92} />
        ) : null}
        {marquee ? (
          <rect
            x={marquee.width < 0 ? marquee.x + marquee.width : marquee.x}
            y={marquee.height < 0 ? marquee.y + marquee.height : marquee.y}
            width={Math.abs(marquee.width)}
            height={Math.abs(marquee.height)}
            fill="rgba(37, 99, 235, 0.08)"
            stroke="#2563eb"
            strokeDasharray="4 3"
            pointerEvents="none"
          />
        ) : null}
      </svg>
    </div>
  )
}
