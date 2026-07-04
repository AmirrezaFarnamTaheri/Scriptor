import { useCallback, useEffect, useRef, useState, type RefObject, type PointerEvent as ReactPointerEvent } from 'react'

import { usePersistedNumber } from './usePersistedNumber'

export function useResizablePanel(
  enabled: boolean,
  containerRef: RefObject<HTMLElement | null>,
  direction: 'left' | 'right',
  defaultWidth: number,
  minWidth: number,
  maxWidth: number,
  storageKey: string,
  onCollapse?: (collapsed: boolean) => void,
) {
  const [width, setWidth] = usePersistedNumber(storageKey, defaultWidth)
  const [dragging, setDragging] = useState(false)
  const draggingRef = useRef(false)

  const updateWidthFromClientX = useCallback(
    (clientX: number) => {
      const host = containerRef.current
      if (!host) return
      const rect = host.getBoundingClientRect()
      
      let newWidth: number
      if (direction === 'left') {
        newWidth = clientX - rect.left
      } else {
        newWidth = rect.right - clientX
      }
      
      // Drag past a threshold to collapse
      const collapseThreshold = Math.max(80, minWidth - 80)
      if (onCollapse && newWidth < collapseThreshold) {
        onCollapse(true)
        draggingRef.current = false
        setDragging(false)
        return
      }
      
      setWidth(Math.min(maxWidth, Math.max(minWidth, newWidth)))
    },
    [setWidth, containerRef, direction, minWidth, maxWidth, onCollapse],
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

  const resetWidth = useCallback(() => {
    setWidth(defaultWidth)
  }, [setWidth, defaultWidth])

  useEffect(() => {
    if (!dragging) return
    document.body.classList.add('is-split-resizing')
    return () => {
      document.body.classList.remove('is-split-resizing')
    }
  }, [dragging])

  return {
    width,
    dragging,
    onHandlePointerDown,
    onHandlePointerMove,
    onHandlePointerUp: endDrag,
    onHandlePointerCancel: endDrag,
    onHandleDoubleClick: resetWidth,
  }
}
