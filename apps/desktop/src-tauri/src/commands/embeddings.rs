/*!
 * embeddings.rs — W5-5 Tauri IPC commands for the AI / embeddings cluster.
 *
 * ## Commands
 *   - `embeddings_index_note`  — embed a note and persist it in the store.
 *   - `embeddings_remove_note` — delete the embedding for a renamed/deleted note.
 *   - `embeddings_search`      — semantic nearest-neighbor search.
 *
 * ## Architecture
 *   - `EmbedProvider` (trait) is chosen at runtime from the user's provider
 *     config.  At this layer we always resolve to an `OllamaProvider` unless
 *     an `openai_api_key` is supplied.  Provider selection can be made
 *     configurable via the Settings panel later without touching IPC shape.
 *   - The `EmbeddingStore` lives in `<vault>/.scriptor/embeddings.db`.
 *   - Sealed spans are the caller's responsibility to strip (I-3).  The
 *     front-end must call `vault_strip_sealed` before passing `text`.
 *   - No Scriptor-operated server is used; provider is user-supplied (I-4).
 */

use scriptor_embeddings::{
    EmbedProvider, EmbeddingRecord, EmbeddingStore, NoteEmbedder, OllamaProvider,
};
use serde::Deserialize;
use std::path::PathBuf;
use tauri::command;

// ── Provider config (passed per-call to avoid global shared state) ─────────────

/// Minimal provider configuration the front-end sends with each command.
/// Only one of `ollama_base_url` / `openai_api_key` should be set at a time.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProviderConfig {
    /// Vault root — used to locate `<vault>/.scriptor/embeddings.db`.
    pub vault_root: String,

    // Ollama (default, local)
    /// e.g. `"http://localhost:11434"` — if set, Ollama is used.
    pub ollama_base_url: Option<String>,
    /// e.g. `"nomic-embed-text"`.
    pub ollama_model: Option<String>,
    /// Expected dimension of the Ollama model (default: 768).
    pub ollama_dimension: Option<usize>,

    // OpenAI
    /// User's API key from the OS keychain.  If set, OpenAI is preferred.
    pub openai_api_key: Option<String>,
    /// e.g. `"text-embedding-3-small"` (default).
    pub openai_model: Option<String>,
}

// ── Helper: open store from vault root ────────────────────────────────────────

fn open_store(vault_root: &str, dimension: usize) -> Result<EmbeddingStore, String> {
    let db_path: PathBuf = [vault_root, ".scriptor", "embeddings.db"].iter().collect();
    EmbeddingStore::open(&db_path, dimension).map_err(|e| e.to_string())
}

// ── Commands ──────────────────────────────────────────────────────────────────

/// Embed `text` (sealed spans pre-stripped by caller) and persist it in the
/// store keyed by `note_path` (vault-relative).
///
/// Uses Ollama if `ollama_base_url` is set, OpenAI otherwise.
#[command]
pub fn embeddings_index_note(
    note_path: String,
    text: String,
    config: ProviderConfig,
) -> Result<(), String> {
    if let Some(api_key) = &config.openai_api_key {
        let model = config
            .openai_model
            .as_deref()
            .unwrap_or("text-embedding-3-small");
        let provider = scriptor_embeddings::OpenAiProvider::new(api_key, model, None);
        let store = open_store(&config.vault_root, provider.dimension())?;
        let embedder = NoteEmbedder { store, provider };
        embedder
            .index_note(&note_path, &text)
            .map_err(|e| e.to_string())
    } else {
        let base_url = config
            .ollama_base_url
            .as_deref()
            .unwrap_or("http://localhost:11434");
        let model = config.ollama_model.as_deref().unwrap_or("nomic-embed-text");
        let dim = config.ollama_dimension.unwrap_or(768);
        let provider = OllamaProvider::new(base_url, model, dim);
        let store = open_store(&config.vault_root, dim)?;
        let embedder = NoteEmbedder { store, provider };
        embedder
            .index_note(&note_path, &text)
            .map_err(|e| e.to_string())
    }
}

/// Remove the embedding record for a deleted or renamed note.
#[command]
pub fn embeddings_remove_note(
    note_path: String,
    vault_root: String,
    dimension: Option<usize>,
) -> Result<(), String> {
    let dim = dimension.unwrap_or(768);
    let store = open_store(&vault_root, dim)?;
    store
        .delete_embedding(&note_path)
        .map_err(|e| e.to_string())
}

/// Semantic nearest-neighbor search.  Returns up to `limit` results sorted by
/// descending cosine similarity.
#[command]
pub fn embeddings_search(
    query: String,
    limit: Option<usize>,
    config: ProviderConfig,
) -> Result<Vec<EmbeddingRecord>, String> {
    let k = limit.unwrap_or(20);

    if let Some(api_key) = &config.openai_api_key {
        let model = config
            .openai_model
            .as_deref()
            .unwrap_or("text-embedding-3-small");
        let provider = scriptor_embeddings::OpenAiProvider::new(api_key, model, None);
        let store = open_store(&config.vault_root, provider.dimension())?;
        let embedder = NoteEmbedder { store, provider };
        embedder.search(&query, k).map_err(|e| e.to_string())
    } else {
        let base_url = config
            .ollama_base_url
            .as_deref()
            .unwrap_or("http://localhost:11434");
        let model = config.ollama_model.as_deref().unwrap_or("nomic-embed-text");
        let dim = config.ollama_dimension.unwrap_or(768);
        let provider = OllamaProvider::new(base_url, model, dim);
        let store = open_store(&config.vault_root, dim)?;
        let embedder = NoteEmbedder { store, provider };
        embedder.search(&query, k).map_err(|e| e.to_string())
    }
}
