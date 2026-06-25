import { useCallback, useEffect, useRef, useState } from 'react'

export function useAppToast(timeoutMs = 6000) {
  const [message, setMessage] = useState<string | null>(null)
  const timer = useRef<number | null>(null)

  const showToast = useCallback(
    (next: string) => {
      setMessage(next)
      if (timer.current) {
        window.clearTimeout(timer.current)
      }
      timer.current = window.setTimeout(() => {
        setMessage(null)
      }, timeoutMs)
    },
    [timeoutMs],
  )

  const dismissToast = useCallback(() => {
    setMessage(null)
    if (timer.current) {
      window.clearTimeout(timer.current)
    }
  }, [])

  useEffect(() => {
    return () => {
      if (timer.current) {
        window.clearTimeout(timer.current)
      }
    }
  }, [])

  return { toastMessage: message, showToast, dismissToast }
}
