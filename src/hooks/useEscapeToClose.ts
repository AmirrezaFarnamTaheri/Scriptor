import { useEffect } from 'react'

export function useEscapeToClose(active: boolean, onClose: () => void): void {
  useEffect(() => {
    if (!active) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [active, onClose])
}
