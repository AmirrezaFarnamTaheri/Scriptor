/**
 * ai.ts — Contract types for the AI / copilot layer.
 *
 * Additive only (I-9). No Scriptor-operated server is ever required (I-4):
 * providers are user-supplied keys or local models only.
 *
 * All AI writes go through the MCP draft editor before touching the vault (I-2).
 * Sealed spans are excluded from context assembly (I-3).
 */

export type AiProviderKind = "openai" | "anthropic" | "local-onnx" | "custom";

export interface AiProviderConfig {
  kind: AiProviderKind;
  /** Model identifier, e.g. "gpt-4o", "claude-3-5-sonnet", or a local path */
  model: string;
  /** API key stored in the OS keychain path; never persisted to disk directly */
  apiKeyRef?: string;
  /** Base URL for custom/local endpoints */
  baseUrl?: string;
}

export interface AiContextItem {
  noteId: string;
  notePath: string;
  /** Excerpt — sealed spans are stripped before this is populated (I-3) */
  excerpt: string;
  /** BM25/vector score that justified inclusion */
  score: number;
}

export interface AiContext {
  /** System prompt assembled from user settings */
  systemPrompt: string;
  items: AiContextItem[];
  /** Total token budget; context is trimmed to fit */
  tokenBudget: number;
}

export interface AiDraftResult {
  /** Proposed markdown text, shown in diff before writing */
  draft: string;
  /** Source notes cited in the draft */
  citations: string[];
  auditId: string;
}

export interface AiToolDeclaration {
  name: string;
  /** Every tool must declare its SensitiveOperation (F-4, D8) */
  sensitiveOperation: string;
  description: string;
}

export interface NearestBlock {
  blockId: string;
  noteId: string;
  excerpt: string;
  distance: number;
}

// ── W5: Embeddings cluster types ──────────────────────────────────────────────

/**
 * Provider kind for the embeddings layer.
 * Mirrors the Rust `EmbedProvider` trait implementations.
 */
export type EmbeddingProviderKind = "ollama" | "openai";

/**
 * A persisted embedding record as returned by semantic search.
 * `score` is cosine similarity in [0, 1] — 1.0 is identical.
 */
export interface EmbeddingRecord {
  /** Vault-relative path, e.g. `"Projects/Alpha.md"`. */
  notePath: string;
  score: number;
}

/**
 * Hybrid search result combining BM25 keyword rank and cosine similarity.
 * The front-end merges results from both sources using `notePath` as the key.
 */
export interface SemanticSearchResult {
  notePath: string;
  /** BM25 keyword score (may be 0 if only in semantic results). */
  bm25Score: number;
  /** Cosine similarity score (may be 0 if only in keyword results). */
  embeddingScore: number;
  /** Blended rank for display ordering. */
  combinedScore: number;
}
