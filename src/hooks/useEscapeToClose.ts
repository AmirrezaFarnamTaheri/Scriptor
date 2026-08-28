import { useEffect, useLayoutEffect, useRef } from 'react'

import { overlayEscapeCoordinator, type FocusRestorer } from '../lib/overlayEscapeCoordinator'

export function useEscapeToClose(active: boolean, onClose: () => void): void {
  const onCloseRef = useRef(onClose)

  useLayoutEffect(() => {
    onCloseRef.current = onClose
  })

  useEffect(() => {
    if (!active) return
    const activeElement = document.activeElement
    const restoreFocus: FocusRestorer | null =
      activeElement instanceof HTMLElement ? activeElement : null
    return overlayEscapeCoordinator.register(() => onCloseRef.current(), restoreFocus)
  }, [active])
}
