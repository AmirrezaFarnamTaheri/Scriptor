//! `scriptor-capture` — fetch → sanitize → extract → markdown pipeline.
//!
//! Design (D2, W3-4):
//! * Pure Rust. No subprocess, no headless browser, no Node.
//! * Gated at call-site by `SensitiveOperation::WebClip` (F-4).
//! * Runs outside the renderer process (spawned from the Tauri command layer).
//! * One public entry point: [`capture_url`].

mod extract;
mod fetch;
mod to_markdown;

pub use extract::{ExtractedContent, ExtractionError};
pub use fetch::{FetchError, FetchOptions};
pub use to_markdown::to_markdown;

use thiserror::Error;

/// Unified error type for the capture pipeline.
#[derive(Debug, Error)]
pub enum CaptureError {
    #[error("fetch failed: {0}")]
    Fetch(#[from] FetchError),

    #[error("extraction failed: {0}")]
    Extract(#[from] ExtractionError),

    #[error("markdown conversion failed: {0}")]
    Markdown(String),
}

/// Options forwarded to [`capture_url`].
#[derive(Debug, Clone)]
pub struct CaptureOptions {
    /// Maximum bytes to download. Defaults to 8 MiB.
    pub max_bytes: usize,
    /// Request timeout in seconds. Defaults to 20.
    pub timeout_secs: u64,
    /// Whether to include tables in the markdown output.
    pub include_tables: bool,
    /// Whether to include math blocks (`$…$` / `$$…$$`).
    pub include_math: bool,
}

impl Default for CaptureOptions {
    fn default() -> Self {
        Self {
            max_bytes: 8 * 1024 * 1024,
            timeout_secs: 20,
            include_tables: true,
            include_math: true,
        }
    }
}

/// Result of a successful capture.
#[derive(Debug, serde::Serialize, serde::Deserialize)]
pub struct CaptureResult {
    /// Canonical URL (after redirects).
    pub url: String,
    /// Extracted page title.
    pub title: String,
    /// Site name from `og:site_name`, if present.
    pub site_name: Option<String>,
    /// ISO-8601 publication date from `article:published_time` or `<time>`, if present.
    pub published_at: Option<String>,
    /// Full markdown body ready to be written through `vault/src/fs.rs`.
    pub markdown: String,
    /// Word count of the extracted body (pre-markdown).
    pub word_count: usize,
}

/// Capture a URL end-to-end: fetch → sanitize → extract → markdown.
///
/// This function blocks on network I/O and is intended to be called from a
/// `tokio::task::spawn_blocking` context.
///
/// # Errors
///
/// Returns [`CaptureError`] if any pipeline stage fails.
pub fn capture_url(raw_url: &str, opts: CaptureOptions) -> Result<CaptureResult, CaptureError> {
    // 1. Fetch
    let fetch_opts = FetchOptions {
        max_bytes: opts.max_bytes,
        timeout_secs: opts.timeout_secs,
    };
    let response = fetch::fetch_html(raw_url, &fetch_opts)?;

    // 2. Sanitize (ammonia) + extract (readability-style)
    let extracted = extract::extract_content(&response.html, &response.final_url)?;

    // 3. Convert to Markdown
    let md = to_markdown::convert(&extracted.body_html, opts.include_tables, opts.include_math)
        .map_err(|e| CaptureError::Markdown(e.to_string()))?;

    let word_count = extracted.body_html.split_whitespace().count();

    Ok(CaptureResult {
        url: response.final_url,
        title: extracted.title,
        site_name: extracted.site_name,
        published_at: extracted.published_at,
        markdown: md,
        word_count,
    })
}
