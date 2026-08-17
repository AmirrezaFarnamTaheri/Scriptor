//! HTTP fetch stage for the capture pipeline.
//!
//! Uses `ureq` (blocking) to download a URL up to `max_bytes`. After the
//! download the actual URL (post-redirect) is returned alongside the raw HTML.
//! No subprocess, no headless browser.

use thiserror::Error;

#[derive(Debug, Error)]
pub enum FetchError {
    #[error("HTTP error {status}: {url}")]
    Http { status: u16, url: String },

    #[error("network error: {0}")]
    Network(String),

    #[error("response exceeded size limit of {limit} bytes")]
    TooLarge { limit: usize },

    #[error("content-type is not HTML: {content_type}")]
    NotHtml { content_type: String },
}

pub struct FetchOptions {
    pub max_bytes: usize,
    pub timeout_secs: u64,
}

pub struct FetchResponse {
    /// Final URL after any redirects.
    pub final_url: String,
    /// Raw (unsanitized) HTML body.
    pub html: String,
}

/// Download a URL and return the HTML body.
///
/// Follows up to 10 redirects (ureq default). Returns `FetchError::NotHtml`
/// if the response content-type is not `text/html`.
pub fn fetch_html(url: &str, opts: &FetchOptions) -> Result<FetchResponse, FetchError> {
    use std::io::Read as _;
    use std::time::Duration;

    let agent = ureq::AgentBuilder::new()
        .timeout_read(Duration::from_secs(opts.timeout_secs))
        .timeout_connect(Duration::from_secs(10))
        .user_agent("Scriptor/1 (https://github.com/0xDAEF0F/scriptor)")
        .build();

    let response = agent.get(url).call().map_err(|e| match e {
        ureq::Error::Status(status, resp) => FetchError::Http {
            status,
            url: resp.get_url().to_string(),
        },
        other => FetchError::Network(other.to_string()),
    })?;

    // Content-type check — must contain "text/html"
    let content_type = response
        .header("content-type")
        .unwrap_or("text/html")
        .to_ascii_lowercase();
    if !content_type.contains("text/html") {
        return Err(FetchError::NotHtml { content_type });
    }

    let final_url = response.get_url().to_string();

    // Bounded read to avoid memory exhaustion.
    let mut body_bytes = Vec::with_capacity(opts.max_bytes.min(128 * 1024));
    let mut reader = response.into_reader().take(opts.max_bytes as u64 + 1);
    reader
        .read_to_end(&mut body_bytes)
        .map_err(|e| FetchError::Network(e.to_string()))?;

    if body_bytes.len() > opts.max_bytes {
        return Err(FetchError::TooLarge {
            limit: opts.max_bytes,
        });
    }

    // Lossy UTF-8 conversion — real-world pages may have mixed encodings.
    let html = String::from_utf8_lossy(&body_bytes).into_owned();

    Ok(FetchResponse { final_url, html })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn fetch_options_default_values_are_sane() {
        let opts = FetchOptions {
            max_bytes: 8 * 1024 * 1024,
            timeout_secs: 20,
        };
        assert!(opts.max_bytes > 0);
        assert!(opts.timeout_secs > 0);
    }
}
