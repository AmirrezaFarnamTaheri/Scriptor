/**
 * Workspace-wide hybrid search state.
 *
 * Keyword results come from the SQLite/FTS path. When the vault opts into
 * semantic search (config `semantic` section), the daemon's embedding
 * overlay is fused in by reciprocal-rank fusion; unconfigured vaults degrade
 * to keyword-only with zero semantic network calls (the overlay reports
 * "unavailable" once and is skipped until the query is cleared).
 */
import { useCallback, useEffect, useRef, useState } from 'react'

import { indexerSearch } from '../bridge/commands'
import { fuseKeywordAndSemantic } from '../lib/searchFusion.ts'
import { SemanticUnavailableError, semanticSearch } from '../bridge/commands/semantic.ts'
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
  /** Flipped off after the first "unavailable" response; re-armed on clear. */
  const semanticSupportedRef = useRef(true)

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

        // Semantic overlay (G2): fuse embedding hits into the keyword list by
        // reciprocal-rank fusion. Unavailable = skip silently; the vault has
        // no semantic section, so we stop asking until the query is cleared.
        let fused = hits
        if (semanticSupportedRef.current) {
          try {
            const semantic = await semanticSearch(trimmed, maxResults)
            if (requestId !== searchRequestId.current) return
            fused = fuseKeywordAndSemantic(hits, semantic, maxResults)
          } catch (error) {
            if (error instanceof SemanticUnavailableError) {
              semanticSupportedRef.current = false
            }
            // Other errors (provider down, etc.) also degrade to keyword-only.
          }
        }

        if (requestId !== searchRequestId.current) return
        onSearchTiming?.(Math.round(performance.now() - started))
        setSearchResults(fused)
        onSearchComplete?.(fused)
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
        // A cleared query re-arms the semantic overlay: configuration may have
        // been added since the last attempt.
        semanticSupportedRef.current = true
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
