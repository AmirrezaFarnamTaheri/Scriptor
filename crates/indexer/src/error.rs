use thiserror::Error;

#[derive(Debug, Error)]
pub enum IndexerError {
    #[error(transparent)]
    Vault(#[from] scriptor_vault::VaultError),
    #[error("database error: {0}")]
    Database(#[from] rusqlite::Error),
    #[error("cache path is not writable: {0}")]
    CachePath(String),
    #[error("json error: {0}")]
    Json(#[from] serde_json::Error),
    #[error("io error at {path}: {source}")]
    Io {
        path: std::path::PathBuf,
        #[source]
        source: std::io::Error,
    },
    #[error("invalid DQL query: {0}")]
    InvalidQuery(String),
    #[error("cache schema version {found} requires rebuild (expected {expected})")]
    SchemaRebuildRequired { found: i32, expected: i32 },
}
