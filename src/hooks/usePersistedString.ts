import { useEffect, useState } from 'react'

const PERSIST_DEBOUNCE_MS = 200

export function usePersistedString(key: string, defaultValue: string) {
  const [value, setValue] = useState(() => {
    try {
      const raw = localStorage.getItem(key)
      if (raw === null) return defaultValue
      return raw
    } catch {
      return defaultValue
    }
  })

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        localStorage.setItem(key, value)
      } catch {
        // Ignore storage failures in private browsing.
      }
    }, PERSIST_DEBOUNCE_MS)
    return () => {
      window.clearTimeout(timer)
    }
  }, [key, value])

  return [value, setValue] as const
}
