import { useEffect, useState, type Dispatch, type SetStateAction } from 'react'

const PERSIST_DEBOUNCE_MS = 200

export function usePersistedState<T>(
  key: string,
  defaultValue: T,
  deserialize: (raw: string | null) => T,
  serialize: (val: T) => string = String,
  initialOverride?: T,
): readonly [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => {
    if (initialOverride !== undefined) return initialOverride
    try {
      const raw = localStorage.getItem(key)
      return deserialize(raw)
    } catch {
      return defaultValue
    }
  })

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        localStorage.setItem(key, serialize(value))
      } catch {
        // Ignore storage failures in private browsing.
      }
    }, PERSIST_DEBOUNCE_MS)
    return () => {
      window.clearTimeout(timer)
    }
  }, [key, value, serialize])

  return [value, setValue] as const
}
