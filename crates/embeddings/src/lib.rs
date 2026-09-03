use rusqlite::{Connection, OptionalExtension, params};
use std::path::Path;
use std::sync::Mutex;

pub mod error;
pub mod ollama_client;
pub mod provider;
pub mod vault_ops;

pub use error::EmbeddingError;
pub use ollama_client::OllamaClient;
pub use provider::{EmbedProvider, OllamaProvider, OpenAiProvider};
pub use vault_ops::{SemanticHit, SyncReport, search_vault_embeddings, sync_vault_embeddings};

use scriptor_vault::SemanticConfig;

/// Default dimension for OpenAI models when the config omits one.
fn openai_default_dimension(model: &str) -> usize {
    match model {
        "text-embedding-3-large" => 3072,
        _ => 1536,
    }
}

/// A provider plus its dimension, erased for daemon storage.
pub struct DaemonEmbedProvider {
    dimension: usize,
    inner: Box<dyn EmbedProvider>,
}

impl DaemonEmbedProvider {
    pub fn as_provider(&self) -> &dyn EmbedProvider {
        &*self.inner
    }

    pub fn dimension(&self) -> usize {
        self.dimension
    }
}

/// Build the configured provider. Semantic search stays opt-in: an absent
/// config or `provider: "none"` resolves to `None`, and every caller must
/// degrade gracefully (the daemon answers an "unavailable" payload).
pub fn resolve_provider(
    config: &SemanticConfig,
    api_key: Option<String>,
) -> Result<Option<DaemonEmbedProvider>, EmbeddingError> {
    match config.provider.as_str() {
        "none" | "" => Ok(None),
        "ollama" => {
            let base_url = config
                .base_url
                .clone()
                .unwrap_or_else(|| "http://localhost:11434".to_string());
            let model = config
                .model
                .clone()
                .unwrap_or_else(|| "nomic-embed-text".to_string());
            let dimension = config
                .dimension
                .ok_or_else(|| {
                    EmbeddingError::Provider(
                        "semantic.dimension must be set for the ollama provider (e.g. 768 for nomic-embed-text)"
                            .to_string(),
                    )
                })?;
            Ok(Some(DaemonEmbedProvider {
                dimension,
                inner: Box::new(OllamaProvider::new(&base_url, &model, dimension)),
            }))
        }
        "openai" => {
            let model = config
                .model
                .clone()
                .unwrap_or_else(|| "text-embedding-3-small".to_string());
            let dimension = config
                .dimension
                .unwrap_or_else(|| openai_default_dimension(&model));
            let Some(api_key) = api_key else {
                return Err(EmbeddingError::Provider(
                    "the openai semantic provider requires an API key (stored in the OS keychain)"
                        .to_string(),
                ));
            };
            Ok(Some(DaemonEmbedProvider {
                dimension,
                inner: Box::new(OpenAiProvider::new(&api_key, &model, config.dimension)),
            }))
        }
        other => Err(EmbeddingError::Provider(format!(
            "unknown semantic provider: {other} (expected ollama, openai, or none)"
        ))),
    }
}

// ── Typed record ──────────────────────────────────────────────────────────────

/// A fully typed embedding record returned from semantic search.
///
/// The `id` is the note's vault-relative path (e.g. `"Projects/Alpha.md"`).
/// Callers overlay BM25 keyword results with these by `note_path`.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct EmbeddingRecord {
    /// Vault-relative note path — the join key for BM25 results.
    pub note_path: String,
    /// Cosine similarity in [0, 1].
    pub score: f32,
}

// ── NoteEmbedder ──────────────────────────────────────────────────────────────

/// High-level helper: embeds note text via a provider and persists in the store.
///
/// - Callers must strip sealed spans before passing `text` (I-3).
/// - The `note_path` is the vault-relative path and serves as the embedding ID.
pub struct NoteEmbedder<P: EmbedProvider> {
    pub store: EmbeddingStore,
    pub provider: P,
}

impl<P: EmbedProvider> NoteEmbedder<P> {
    /// Embed `text` and upsert into the store keyed by `note_path`.
    pub fn index_note(&self, note_path: &str, text: &str) -> Result<(), EmbeddingError> {
        let vec = self.provider.embed_single(text)?;
        self.store
            .upsert_embedding(note_path, Some(&content_hash(text)), &vec)
    }

    /// Remove the embedding for a deleted or renamed note.
    pub fn remove_note(&self, note_path: &str) -> Result<(), EmbeddingError> {
        self.store.delete_embedding(note_path)
    }

    /// Return the top-k nearest notes for a query string.
    /// Returned records are sorted by descending cosine similarity.
    pub fn search(&self, query: &str, k: usize) -> Result<Vec<EmbeddingRecord>, EmbeddingError> {
        let vec = self.provider.embed_single(query)?;
        let raw = self.store.query_nearest(&vec, k)?;
        Ok(raw
            .into_iter()
            .map(|(note_path, score)| EmbeddingRecord { note_path, score })
            .collect())
    }
}

