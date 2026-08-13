//! Error types for the `scriptor-annotations` crate.

use thiserror::Error;

/// Errors produced by annotation operations.
#[derive(Debug, Error)]
pub enum AnnotationError {
    /// The stored byte range is out of bounds for the given body.
    #[error("byte range {start}..{end} is out of bounds for body of {body_len} bytes")]
    RangeOutOfBounds {
        start: usize,
        end: usize,
        body_len: usize,
    },

    /// The stored byte range does not fall on a UTF-8 character boundary.
    #[error("byte range {start}..{end} does not align to UTF-8 character boundaries")]
    NotCharBoundary { start: usize, end: usize },

    /// JSON serialisation or deserialisation failed.
    #[error("serde_json error: {0}")]
    Json(#[from] serde_json::Error),
}
