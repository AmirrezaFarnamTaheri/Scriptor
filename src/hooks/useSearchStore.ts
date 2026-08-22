/**
 * Workspace-wide BM25 search state.
 *
 * Search is deliberately kept on the supported SQLite/FTS path. Experimental
 * embedding engines live outside the default desktop product graph until they
 * graduate through the capability-maturity gate (including native secret
 * handling and release/runtime evidence).
 */
import { useCallback, useEffect, useRef, useState } from 'react'

import { indexerSearch } from '../bridge/commands'
import type { SearchHit } from '../types/vault'

export interface UseSearchStoreOptions {
  onSearchComplete?: (hits: SearchHit[]) => void
  onSearchTiming?: (ms: number) => void
  /** Debounce delay in ms (default: 250). */
  debounceMs?: number
  /** Maximum results to return (default: 25). */
  maxResults?: number
}

export function useSearchStore({
  onSearchComplete,
  onSearchTiming,
  debounceMs = 250,
  maxResults = 25,
}: UseSearchStoreOptions = {}) {
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchHit[]>([])
  const [isSearching, setIsSearching] = useState(false)

  const searchTimer = useRef<number | null>(null)
  const searchRequestId = useRef(0)

  /** Execute a search immediately (no debounce). */
  const runSearch = useCallback(
    async (query: string) => {
      const trimmed = query.trim()
      if (!trimmed) {
        searchRequestId.current += 1
        setSearchResults([])
        setIsSearching(false)
        return
      }

      const requestId = ++searchRequestId.current
      setIsSearching(true)
      const started = performance.now()
      try {
        const hits = await indexerSearch(trimmed, maxResults)
        if (requestId !== searchRequestId.current) return
        onSearchTiming?.(Math.round(performance.now() - started))
        setSearchResults(hits)
        onSearchComplete?.(hits)
      } catch {
        if (requestId === searchRequestId.current) setSearchResults([])
      } finally {
        if (requestId === searchRequestId.current) setIsSearching(false)
      }
    },
    [maxResults, onSearchComplete, onSearchTiming],
  )

  /** Update the query and schedule a debounced search. */
  const setVaultSearchQuery = useCallback(
    (query: string) => {
      setSearchQuery(query)
      if (searchTimer.current) window.clearTimeout(searchTimer.current)
      if (!query.trim()) {
        searchTimer.current = null
        searchRequestId.current += 1
        setSearchResults([])
        setIsSearching(false)
        return
      }
      searchTimer.current = window.setTimeout(() => {
        void runSearch(query)
      }, debounceMs)
    },
    [debounceMs, runSearch],
  )

  /** Clear query, results, and any pending debounce. */
  const clearSearch = useCallback(() => {
    searchRequestId.current += 1
    setSearchQuery('')
    setSearchResults([])
    setIsSearching(false)
    if (searchTimer.current) {
      window.clearTimeout(searchTimer.current)
      searchTimer.current = null
    }
  }, [])

  useEffect(() => {
    return () => {
      if (searchTimer.current) window.clearTimeout(searchTimer.current)
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
