import { useCallback, useState } from 'react'

export function usePersistedNumber(key: string, defaultValue: number) {
  const [value, setValue] = useState(() => {
    try {
      const raw = localStorage.getItem(key)
      if (raw === null) return defaultValue
      const parsed = Number(raw)
      return Number.isFinite(parsed) ? parsed : defaultValue
    } catch {
      return defaultValue
    }
  })

  const setPersisted = useCallback(
    (next: number | ((previous: number) => number)) => {
      setValue((previous) => {
        const resolved = typeof next === 'function' ? next(previous) : next
        try {
          localStorage.setItem(key, String(resolved))
        } catch {
          // Ignore storage failures in private browsing.
        }
        return resolved
      })
    },
    [key],
  )

  return [value, setPersisted] as const
}
