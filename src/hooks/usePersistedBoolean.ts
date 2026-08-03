import { useEffect, useState } from 'react'

const PERSIST_DEBOUNCE_MS = 200

export function usePersistedBoolean(key: string, defaultValue: boolean, initialOverride?: boolean) {
  const [value, setValue] = useState(() => {
    if (initialOverride !== undefined) return initialOverride
    try {
      const raw = localStorage.getItem(key)
      if (raw === null) return defaultValue
      return raw === 'true'
    } catch {
      return defaultValue
    }
  })

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        localStorage.setItem(key, String(value))
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
