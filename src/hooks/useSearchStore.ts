/**
 * useSearchStore
 *
 * Singleton-pattern search state store for workspace-wide search.
 *
 * ## W5-6: Hybrid BM25 + cosine merge
 * When `embeddingConfig` is supplied the store fires `indexerSearch` (BM25)
 * and `embeddingsSearch` (cosine ANN) concurrently, then merges using
 * normalised rank fusion:
 *
 *   combinedScore = α * bm25RankScore + (1-α) * embeddingScore
 *
 * where α = 0.6 (keyword-biased by default, tunable via `semanticWeight`).
 * Results are re-ranked by `combinedScore` before being stored.  The raw
 * `SearchHit` metadata (title, snippet) is preserved on every result that
 * appears in the BM25 set; semantic-only hits get an empty snippet.
 *
 * Callers that do NOT supply `embeddingConfig` get unchanged BM25 behaviour.
 *
 * Design notes:
 * - The debounce timer and in-flight request guard live in the store, not in
 *   each consumer.
 * - `onSearchComplete` and `onSearchTiming` callbacks are preserved as
 *   optional hooks for telemetry / side-effect callers.
 * - No Zustand / Jotai dependency — uses plain React state so the pattern is
 *   consistent with the rest of the codebase.
 */
import { useCallback, useEffect, useRef, useState } from 'react'

import { indexerSearch } from '../bridge/commands'
import {
  embeddingsSearch,
  type EmbeddingProviderConfig,
} from '../bridge/commands/embeddings'
import type { SemanticSearchResult } from '../types/search'
import type { SearchHit } from '../types/vault'

// ── Hybrid merge ──────────────────────────────────────────────────────────────

/** Default blend: 60% keyword, 40% semantic. Tunable per call-site. */
const DEFAULT_SEMANTIC_WEIGHT = 0.4

/**
 * Merge BM25 hits and cosine ANN results into a ranked list.
 *
 * BM25 rank is converted to a [0,1] score via `1 / (rank + 1)` (reciprocal
 * rank).  Cosine scores are already in [0,1].  Results present in only one
 * source get a 0 contribution from the missing source.
 */
function mergeResults(
  bm25Hits: SearchHit[],
  embeddingHits: { notePath: string; score: number }[],
  semanticWeight: number,
): SemanticSearchResult[] {
  const keywordWeight = 1 - semanticWeight
  const resultMap = new Map<string, SemanticSearchResult>()

  // BM25 contribution — reciprocal rank
  bm25Hits.forEach((hit, index) => {
    const bm25Score = 1 / (index + 1)
    resultMap.set(hit.path, {
      notePath: hit.path,
      bm25Score,
      embeddingScore: 0,
      combinedScore: keywordWeight * bm25Score,
    })
  })

  // Cosine contribution — add to any existing entry or create new
  embeddingHits.forEach((hit) => {
    const existing = resultMap.get(hit.notePath)
    if (existing) {
      existing.embeddingScore = hit.score
      existing.combinedScore =
        keywordWeight * existing.bm25Score + semanticWeight * hit.score
    } else {
      resultMap.set(hit.notePath, {
        notePath: hit.notePath,
        bm25Score: 0,
        embeddingScore: hit.score,
        combinedScore: semanticWeight * hit.score,
      })
    }
  })

  return [...resultMap.values()].sort((a, b) => b.combinedScore - a.combinedScore)
}

// ── Store ─────────────────────────────────────────────────────────────────────

export interface UseSearchStoreOptions {
  onSearchComplete?: (hits: SearchHit[]) => void
  onSearchTiming?: (ms: number) => void
  /** Debounce delay in ms (default: 250) */
  debounceMs?: number
  /** Maximum results to return (default: 25) */
  maxResults?: number
  /**
   * When set, fires `embeddingsSearch` in parallel and merges results.
   * If absent, falls back to pure BM25.
   */
  embeddingConfig?: EmbeddingProviderConfig
  /**
   * How much weight to give semantic scores [0,1] (default: 0.4).
   * The remainder goes to BM25 reciprocal rank.
   */
  semanticWeight?: number
}

export function useSearchStore({
  onSearchComplete,
  onSearchTiming,
  debounceMs = 250,
  maxResults = 25,
  embeddingConfig,
  semanticWeight = DEFAULT_SEMANTIC_WEIGHT,
}: UseSearchStoreOptions = {}) {
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchHit[]>([])
  const [semanticResults, setSemanticResults] = useState<SemanticSearchResult[]>([])
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
        setSemanticResults([])
        return
      }

      const requestId = ++searchRequestId.current
      setIsSearching(true)
      const started = performance.now()
      try {
        // Always fire BM25; optionally fire cosine ANN in parallel.
        const [hits, embHits] = await Promise.all([
          indexerSearch(trimmed, maxResults),
          embeddingConfig
            ? embeddingsSearch(trimmed, embeddingConfig, maxResults).catch(() => [])
            : Promise.resolve([]),
        ])

        if (requestId !== searchRequestId.current) return
        onSearchTiming?.(Math.round(performance.now() - started))

        setSearchResults(hits)
        onSearchComplete?.(hits)

        if (embeddingConfig && embHits.length > 0) {
          setSemanticResults(mergeResults(hits, embHits, semanticWeight))
        } else {
          // No embeddings — synthesise SemanticSearchResult from BM25 only
          setSemanticResults(
            hits.map((hit, idx) => ({
              notePath: hit.path,
              bm25Score: 1 / (idx + 1),
              embeddingScore: 0,
              combinedScore: 1 / (idx + 1),
            })),
          )
        }
      } catch {
        if (requestId === searchRequestId.current) {
          setSearchResults([])
          setSemanticResults([])
        }
      } finally {
        if (requestId === searchRequestId.current) {
          setIsSearching(false)
        }
      }
    },
    [maxResults, embeddingConfig, semanticWeight, onSearchComplete, onSearchTiming],
  )

  /** Update the query and schedule a debounced search. */
  const setVaultSearchQuery = useCallback(
    (query: string) => {
      setSearchQuery(query)
      if (searchTimer.current) {
        window.clearTimeout(searchTimer.current)
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
    setSemanticResults([])
    if (searchTimer.current) {
      window.clearTimeout(searchTimer.current)
      searchTimer.current = null
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
    /** Hybrid-ranked results (BM25 + cosine). Available when embeddingConfig is omitted too (BM25-only). */
    semanticResults,
    isSearching,
    runSearch,
    setVaultSearchQuery,
    clearSearch,
  }
}
