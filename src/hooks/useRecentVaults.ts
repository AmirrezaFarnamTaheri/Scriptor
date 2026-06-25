import { useCallback, useEffect, useState } from 'react'

const STORAGE_KEY = 'scriptor.recent-vaults'

export function useRecentVaults() {
  const [recent, setRecent] = useState<string[]>(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY)
      return raw ? (JSON.parse(raw) as string[]) : []
    } catch {
      return []
    }
  })

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(recent.slice(0, 12)))
  }, [recent])

  const remember = useCallback((path: string) => {
    setRecent((current) => [path, ...current.filter((entry) => entry !== path)].slice(0, 12))
  }, [])

  const forget = useCallback((path: string) => {
    setRecent((current) => current.filter((entry) => entry !== path))
  }, [])

  return { recent, remember, forget }
}
