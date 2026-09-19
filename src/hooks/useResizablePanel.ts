import { useCallback, useEffect, useRef, useState, type RefObject, type PointerEvent as ReactPointerEvent } from 'react'

export function useResizablePanel(
  enabled: boolean,
  containerRef: RefObject<HTMLElement | null>,
  direction: 'left' | 'right',
  width: number,
  minWidth: number,
  maxWidth: number,
  resetWidth: number,
  onWidthChange: (width: number) => void,
  onCollapse?: (collapsed: boolean) => void,
) {
  const [dragging, setDragging] = useState(false)
  const draggingRef = useRef(false)
  const boundedWidth = Math.min(maxWidth, Math.max(minWidth, width))

  const updateWidthFromClientX = useCallback(
    (clientX: number) => {
      const host = containerRef.current
      if (!host) return
      const rect = host.getBoundingClientRect()

      const nextWidth = direction === 'left'
        ? clientX - rect.left
        : rect.right - clientX

      // Drag past a threshold to collapse.
      const collapseThreshold = Math.max(80, minWidth - 80)
      if (onCollapse && nextWidth < collapseThreshold) {
        onCollapse(true)
        draggingRef.current = false
        setDragging(false)
        return
      }

      onWidthChange(Math.min(maxWidth, Math.max(minWidth, nextWidth)))
    },
    [containerRef, direction, maxWidth, minWidth, onCollapse, onWidthChange],
  )

  const onHandlePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!enabled) return
      event.preventDefault()
      draggingRef.current = true
      setDragging(true)
      event.currentTarget.setPointerCapture(event.pointerId)
      updateWidthFromClientX(event.clientX)
    },
    [enabled, updateWidthFromClientX],
  )

  const onHandlePointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!draggingRef.current) return
      updateWidthFromClientX(event.clientX)
    },
    [updateWidthFromClientX],
  )

  const endDrag = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    draggingRef.current = false
    setDragging(false)
  }, [])

  const restoreDefaultWidth = useCallback(() => {
    onWidthChange(Math.min(maxWidth, Math.max(minWidth, resetWidth)))
  }, [maxWidth, minWidth, onWidthChange, resetWidth])

  useEffect(() => {
    if (!dragging) return
    document.body.classList.add('is-split-resizing')
    return () => {
      document.body.classList.remove('is-split-resizing')
    }
  }, [dragging])

  return {
    width: boundedWidth,
    dragging,
    onHandlePointerDown,
    onHandlePointerMove,
    onHandlePointerUp: endDrag,
    onHandlePointerCancel: endDrag,
    onHandleDoubleClick: restoreDefaultWidth,
  }
}
