use thiserror::Error;

/// Errors that can occur in the publish pipeline.
#[derive(Debug, Error)]
pub enum PublishError {
    #[error("frontmatter gate: note `{path}` is missing `publish: true`")]
    NotOptedIn { path: String },

    #[error("sealed content detected in `{path}`: export refused without --redact-secrets")]
    SealedContent { path: String },

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
