use rusqlite::{Connection, params};
use std::path::Path;
use std::sync::Mutex;

pub mod error;
pub mod ollama_client;
pub mod provider;

pub use error::EmbeddingError;
pub use ollama_client::OllamaClient;
pub use provider::{EmbedProvider, OllamaProvider, OpenAiProvider};

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
        self.store.upsert_embedding(note_path, &vec)
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

    pub fn upsert_embedding(&self, id: &str, vector: &[f32]) -> Result<(), EmbeddingError> {
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
            "INSERT OR REPLACE INTO embeddings (id, vector, dimension, updated_at)
             VALUES (?1, ?2, ?3, unixepoch())",
            params![id, bytes, self.dimension as i64],
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

        let mut scored: Vec<(String, f32)> = Vec::new();
        for row in rows {
            let (id, blob) = row?;
            let stored = bytes_to_vector(&blob);
            let sim = cosine_similarity(vector, &stored);
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

fn vector_to_bytes(v: &[f32]) -> Vec<u8> {
    let mut bytes = Vec::with_capacity(v.len() * 4);
    for &f in v {
        bytes.extend_from_slice(&f.to_le_bytes());
    }
    bytes
}

fn bytes_to_vector(bytes: &[u8]) -> Vec<f32> {
    bytes
        .chunks_exact(4)
        .map(|chunk| f32::from_le_bytes([chunk[0], chunk[1], chunk[2], chunk[3]]))
        .collect()
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
        store.upsert_embedding("note/a", &vec).unwrap();
        assert_eq!(store.count().unwrap(), 1);

        let results = store.query_nearest(&[1.0, 0.0, 0.0, 0.0], 5).unwrap();
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].0, "note/a");
        assert!((results[0].1 - 1.0).abs() < 1e-6);
    }

    #[test]
    fn delete_removes_embedding() {
        let store = EmbeddingStore::open_in_memory(3).unwrap();
        store.upsert_embedding("x", &[1.0, 2.0, 3.0]).unwrap();
        store.delete_embedding("x").unwrap();
        assert_eq!(store.count().unwrap(), 0);
    }

    #[test]
    fn nearest_neighbors_ranked() {
        let store = EmbeddingStore::open_in_memory(2).unwrap();
        store.upsert_embedding("close", &[1.0, 0.0]).unwrap();
        store.upsert_embedding("far", &[0.0, 1.0]).unwrap();
        store.upsert_embedding("mid", &[0.7, 0.7]).unwrap();

        let results = store.query_nearest(&[1.0, 0.0], 2).unwrap();
        assert_eq!(results[0].0, "close");
        assert_eq!(results.len(), 2);
    }

    #[test]
    fn dimension_mismatch_rejected() {
        let store = EmbeddingStore::open_in_memory(3).unwrap();
        let err = store.upsert_embedding("x", &[1.0, 2.0]);
        assert!(matches!(err, Err(EmbeddingError::DimensionMismatch { .. })));
    }

    #[test]
    fn dimension_mismatch_on_query() {
        let store = EmbeddingStore::open_in_memory(4).unwrap();
        store.upsert_embedding("a", &[1.0, 0.0, 0.0, 0.0]).unwrap();
        let err = store.query_nearest(&[1.0, 0.0], 5);
        assert!(matches!(err, Err(EmbeddingError::DimensionMismatch { .. })));
    }

    #[test]
    fn empty_vector_stores_and_queries() {
        let store = EmbeddingStore::open_in_memory(0).unwrap();
        store.upsert_embedding("empty", &[]).unwrap();
        assert_eq!(store.count().unwrap(), 1);
    }

    #[test]
    fn zero_vector_cosine_similarity() {
        let store = EmbeddingStore::open_in_memory(3).unwrap();
        store.upsert_embedding("zero", &[0.0, 0.0, 0.0]).unwrap();
        store.upsert_embedding("one", &[1.0, 0.0, 0.0]).unwrap();
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
                s.upsert_embedding(&id, &vec).unwrap();
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
        store.upsert_embedding("note", &[1.0, 0.0]).unwrap();
        store.upsert_embedding("note", &[0.0, 1.0]).unwrap();
        assert_eq!(store.count().unwrap(), 1);
        let results = store.query_nearest(&[0.0, 1.0], 1).unwrap();
        assert!((results[0].1 - 1.0).abs() < 1e-6);
    }

    #[test]
    fn delete_nonexistent_is_noop() {
        let store = EmbeddingStore::open_in_memory(2).unwrap();
        store.delete_embedding("missing").unwrap();
        assert_eq!(store.count().unwrap(), 0);
    }
}