const SCHEMA: &str = "
CREATE TABLE IF NOT EXISTS embeddings (
    id TEXT PRIMARY KEY,
    vector BLOB NOT NULL,
    dimension INTEGER NOT NULL,
    content_hash TEXT,
    updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);
";

pub struct EmbeddingStore {
    conn: Mutex<Connection>,
    dimension: usize,
}

impl EmbeddingStore {
    pub fn open(path: &Path, dimension: usize) -> Result<Self, EmbeddingError> {
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        let conn = Connection::open(path)?;
        conn.pragma_update(None, "journal_mode", "WAL")?;
        conn.pragma_update(None, "synchronous", "NORMAL")?;
        conn.execute_batch(SCHEMA)?;
        Ok(Self {
            conn: Mutex::new(conn),
            dimension,
        })
    }

    pub fn open_in_memory(dimension: usize) -> Result<Self, EmbeddingError> {
        let conn = Connection::open_in_memory()?;
        conn.execute_batch(SCHEMA)?;
        Ok(Self {
            conn: Mutex::new(conn),
            dimension,
        })
    }

    pub fn dimension(&self) -> usize {
        self.dimension
    }

    /// Insert or replace an embedding. `content_hash` records which version
    /// of the source text produced the vector, so sync passes can skip
    /// unchanged notes; pass `None` when the caller does not track hashes.
    pub fn upsert_embedding(
        &self,
        id: &str,
        content_hash: Option<&str>,
        vector: &[f32],
    ) -> Result<(), EmbeddingError> {
        if vector.len() != self.dimension {
            return Err(EmbeddingError::DimensionMismatch {
                expected: self.dimension,
                actual: vector.len(),
            });
        }

        let bytes = vector_to_bytes(vector);
        let conn = self
            .conn
            .lock()
            .map_err(|e| EmbeddingError::Ollama(e.to_string()))?;
        conn.execute(
            "INSERT OR REPLACE INTO embeddings (id, vector, dimension, content_hash, updated_at)
             VALUES (?1, ?2, ?3, ?4, unixepoch())",
            params![id, bytes, self.dimension as i64, content_hash],
        )?;
        Ok(())
    }

    /// Stored content hash for an embedding, if any.
    pub fn hash_for(&self, id: &str) -> Result<Option<String>, EmbeddingError> {
        let conn = self
            .conn
            .lock()
            .map_err(|e| EmbeddingError::Ollama(e.to_string()))?;
        let hash = conn
            .query_row(
                "SELECT content_hash FROM embeddings WHERE id = ?1",
                params![id],
                |row| row.get::<_, Option<String>>(0),
            )
            .optional()?;
        Ok(hash.flatten())
    }

    /// Every stored embedding id.
    pub fn ids(&self) -> Result<Vec<String>, EmbeddingError> {
        let conn = self
            .conn
            .lock()
            .map_err(|e| EmbeddingError::Ollama(e.to_string()))?;
        let mut statement = conn.prepare("SELECT id FROM embeddings")?;
        let rows = statement.query_map([], |row| row.get::<_, String>(0))?;
        let mut ids = Vec::new();
        for row in rows {
            ids.push(row?);
        }
        Ok(ids)
    }

    /// Drop embeddings stored under a different dimension (e.g. after the
    /// configured model changed); vectors of mismatched dimension can never
    /// be compared again.
    pub fn prune_dimension(&self, dimension: usize) -> Result<(), EmbeddingError> {
        let conn = self
            .conn
            .lock()
            .map_err(|e| EmbeddingError::Ollama(e.to_string()))?;
        conn.execute(
            "DELETE FROM embeddings WHERE dimension != ?1",
            params![dimension as i64],
        )?;
        Ok(())
    }

