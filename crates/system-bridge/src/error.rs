use std::path::PathBuf;

use thiserror::Error;

#[derive(Debug, Error)]
pub enum BridgeError {
    #[error("unsupported platform operation: {0}")]
    Unsupported(String),
    #[error("failed to resolve path {path}: {source}")]
    Io {
        path: PathBuf,
        source: std::io::Error,
    },
    #[error("keychain error: {message}")]
    Keychain { message: String },
}
