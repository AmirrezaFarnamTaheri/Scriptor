use std::time::Duration;

use serde::{Deserialize, Serialize};

pub struct OllamaClient {
    base_url: String,
    model: String,
    client: reqwest::blocking::Client,
}

#[derive(Serialize)]
struct EmbedRequest<'a> {
    model: &'a str,
    input: &'a [&'a str],
}

#[derive(Deserialize)]
struct EmbedResponse {
    embeddings: Vec<Vec<f32>>,
}

impl OllamaClient {
    pub fn new(base_url: &str, model: &str) -> Self {
        Self {
            base_url: base_url.trim_end_matches('/').to_string(),
            model: model.to_string(),
            client: reqwest::blocking::Client::builder()
                .timeout(Duration::from_secs(120))
                .build()
                .expect("failed to build HTTP client"),
        }
    }

    pub fn embed(&self, texts: &[&str]) -> Result<Vec<Vec<f32>>, crate::error::EmbeddingError> {
        let url = format!("{}/api/embed", self.base_url);
        let body = EmbedRequest {
            model: &self.model,
            input: texts,
        };

        self.retry(|| {
            let resp = self
                .client
                .post(&url)
                .json(&body)
                .send()?
                .error_for_status()?;

            let embed_resp: EmbedResponse = resp.json()?;
            Ok(embed_resp.embeddings)
        })
    }

    pub fn embed_single(&self, text: &str) -> Result<Vec<f32>, crate::error::EmbeddingError> {
        let embeddings = self.embed(&[text])?;
        embeddings
            .into_iter()
            .next()
            .ok_or_else(|| crate::error::EmbeddingError::Ollama("empty embedding response".into()))
    }

    fn retry<T, F>(&self, mut op: F) -> Result<T, crate::error::EmbeddingError>
    where
        F: FnMut() -> Result<T, crate::error::EmbeddingError>,
    {
        let max_retries = 2;
        let mut last_err = None;
        for attempt in 0..=max_retries {
            match op() {
                Ok(val) => return Ok(val),
                Err(e) => {
                    if attempt < max_retries {
                        let backoff = Duration::from_millis(500 * 2u64.pow(attempt as u32));
                        std::thread::sleep(backoff);
                    }
                    last_err = Some(e);
                }
            }
        }
        Err(last_err.unwrap_or_else(|| {
            crate::error::EmbeddingError::Ollama("retry exhausted with no error".into())
        }))
    }
}
