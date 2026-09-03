/*!
 * provider.rs — W5-3: Unified embedding provider abstraction.
 *
 * ## Single-definition rule (I-5)
 * All embedding I/O goes through the `EmbedProvider` trait.  Components that
 * need embeddings call `EmbedProvider::embed_texts`; they never call an HTTP
 * client directly.
 *
 * ## Invariants
 * - I-4: No Scriptor-operated server is required.  Providers are user-supplied
 *   API keys or local Ollama instances — both configured exclusively by the user.
 * - I-3: Sealed spans must be stripped from text before embedding; callers are
 *   responsible for this precondition.
 */

use crate::error::EmbeddingError;
use crate::ollama_client::OllamaClient;
use serde::{Deserialize, Serialize};
use std::time::Duration;

// ── Trait ─────────────────────────────────────────────────────────────────────

/// Unified interface for any embedding backend.
///
/// All methods are blocking to keep the Tauri command thread simple; Tauri
/// spawns commands on a blocking thread pool.
pub trait EmbedProvider: Send + Sync {
    /// Embed a batch of texts in one round-trip.
    /// Returns one `Vec<f32>` per input, in order.
    fn embed_texts(&self, texts: &[&str]) -> Result<Vec<Vec<f32>>, EmbeddingError>;

    /// Convenience: embed a single text.
    fn embed_single(&self, text: &str) -> Result<Vec<f32>, EmbeddingError> {
        self.embed_texts(&[text])?
            .into_iter()
            .next()
            .ok_or_else(|| EmbeddingError::Provider("empty batch result for single text".into()))
    }

    /// The dimension of embeddings this provider returns.
    fn dimension(&self) -> usize;
}

// ── Ollama provider ────────────────────────────────────────────────────────────

/// Wraps `OllamaClient` to implement `EmbedProvider`.
pub struct OllamaProvider {
    client: OllamaClient,
    dimension: usize,
}

impl OllamaProvider {
    /// `base_url` e.g. `http://localhost:11434`.
    /// `model` e.g. `nomic-embed-text`.
    /// `dimension` must match the model's output dimension (e.g. 768 for nomic).
    pub fn new(base_url: &str, model: &str, dimension: usize) -> Self {
        Self {
            client: OllamaClient::new(base_url, model),
            dimension,
        }
    }
}

impl EmbedProvider for OllamaProvider {
    fn embed_texts(&self, texts: &[&str]) -> Result<Vec<Vec<f32>>, EmbeddingError> {
        let vectors = self.client.embed(texts)?;
        validate_batch_shape(texts.len(), self.dimension, &vectors)?;
        Ok(vectors)
    }

    fn dimension(&self) -> usize {
        self.dimension
    }
}

// ── OpenAI provider ────────────────────────────────────────────────────────────

/// Minimal OpenAI embeddings client (text-embedding-3-small / large).
///
/// No external openai-rs crate is used to keep the dependency surface small.
pub struct OpenAiProvider {
    model: String,
    dimension: usize,
    requested_dimensions: Option<usize>,
    api_key: String,
    base_url: String,
    client: reqwest::blocking::Client,
}

#[derive(Serialize)]
struct OpenAiEmbedRequest<'a> {
    model: &'a str,
    input: &'a [&'a str],
    /// Only sent if set (reduces response size slightly).
    #[serde(skip_serializing_if = "Option::is_none")]
    dimensions: Option<usize>,
}

#[derive(Deserialize)]
struct OpenAiEmbedResponse {
    data: Vec<OpenAiEmbedData>,
}

#[derive(Deserialize)]
struct OpenAiEmbedData {
    embedding: Vec<f32>,
}

impl OpenAiProvider {
    /// `api_key` — user-supplied key stored in the OS keychain (never on disk).
    /// `model` — `"text-embedding-3-small"` (1536-d) or `"text-embedding-3-large"` (3072-d).
    /// `dimension` — pass `None` to use the model default.
    pub fn new(api_key: &str, model: &str, dimension: Option<usize>) -> Self {
        let dim = dimension.unwrap_or(match model {
            "text-embedding-3-large" => 3072,
            _ => 1536, // text-embedding-3-small default
        });
        Self {
            model: model.to_string(),
            dimension: dim,
            requested_dimensions: dimension,
            api_key: api_key.to_string(),
            base_url: "https://api.openai.com".to_string(),
            client: reqwest::blocking::Client::builder()
                .timeout(Duration::from_secs(60))
                .build()
                .expect("failed to build HTTP client"),
        }
    }

