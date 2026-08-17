/**
 * search.ts — W5-6 semantic / hybrid search result types.
 *
 * `SemanticSearchResult` is the merged shape returned by `useSearchStore`
 * when both BM25 and cosine embedding results are combined.
 */

/**
 * A hybrid search result combining BM25 keyword rank and cosine similarity.
 * The front-end merges results from both sources using `notePath` as the key.
 *
 * Scores are in [0, 1]:
 * - `bm25Score`     — reciprocal rank: `1 / (rank + 1)`, 0 if keyword-absent.
 * - `embeddingScore`— cosine similarity from the embeddings store, 0 if absent.
 * - `combinedScore` — weighted blend: `(1-α)*bm25 + α*embedding` (α = 0.4 default).
 */
export interface SemanticSearchResult {
  /** Vault-relative path, e.g. `"Projects/Alpha.md"`. */
  notePath: string
  bm25Score: number
  embeddingScore: number
  combinedScore: number
}
