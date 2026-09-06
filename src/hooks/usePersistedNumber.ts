import { usePersistedState } from './usePersistedState'

export function usePersistedNumber(key: string, defaultValue: number) {
  return usePersistedState(key, defaultValue, (raw) => {
    if (raw === null) return defaultValue
    const parsed = Number(raw)
    return Number.isFinite(parsed) ? parsed : defaultValue
  })
}

