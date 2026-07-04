import { useCallback, useEffect, useRef, useState } from 'react'

const DEFAULT_MAX_QUEUE = 5

export function useAppToast(timeoutMs = 6000, maxQueue = DEFAULT_MAX_QUEUE) {
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const queueRef = useRef<string[]>([])
  const timerRef = useRef<number | null>(null)
  const showingRef = useRef(false)
  const showNextRef = useRef<(() => void) | null>(null)

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const showNext = useCallback(() => {
    if (showingRef.current) return
    const next = queueRef.current.shift()
    if (!next) {
      setToastMessage(null)
      return
    }
    showingRef.current = true
    setToastMessage(next)
    clearTimer()
    timerRef.current = window.setTimeout(() => {
      showingRef.current = false
      timerRef.current = null
      setToastMessage(null)
      showNextRef.current?.()
    }, timeoutMs)
  }, [clearTimer, timeoutMs])

  showNextRef.current = showNext

  const showToast = useCallback(
    (next: string) => {
      queueRef.current.push(next)
      if (queueRef.current.length > maxQueue) {
        queueRef.current = queueRef.current.slice(-maxQueue)
      }
      if (!showingRef.current) {
        showNext()
      }
    },
    [maxQueue, showNext],
  )

  const dismissToast = useCallback(() => {
    clearTimer()
    showingRef.current = false
    setToastMessage(null)
    showNext()
  }, [clearTimer, showNext])

  useEffect(() => {
    return () => {
      clearTimer()
    }
  }, [clearTimer])

  return { toastMessage, showToast, dismissToast }
}
