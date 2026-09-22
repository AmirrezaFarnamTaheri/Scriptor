import { useEffect, useLayoutEffect, useRef } from 'react'

import { overlayEscapeCoordinator, toFocusRestorer } from '../lib/overlayEscapeCoordinator'

export function useEscapeToClose(active: boolean, onClose: () => void): void {
  const onCloseRef = useRef(onClose)

  useLayoutEffect(() => {
    onCloseRef.current = onClose
  })

  useEffect(() => {
    if (!active) return
    const restoreFocus = toFocusRestorer(document.activeElement)
    return overlayEscapeCoordinator.register(() => onCloseRef.current(), restoreFocus)
  }, [active])
}
