/**
 * embeddings.ts — W5-5 TypeScript bridge for the AI / embeddings cluster.
 *
 * All calls go through the Tauri IPC layer.  Sealed spans must be stripped
 * by the caller before passing `text` (I-3).  No Scriptor-operated server
 * is involved; providers are configured by the user (I-4).
 */

import { invoke } from '@tauri-apps/api/core'
import { requireNative } from '../native.ts'

// ── Types ─────────────────────────────────────────────────────────────────────

/**
 * Embedding provider configuration sent with each command.
 * Only one of ollama / openai should be configured at a time.
 */
export interface EmbeddingProviderConfig {
  /** Vault root used to locate <vault>/.scriptor/embeddings.db */
  vaultRoot: string

  // Ollama (local, no key required)
  ollamaBaseUrl?: string    // default: "http://localhost:11434"
  ollamaModel?: string      // default: "nomic-embed-text"
  ollamaDimension?: number  // default: 768

  // OpenAI
  openaiApiKey?: string     // from OS keychain; triggers OpenAI provider
  openaiModel?: string      // default: "text-embedding-3-small"
}

/**
 * A single semantic-search result.
 * `score` is cosine similarity in [0, 1]; higher = more relevant.
 */
export interface EmbeddingRecord {
  notePath: string
  score: number
}

// ── Commands ──────────────────────────────────────────────────────────────────

/**
 * Embed a note and persist it in the embedding store.
 *
 * @param notePath Vault-relative path, e.g. `"Projects/Alpha.md"`.
 * @param text     Plain text with sealed spans stripped (I-3).
 * @param config   Provider + vault config.
 */
export async function embeddingsIndexNote(
  notePath: string,
  text: string,
  config: EmbeddingProviderConfig,
): Promise<void> {
  requireNative()
  return invoke<void>('embeddings_index_note', { notePath, text, config })
}

/**
 * Remove the embedding record for a deleted or renamed note.
 *
 * @param notePath  Vault-relative path of the note to remove.
 * @param vaultRoot Vault root (to locate the embeddings DB).
 * @param dimension Optional; must match the stored dimension. Default 768.
 */
export async function embeddingsRemoveNote(
  notePath: string,
  vaultRoot: string,
  dimension?: number,
): Promise<void> {
  requireNative()
  return invoke<void>('embeddings_remove_note', { notePath, vaultRoot, dimension })
}

/**
 * Semantic nearest-neighbor search over all indexed notes.
 *
 * Returns up to `limit` results sorted by descending cosine similarity.
 * The front-end should merge these with BM25 keyword results using the
 * `notePath` as the join key.
 *
 * @param query  Natural-language query string.
 * @param limit  Max results to return (default 20).
 * @param config Provider + vault config.
 */
export async function embeddingsSearch(
  query: string,
  config: EmbeddingProviderConfig,
  limit?: number,
): Promise<EmbeddingRecord[]> {
  requireNative()
  return invoke<EmbeddingRecord[]>('embeddings_search', { query, limit, config })
}
