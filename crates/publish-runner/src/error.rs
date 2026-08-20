use thiserror::Error;

use crate::plan::BucketState;

/// Errors that can occur in the publish pipeline.
#[derive(Debug, Error)]
pub enum PublishError {
    #[error("frontmatter gate: note `{path}` is missing `publish: true`")]
    NotOptedIn { path: String },

    #[error("sealed content detected in `{path}`: publish refused")]
    SealedContent { path: String },

    #[error("publish note `{path}` is {size_bytes} bytes; limit is {limit_bytes} bytes")]
    NoteTooLarge {
        path: String,
        size_bytes: u64,
        limit_bytes: u64,
    },

    #[error("reviewed publish plan is stale for `{path}` (planned {planned_hash}, current {current_hash})")]
    StalePlan {
        path: String,
        planned_hash: String,
        current_hash: String,
    },

    #[error("invalid publish selection `{path}`: {reason}")]
    InvalidSelection { path: String, reason: String },

    #[error("duplicate publish selection `{path}`")]
    DuplicateSelection { path: String },

    #[error("unsafe publish output `{output}` relative to vault `{vault}`: roots must not contain one another")]
    UnsafeOutputRoot { vault: String, output: String },

    #[error("publish apply partially completed: {source}")]
    PartialApply {
        #[source]
        source: Box<PublishError>,
        written: Vec<String>,
        deleted: Vec<String>,
        new_state: Box<BucketState>,
    },

    #[error("glob pattern error: {0}")]
    GlobPattern(#[from] globset::Error),

    #[error("I/O error for `{path}`: {source}")]
    Io {
        path: String,
        #[source]
        source: std::io::Error,
    },

    #[error("vault error: {0}")]
    Vault(#[from] scriptor_vault::VaultError),

    #[error("serialisation error: {0}")]
    Json(#[from] serde_json::Error),
}