    /// Override base URL for proxies / compatible local servers (e.g. LM Studio).
    pub fn with_base_url(mut self, base_url: &str) -> Self {
        self.base_url = base_url.trim_end_matches('/').to_string();
        self
    }
}

impl EmbedProvider for OpenAiProvider {
    fn embed_texts(&self, texts: &[&str]) -> Result<Vec<Vec<f32>>, EmbeddingError> {
        let url = format!("{}/v1/embeddings", self.base_url);
        let body = OpenAiEmbedRequest {
            model: &self.model,
            input: texts,
            dimensions: self.requested_dimensions,
        };

        let resp = self
            .client
            .post(&url)
            .bearer_auth(&self.api_key)
            .json(&body)
            .send()
            .map_err(EmbeddingError::Http)?
            .error_for_status()
            .map_err(EmbeddingError::Http)?;

        let parsed: OpenAiEmbedResponse = resp.json().map_err(EmbeddingError::Http)?;
        let vectors: Vec<Vec<f32>> = parsed.data.into_iter().map(|d| d.embedding).collect();
        validate_batch_shape(texts.len(), self.dimension, &vectors)?;
        Ok(vectors)
    }

    fn dimension(&self) -> usize {
        self.dimension
    }
}


fn validate_batch_shape(
    expected_count: usize,
    expected_dimension: usize,
    vectors: &[Vec<f32>],
) -> Result<(), EmbeddingError> {
    if vectors.len() != expected_count {
        return Err(EmbeddingError::Provider(format!(
            "embedding provider returned {} vectors for {expected_count} inputs",
            vectors.len()
        )));
    }
    if let Some(vector) = vectors.iter().find(|vector| vector.len() != expected_dimension) {
        return Err(EmbeddingError::DimensionMismatch {
            expected: expected_dimension,
            actual: vector.len(),
        });
    }
    Ok(())
}

// ── Tests ─────────────────────────────────────────────────────────────────────

/// Stub provider for offline tests — deterministic vectors keyed by text, so
/// vault-op tests can assert that different notes land at different spots.
#[cfg(test)]
pub(crate) struct ConstProvider {
    dim: usize,
    value: f32,
}

#[cfg(test)]
impl ConstProvider {
    pub(crate) fn new(dim: usize, value: f32) -> Self {
        Self { dim, value }
    }
}

#[cfg(test)]
impl EmbedProvider for ConstProvider {
    fn embed_texts(&self, texts: &[&str]) -> Result<Vec<Vec<f32>>, EmbeddingError> {
        Ok(texts.iter().map(|_| vec![self.value; self.dim]).collect())
    }
    fn dimension(&self) -> usize {
        self.dim
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::EmbeddingStore;

    #[test]
    fn provider_round_trip_through_store() {
        let provider = ConstProvider { dim: 4, value: 1.0 };
        let store = EmbeddingStore::open_in_memory(4).unwrap();

        let vecs = provider.embed_texts(&["hello", "world"]).unwrap();
        assert_eq!(vecs.len(), 2);
        assert_eq!(vecs[0].len(), 4);

        store.upsert_embedding("note/a", None, &vecs[0]).unwrap();
        store.upsert_embedding("note/b", None, &vecs[1]).unwrap();

        let query = provider.embed_single("test").unwrap();
        let results = store.query_nearest(&query, 5).unwrap();
        assert_eq!(results.len(), 2);
        // both unit vectors have cosine sim ≈ 1.0 against each other
        assert!((results[0].1 - 1.0).abs() < 1e-5);
    }

    #[test]
    fn single_text_is_one_batch() {
        let provider = ConstProvider { dim: 3, value: 0.5 };
        let result = provider.embed_single("x").unwrap();
        assert_eq!(result.len(), 3);
        assert!((result[0] - 0.5).abs() < 1e-6);
    }
}
