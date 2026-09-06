import { usePersistedState } from './usePersistedState'

export function usePersistedString(key: string, defaultValue: string) {
  return usePersistedState(key, defaultValue, (raw) => (raw === null ? defaultValue : raw))
}

