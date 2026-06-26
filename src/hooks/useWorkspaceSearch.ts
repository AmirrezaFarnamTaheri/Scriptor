import { useCallback, useEffect, useRef, useState } from 'react'

import { indexerSearch } from '../bridge/commands'
import type { SearchHit } from '../types/vault'

interface UseWorkspaceSearchOptions {
  onSearchComplete?: (hits: SearchHit[]) => void
  onSearchTiming?: (ms: number) => void
}

export function useWorkspaceSearch(options?: UseWorkspaceSearchOptions) {
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchHit[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const searchTimer = useRef<number | null>(null)

  const runSearch = useCallback(
    async (query: string) => {
      const trimmed = query.trim()
      if (!trimmed) {
        setSearchResults([])
        return
      }

      setIsSearching(true)
      const started = performance.now()
      try {
        const hits = await indexerSearch(trimmed, 25)
        options?.onSearchTiming?.(Math.round(performance.now() - started))
        setSearchResults(hits)
        options?.onSearchComplete?.(hits)
      } catch {
        setSearchResults([])
      } finally {
        setIsSearching(false)
      }
    },
    [options],
  )

  const setVaultSearchQuery = useCallback(
    (query: string) => {
      setSearchQuery(query)
      if (searchTimer.current) {
        window.clearTimeout(searchTimer.current)
      }
      searchTimer.current = window.setTimeout(() => {
        void runSearch(query)
      }, 250)
    },
    [runSearch],
  )

  const clearSearch = useCallback(() => {
    setSearchQuery('')
    setSearchResults([])
    if (searchTimer.current) {
      window.clearTimeout(searchTimer.current)
    }
  }, [])

  useEffect(() => {
    return () => {
      if (searchTimer.current) {
        window.clearTimeout(searchTimer.current)
      }
    }
  }, [])

  return {
    searchQuery,
    searchResults,
    isSearching,
    runSearch,
    setVaultSearchQuery,
    clearSearch,
  }
}
