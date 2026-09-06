import { usePersistedState } from './usePersistedState'

export function usePersistedBoolean(key: string, defaultValue: boolean, initialOverride?: boolean) {
  return usePersistedState(
    key,
    defaultValue,
    (raw) => (raw === null ? defaultValue : raw === 'true'),
    String,
    initialOverride,
  )
}

