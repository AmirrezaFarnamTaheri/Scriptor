import { usePersistedState } from './usePersistedState'

function clampPersistedNumber(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function usePersistedNumber(
  key: string,
  defaultValue: number,
  min = Number.NEGATIVE_INFINITY,
  max = Number.POSITIVE_INFINITY,
) {
  const normalizedDefault = clampPersistedNumber(defaultValue, min, max)
  return usePersistedState(key, normalizedDefault, (raw) => {
    if (raw === null) return normalizedDefault
    const parsed = Number(raw)
    return Number.isFinite(parsed) ? clampPersistedNumber(parsed, min, max) : normalizedDefault
  })
}