    pub fn query_nearest(
        &self,
        vector: &[f32],
        k: usize,
    ) -> Result<Vec<(String, f32)>, EmbeddingError> {
        if vector.len() != self.dimension {
            return Err(EmbeddingError::DimensionMismatch {
                expected: self.dimension,
                actual: vector.len(),
            });
        }

        let conn = self
            .conn
            .lock()
            .map_err(|e| EmbeddingError::Ollama(e.to_string()))?;
        let mut stmt = conn.prepare("SELECT id, vector FROM embeddings WHERE dimension = ?1")?;
        let rows = stmt.query_map(params![self.dimension as i64], |row| {
            let id: String = row.get(0)?;
            let blob: Vec<u8> = row.get(1)?;
            Ok((id, blob))
        })?;

        // One scratch buffer reused across rows: no per-row heap allocation,
        // and the similarity loop runs over plain float slices so the
        // optimizer can vectorize it.
        let mut scratch: Vec<f32> = Vec::with_capacity(self.dimension);
        let mut scored: Vec<(String, f32)> = Vec::new();
        for row in rows {
            let (id, blob) = row?;
            let expected_bytes = self.dimension.checked_mul(std::mem::size_of::<f32>()).ok_or_else(|| {
                EmbeddingError::Provider("embedding dimension byte size overflow".into())
            })?;
            if blob.len() != expected_bytes {
                return Err(EmbeddingError::Provider(format!(
                    "corrupt embedding vector for {id}: expected {expected_bytes} bytes, got {}",
                    blob.len()
                )));
            }
            scratch.clear();
            scratch.extend(
                blob.chunks_exact(4)
                    .map(|chunk| f32::from_le_bytes(chunk.try_into().expect("4-byte chunk"))),
            );
            let sim = cosine_similarity(vector, &scratch);
            scored.push((id, sim));
        }

        scored.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal));
        scored.truncate(k);
        Ok(scored)
    }

    pub fn delete_embedding(&self, id: &str) -> Result<(), EmbeddingError> {
        let conn = self
            .conn
            .lock()
            .map_err(|e| EmbeddingError::Ollama(e.to_string()))?;
        conn.execute("DELETE FROM embeddings WHERE id = ?1", params![id])?;
        Ok(())
    }

    pub fn count(&self) -> Result<usize, EmbeddingError> {
        let conn = self
            .conn
            .lock()
            .map_err(|e| EmbeddingError::Ollama(e.to_string()))?;
        let count: i64 = conn.query_row("SELECT COUNT(*) FROM embeddings", [], |row| row.get(0))?;
        Ok(count as usize)
    }
}

/// FNV-1a change marker for embedded text — not a security digest;
/// collisions only cost one redundant embedding round-trip.
pub(crate) fn content_hash(text: &str) -> String {
    let mut hash: u64 = 0xcbf2_9ce4_8422_2325;
    for byte in text.as_bytes() {
        hash ^= u64::from(*byte);
        hash = hash.wrapping_mul(0x0000_0100_0000_01b3);
    }
    format!("{hash:016x}")
}

fn vector_to_bytes(v: &[f32]) -> Vec<u8> {
    let mut bytes = Vec::with_capacity(v.len() * 4);
    for &f in v {
        bytes.extend_from_slice(&f.to_le_bytes());
    }
    bytes
}

