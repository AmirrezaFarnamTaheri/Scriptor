/**
 * W3-1 — Ranked search contract.
 *
 * `indexerSearchRanked` is the single surface for full-text search in the UI.
 * The `scoreDebug` field exposes the BM25 column weights so the debug
 * affordance (plan §5 W3-1 acceptance) can show why a result ranked where it did.
 *
 * This is an additive contract only (I-9): callers may ignore `scoreDebug`.
 */

import type { VaultId, VaultRelativePath } from './vault'

/** Per-result score breakdown.  All values are raw BM25 (lower = more relevant). */
export interface SearchScoreDebug {
  /** BM25 contribution of the title column (weight 10.0). */
  titleScore: number
  /** BM25 contribution of the headings column (weight 5.0). */
  headingScore: number
  /** BM25 contribution of the tags column (weight 3.0). */
  tagScore: number
  /** BM25 contribution of the body column (weight 1.0). */
  bodyScore: number
  /** Sum of all column contributions (the value ORDER BY uses). */
  bm25Total: number
}

/** One ranked search hit. */
export interface RankedSearchHit {
  noteId: string
  path: VaultRelativePath
  title: string
  /** Best-matching excerpt with `[[` / `]]` markers around matched terms. */
  snippet: string
  /**
   * Score debug data.  Present when the query went through FTS.
   * Absent for fuzzy-fallback hits (W3-2), where ranking is edit-distance only.
   */
  scoreDebug?: SearchScoreDebug
  /** True when this hit came from the Rust fuzzy fallback (W3-2), not FTS. */
  isFuzzyFallback?: boolean
}

export interface IndexerSearchRankedInput {
  vaultId: VaultId
  /** Raw user query — operators (`path:`, `tag:`, `-`, quoted phrases) are parsed server-side. */
  query: string
  limit?: number
}

export interface IndexerSearchRankedOutput {
  hits: RankedSearchHit[]
  /** True when FTS returned zero rows and the fuzzy fallback (W3-2) was used. */
  usedFuzzyFallback: boolean
  /** Milliseconds the Rust side spent on this query (for the debug affordance). */
  durationMs: number
}
