# BL-37: Local Embeddings & Vector Index

## Status

- **Phase**: D — Strategic Expansion
- **Priority**: High
- **Tracking**: BL-37

## Current State

Scriptor uses **FTS5** (SQLite full-text search) for note search:

```
┌───────────┐   query   ┌──────────────┐   BM25 ranking   ┌────────┐
│ Renderer   │ ────────→ │ command_     │ ────────────────→ │ FTS5   │
│            │ ←──────── │ gateway      │ ←──────────────── │ index  │
└───────────┘  results   └──────────────┘                   └────────┘
```

**Limitations**:
- Exact keyword matching only — "machine learning" won't match "ML"
- No semantic similarity for related-note discovery
- No concept of "notes like this one"
- Query expansion requires manual synonym lists

## Proposed Architecture

Hybrid retrieval: FTS5 (lexical) + vector index (semantic), merged at query time.

```
┌──────────────────────────────────────────────────────────────┐
│ scriptor-daemon                                               │
│                                                               │
│  ┌─────────────┐    ┌───────────────────┐                    │
│  │ FTS5 index   │    │ Vector store       │                    │
│  │ (existing)   │    │ (new)              │                    │
│  │              │    │                    │                    │
│  │ BM25 scores  │    │ cosine similarity  │                    │
│  └──────┬───────┘    └────────┬──────────┘                    │
│         │                     │                               │
│         ↓                     ↓                               │
│  ┌──────────────────────────────────────┐                    │
│  │ HybridRetriever                       │                    │
│  │                                       │                    │
│  │ score = α·BM25 + (1−α)·cosine_sim    │                    │
│  │ default α = 0.5                       │                    │
│  └──────────────────────────────────────┘                    │
│         │                                                     │
│         ↓                                                     │
│  ┌──────────────┐                                             │
│  │ Embedding     │ ← embed on note save (debounced)           │
│  │ Pipeline      │ ← batch re-embed on vault scan             │
│  └──────────────┘                                             │
└──────────────────────────────────────────────────────────────┘
```

## Candidates

| Feature | sqlite-vss | qdrant-lite | hnswlib (via Rust) |
|---------|-----------|-------------|-------------------|
| Storage | SQLite extension | Embedded Qdrant | Pure Rust lib |
| Dependencies | SQLite + C lib | Rust crate | Rust crate |
| HNSW index | Yes | Yes | Yes |
| Persistence | Single `.db` file | Directory | Single file |
| Metadata filter | Via SQLite joins | Native filtering | Manual post-filter |
| Maturity | Moderate | High | High |
| Binary size | ~2 MB | ~5 MB | ~500 KB |

### Recommendation

**sqlite-vss** — integrates with existing SQLite infrastructure, single-file vault portability, no additional server process.

## Embedding Model

### Option A: Local ONNX model

- **Model**: `all-MiniLM-L6-v2` (384 dimensions, ~80 MB)
- **Runtime**: `ort` crate (ONNX Runtime)
- **Pros**: No network dependency, deterministic
- **Cons**: Model download on first use, ~200ms per embed

### Option B: Daemon RPC to external service

- **Endpoint**: Configurable, default to `localhost:11434` (Ollama)
- **Model**: `nomic-embed-text` or `mxbai-embed-large`
- **Pros**: Model hot-swap, GPU offload
- **Cons**: External dependency

**Recommendation**: Start with Option B (Ollama), add Option A later.

## Data Flow

```
Note save (debounced 500ms)
  │
  ↓
┌─────────────────────────────────┐
│ 1. Extract text content          │
│    - Frontmatter stripped        │
│    - Wikilinks resolved to text  │
│    - Code blocks excluded        │
│                                 │
│ 2. Chunk if > 512 tokens         │
│    - Paragraph boundaries        │
│    - 128-token overlap           │
│                                 │
│ 3. Embed via RPC                 │
│    POST /api/embed               │
│    { "input": [chunk1, chunk2] } │
│                                 │
│ 4. Upsert to sqlite-vss          │
│    - note_path (FK)              │
│    - chunk_index                 │
│    - embedding BLOB              │
│    - updated_at timestamp        │
└─────────────────────────────────┘
```

## IPC Commands (command_gateway additions)

```rust
// Add to COMMAND_CATALOG
"embed_note",          // Force re-embed a single note
"embed_vault",         // Batch re-embed entire vault
"search_semantic",     // Vector-only search
"search_hybrid",       // FTS5 + vector merged search
"embed_status",        // Embedding coverage stats
"embed_config",        // Get/set embedding model config
```

### Types

```rust
#[derive(Serialize, Deserialize)]
pub struct SemanticSearchRequest {
    pub query: String,
    pub limit: usize,
    pub min_score: Option<f32>,
    pub scope: Option<Vec<String>>,  // restrict to paths
}

#[derive(Serialize, Deserialize)]
pub struct SemanticSearchResult {
    pub hits: Vec<SemanticHit>,
    pub query_embedding_ms: u64,
    pub total_ms: u64,
}

#[derive(Serialize, Deserialize)]
pub struct SemanticHit {
    pub path: String,
    pub chunk_text: String,
    pub score: f32,
    pub embedding_source: String,  // "local" | "remote"
}
```

## Schema (sqlite-vss)

```sql
CREATE VIRTUAL TABLE note_embeddings USING vss0(
    embedding(384)  -- dimension must match model
);

CREATE TABLE note_embedding_meta (
    id INTEGER PRIMARY KEY,
    note_path TEXT NOT NULL,
    chunk_index INTEGER NOT NULL DEFAULT 0,
    chunk_text TEXT NOT NULL,
    model_id TEXT NOT NULL,
    updated_at INTEGER NOT NULL,
    UNIQUE(note_path, chunk_index)
);
```

## Integration with Existing Search

```rust
// crates/daemon/src/search_handler.rs
pub fn hybrid_search(
    state: &DaemonState,
    query: &str,
    limit: usize,
    alpha: f32,  // FTS5 weight vs vector weight
) -> Result<Vec<HybridHit>, SearchError> {
    let fts_hits = search_notes(query, limit * 2)?;
    let vec_hits = semantic_search(query, limit * 2)?;

    // Reciprocal Rank Fusion
    let merged = reciprocal_rank_fusion(fts_hits, vec_hits, alpha);
    Ok(merged.into_iter().take(limit).collect())
}
```

## Migration

1. **Phase 1**: Add `sqlite-vss` extension, create schema, batch embed on scan
2. **Phase 2**: Wire `search_semantic` IPC, add UI toggle
3. **Phase 3**: Implement hybrid retrieval, make default
4. **Phase 4**: "Related notes" panel, "notes like this" features

## Open Questions

- [ ] Graceful degradation when embedding model unavailable?
- [ ] Should embedding be opt-in per vault or always-on?
- [ ] Privacy: embedding vectors may leak content — encrypt at rest?
- [ ] Re-embed strategy when model changes (full rebuild vs incremental)?
