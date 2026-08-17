import { useCallback, useEffect, useMemo, useState } from 'react'

import { expectStringArray } from '../lib/runtimeSchema'
import { readVersionedStorage, writeVersionedStorage } from '../lib/versionedStorage'

const STORAGE_KEY = 'scriptor.recent-vaults'

export function useRecentVaults() {
  const [recent, setRecent] = useState<string[]>(() =>
    readVersionedStorage({
      key: STORAGE_KEY,
      schemaVersion: 1,
      fallback: [],
      validate: (value) => expectStringArray(value, 'recent vaults').slice(0, 12),
    }),
  )

  useEffect(() => {
    writeVersionedStorage(STORAGE_KEY, 1, recent.slice(0, 12))
  }, [recent])

  const remember = useCallback((path: string) => {
    setRecent((current) => [path, ...current.filter((entry) => entry !== path)].slice(0, 12))
  }, [])

  const forget = useCallback((path: string) => {
    setRecent((current) => current.filter((entry) => entry !== path))
  }, [])

  return useMemo(() => ({ recent, remember, forget }), [recent, remember, forget])
}
