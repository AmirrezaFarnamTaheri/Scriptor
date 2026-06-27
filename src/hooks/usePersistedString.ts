import { useCallback, useState } from 'react'

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

  const setPersisted = useCallback(
    (next: string | ((previous: string) => string)) => {
      setValue((previous) => {
        const resolved = typeof next === 'function' ? next(previous) : next
        try {
          localStorage.setItem(key, resolved)
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
