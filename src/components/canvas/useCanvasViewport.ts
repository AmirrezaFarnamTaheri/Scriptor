import { useCallback, useMemo, useRef, useState, type PointerEvent, type WheelEvent } from 'react'
import type { CanvasRect } from '@scriptor/core/contracts/canvas'

const MIN_SCALE = 0.25
const MAX_SCALE = 4

export interface CanvasViewportState {
  scale: number
  offsetX: number
  offsetY: number
}

export function useCanvasViewport(base: CanvasRect) {
  const [viewport, setViewport] = useState<CanvasViewportState>({
    scale: 1,
    offsetX: 0,
    offsetY: 0,
  })
  const dragRef = useRef<{ x: number; y: number; moved: boolean } | null>(null)
  const panGestureRef = useRef(false)
  const PAN_CLICK_THRESHOLD_PX = 5

  const viewBox = useMemo(() => {
    const width = base.width / viewport.scale
    const height = base.height / viewport.scale
    const x = base.x - viewport.offsetX / viewport.scale
    const y = base.y - viewport.offsetY / viewport.scale
    return { x, y, width, height }
  }, [base.height, base.width, base.x, base.y, viewport.offsetX, viewport.offsetY, viewport.scale])

  const screenToScene = useCallback(
    (clientX: number, clientY: number, svg: SVGSVGElement) => {
      const point = svg.createSVGPoint()
      point.x = clientX
      point.y = clientY
      const ctm = svg.getScreenCTM()
      if (!ctm) return { x: 0, y: 0 }
      const transformed = point.matrixTransform(ctm.inverse())
      return { x: transformed.x, y: transformed.y }
    },
    [],
  )

  const onWheel = useCallback((event: WheelEvent<SVGSVGElement>) => {
    event.preventDefault()
    const delta = event.deltaY > 0 ? 0.9 : 1.1
    setViewport((current) => ({
      ...current,
      scale: Math.min(MAX_SCALE, Math.max(MIN_SCALE, current.scale * delta)),
    }))
  }, [])

  const onPointerDown = useCallback((event: PointerEvent<SVGSVGElement>) => {
    if (event.button !== 0 || event.altKey) return
    dragRef.current = { x: event.clientX, y: event.clientY, moved: false }
    event.currentTarget.setPointerCapture(event.pointerId)
  }, [])

  const onPointerMove = useCallback((event: PointerEvent<SVGSVGElement>) => {
    if (!dragRef.current) return
    const dx = event.clientX - dragRef.current.x
    const dy = event.clientY - dragRef.current.y
    if (Math.hypot(dx, dy) >= PAN_CLICK_THRESHOLD_PX) {
      dragRef.current.moved = true
    }
    dragRef.current.x = event.clientX
    dragRef.current.y = event.clientY
    setViewport((current) => ({
      ...current,
      offsetX: current.offsetX + dx,
      offsetY: current.offsetY + dy,
    }))
  }, [])

  const onPointerUp = useCallback((event: PointerEvent<SVGSVGElement>) => {
    panGestureRef.current = dragRef.current?.moved ?? false
    dragRef.current = null
    event.currentTarget.releasePointerCapture(event.pointerId)
  }, [])

  const consumePanGesture = useCallback(() => {
    const didPan = panGestureRef.current
    panGestureRef.current = false
    return didPan
  }, [])

  const reset = useCallback(() => {
    setViewport({ scale: 1, offsetX: 0, offsetY: 0 })
  }, [])

  return {
    viewBox,
    viewport,
    screenToScene,
    onWheel,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    reset,
    consumePanGesture,
  }
}