fn cosine_similarity(a: &[f32], b: &[f32]) -> f32 {
    let len = a.len().min(b.len());
    let mut dot = 0.0f32;
    let mut norm_a = 0.0f32;
    let mut norm_b = 0.0f32;
    for i in 0..len {
        dot += a[i] * b[i];
        norm_a += a[i] * a[i];
        norm_b += b[i] * b[i];
    }
    let denom = norm_a.sqrt() * norm_b.sqrt();
    if denom == 0.0 { 0.0 } else { dot / denom }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn round_trip_embedding() {
        let store = EmbeddingStore::open_in_memory(4).unwrap();
        let vec = vec![1.0, 0.0, 0.0, 0.0];
        store.upsert_embedding("note/a", None, &vec).unwrap();
        assert_eq!(store.count().unwrap(), 1);

        let results = store.query_nearest(&[1.0, 0.0, 0.0, 0.0], 5).unwrap();
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].0, "note/a");
        assert!((results[0].1 - 1.0).abs() < 1e-6);
    }

    #[test]
    fn delete_removes_embedding() {
        let store = EmbeddingStore::open_in_memory(3).unwrap();
        store.upsert_embedding("x", None, &[1.0, 2.0, 3.0]).unwrap();
        store.delete_embedding("x").unwrap();
        assert_eq!(store.count().unwrap(), 0);
    }

    #[test]
    fn nearest_neighbors_ranked() {
        let store = EmbeddingStore::open_in_memory(2).unwrap();
        store.upsert_embedding("close", None, &[1.0, 0.0]).unwrap();
        store.upsert_embedding("far", None, &[0.0, 1.0]).unwrap();
        store.upsert_embedding("mid", None, &[0.7, 0.7]).unwrap();

        let results = store.query_nearest(&[1.0, 0.0], 2).unwrap();
        assert_eq!(results[0].0, "close");
        assert_eq!(results.len(), 2);
    }

    #[test]
    fn dimension_mismatch_rejected() {
        let store = EmbeddingStore::open_in_memory(3).unwrap();
        let err = store.upsert_embedding("x", None, &[1.0, 2.0]);
        assert!(matches!(err, Err(EmbeddingError::DimensionMismatch { .. })));
    }

    #[test]
    fn dimension_mismatch_on_query() {
        let store = EmbeddingStore::open_in_memory(4).unwrap();
        store
            .upsert_embedding("a", None, &[1.0, 0.0, 0.0, 0.0])
            .unwrap();
        let err = store.query_nearest(&[1.0, 0.0], 5);
        assert!(matches!(err, Err(EmbeddingError::DimensionMismatch { .. })));
    }

    #[test]
    fn empty_vector_stores_and_queries() {
        let store = EmbeddingStore::open_in_memory(0).unwrap();
        store.upsert_embedding("empty", None, &[]).unwrap();
        assert_eq!(store.count().unwrap(), 1);
    }

    #[test]
    fn zero_vector_cosine_similarity() {
        let store = EmbeddingStore::open_in_memory(3).unwrap();
        store
            .upsert_embedding("zero", None, &[0.0, 0.0, 0.0])
            .unwrap();
        store
            .upsert_embedding("one", None, &[1.0, 0.0, 0.0])
            .unwrap();
        let results = store.query_nearest(&[0.0, 0.0, 0.0], 5).unwrap();
        assert_eq!(results.len(), 2);
        for (_, sim) in &results {
            assert!(*sim == 0.0, "zero vector similarity should be 0.0");
        }
    }

    #[test]
    fn concurrent_upserts() {
        use std::sync::Arc;
        use std::thread;

        let store = Arc::new(EmbeddingStore::open_in_memory(4).unwrap());
        let mut handles = Vec::new();
        for i in 0..8 {
            let s = Arc::clone(&store);
            handles.push(thread::spawn(move || {
                let id = format!("note/{i}");
                let vec = vec![i as f32, 0.0, 0.0, 0.0];
                s.upsert_embedding(&id, None, &vec).unwrap();
            }));
        }
        for h in handles {
            h.join().unwrap();
        }
        assert_eq!(store.count().unwrap(), 8);
    }

    #[test]
    fn upsert_replaces_existing() {
        let store = EmbeddingStore::open_in_memory(2).unwrap();
        store.upsert_embedding("note", None, &[1.0, 0.0]).unwrap();
        store.upsert_embedding("note", None, &[0.0, 1.0]).unwrap();
        assert_eq!(store.count().unwrap(), 1);
        let results = store.query_nearest(&[0.0, 1.0], 1).unwrap();
        assert!((results[0].1 - 1.0).abs() < 1e-6);
    }

    #[test]
    fn query_nearest_scales_to_ten_thousand_vectors() {
        // Correctness at the scale where a per-row heap allocation would show
        // up: 10k vectors of 1536 floats, nearest must still be exact.
        let store = EmbeddingStore::open_in_memory(1536).unwrap();
        let mut query = vec![0.0f32; 1536];
        query[0] = 1.0;
        for i in 0..10_000u32 {
            let mut vector = vec![0.0f32; 1536];
            // Only note 9999 points the same way as the query.
            if i == 9999 {
                vector[0] = 1.0;
            } else {
                vector[1 + (i as usize) % 1535] = 1.0;
            }
            store
                .upsert_embedding(&format!("note/{i}"), None, &vector)
                .unwrap();
        }
        let hits = store.query_nearest(&query, 5).unwrap();
        assert_eq!(hits[0].0, "note/9999");
        assert!((hits[0].1 - 1.0).abs() < 1e-6);
    }

    #[test]
    fn content_hash_round_trip_and_prune() {
        let store = EmbeddingStore::open_in_memory(2).unwrap();
        store
            .upsert_embedding("note/a", Some("hash-1"), &[1.0, 0.0])
            .unwrap();
        assert_eq!(store.hash_for("note/a").unwrap().as_deref(), Some("hash-1"));
        store
            .upsert_embedding("note/a", Some("hash-2"), &[0.0, 1.0])
            .unwrap();
        assert_eq!(store.hash_for("note/a").unwrap().as_deref(), Some("hash-2"));
        assert_eq!(store.hash_for("missing").unwrap(), None);

        let other_dimension = EmbeddingStore::open_in_memory(4).unwrap();
        other_dimension
            .upsert_embedding("note/b", None, &[1.0, 0.0, 0.0, 0.0])
            .unwrap();
        other_dimension.prune_dimension(4).unwrap();
        assert_eq!(other_dimension.count().unwrap(), 1);
    }

    #[test]
    fn ids_lists_every_embedding() {
        let store = EmbeddingStore::open_in_memory(2).unwrap();
        store.upsert_embedding("a", None, &[1.0, 0.0]).unwrap();
        store.upsert_embedding("b", None, &[0.0, 1.0]).unwrap();
        let mut ids = store.ids().unwrap();
        ids.sort();
        assert_eq!(ids, vec!["a".to_string(), "b".to_string()]);
    }

    #[test]
    fn delete_nonexistent_is_noop() {
        let store = EmbeddingStore::open_in_memory(2).unwrap();
        store.delete_embedding("missing").unwrap();
        assert_eq!(store.count().unwrap(), 0);
    }
}
