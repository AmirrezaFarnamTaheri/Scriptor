import { useCallback, useState } from 'react'

export function usePersistedBoolean(key: string, defaultValue: boolean) {
  const [value, setValue] = useState(() => {
    try {
      const raw = localStorage.getItem(key)
      if (raw === null) return defaultValue
      return raw === 'true'
    } catch {
      return defaultValue
    }
  })

  const setPersisted = useCallback(
    (next: boolean | ((previous: boolean) => boolean)) => {
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
