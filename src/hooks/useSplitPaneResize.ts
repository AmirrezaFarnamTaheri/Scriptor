import { useCallback, useEffect, useRef, useState, type RefObject, type PointerEvent as ReactPointerEvent } from 'react'

import { usePersistedNumber } from './usePersistedNumber'

const DEFAULT_RATIO = 0.5
const MIN_RATIO = 0.22
const MAX_RATIO = 0.78

function clampRatio(value: number): number {
  return Math.min(MAX_RATIO, Math.max(MIN_RATIO, value))
}

export function useSplitPaneResize(
  enabled: boolean,
  workspaceRef: RefObject<HTMLDivElement | null>,
  storageKey = 'scriptor:split-preview-ratio',
) {
  const [ratio, setRatio] = usePersistedNumber(storageKey, DEFAULT_RATIO)
  const [dragging, setDragging] = useState(false)
  const draggingRef = useRef(false)

  const updateRatioFromClientX = useCallback(
    (clientX: number) => {
      const host = workspaceRef.current
      if (!host) return
      const rect = host.getBoundingClientRect()
      if (rect.width <= 0) return
      setRatio(clampRatio((clientX - rect.left) / rect.width))
    },
    [setRatio, workspaceRef],
  )

  const onHandlePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!enabled) return
      event.preventDefault()
      draggingRef.current = true
      setDragging(true)
      event.currentTarget.setPointerCapture(event.pointerId)
      updateRatioFromClientX(event.clientX)
    },
    [enabled, updateRatioFromClientX],
  )

  const onHandlePointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!draggingRef.current) return
      updateRatioFromClientX(event.clientX)
    },
    [updateRatioFromClientX],
  )

  const endDrag = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    draggingRef.current = false
    setDragging(false)
  }, [])

  const resetRatio = useCallback(() => {
    setRatio(DEFAULT_RATIO)
  }, [setRatio])

  useEffect(() => {
    if (!dragging) return
    document.body.classList.add('is-split-resizing')
    return () => {
      document.body.classList.remove('is-split-resizing')
    }
  }, [dragging])

  const editorWidth = `${clampRatio(ratio) * 100}%`

  return {
    editorWidth,
    dragging,
    onHandlePointerDown,
    onHandlePointerMove,
    onHandlePointerUp: endDrag,
    onHandlePointerCancel: endDrag,
    onHandleDoubleClick: resetRatio,
  }
}
