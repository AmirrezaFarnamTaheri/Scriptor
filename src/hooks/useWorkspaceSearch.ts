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
  const searchRequestId = useRef(0)

  const runSearch = useCallback(
    async (query: string) => {
      const trimmed = query.trim()
      if (!trimmed) {
        searchRequestId.current += 1
        setSearchResults([])
        return
      }

      const requestId = ++searchRequestId.current
      setIsSearching(true)
      const started = performance.now()
      try {
        const hits = await indexerSearch(trimmed, 25)
        if (requestId !== searchRequestId.current) {
          return
        }
        options?.onSearchTiming?.(Math.round(performance.now() - started))
        setSearchResults(hits)
        options?.onSearchComplete?.(hits)
      } catch {
        if (requestId === searchRequestId.current) {
          setSearchResults([])
        }
      } finally {
        if (requestId === searchRequestId.current) {
          setIsSearching(false)
        }
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
    searchRequestId.current += 1
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
