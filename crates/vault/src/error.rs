use std::path::PathBuf;

use thiserror::Error;

#[derive(Debug, Error)]
pub enum VaultError {
    #[error("vault path does not exist: {0}")]
    RootMissing(PathBuf),
    #[error("vault path is not a directory: {0}")]
    RootNotDirectory(PathBuf),
    #[error("invalid relative path: {0}")]
    InvalidRelativePath(String),
    #[error("path escapes vault root: {0}")]
    PathEscape(String),
    #[error("symlink escapes vault root: {0}")]
    SymlinkEscape(String),
    #[error("note not found: {0}")]
    NoteNotFound(String),
    #[error("note already exists: {0}")]
    NoteExists(String),
    #[error("content hash mismatch for {path}; expected {expected}, found {found}")]
    HashMismatch {
        path: String,
        expected: String,
        found: String,
    },
    #[error("rename would affect no files")]
    RenameNoop,
    #[error("io error at {path}: {source}")]
    Io {
        path: PathBuf,
        #[source]
        source: std::io::Error,
    },
    #[error("json error: {0}")]
    Json(#[from] serde_json::Error),
    #[error("invalid vault config: {message}")]
    InvalidConfig { message: String },
}

impl VaultError {
    pub fn io(path: impl Into<PathBuf>, source: std::io::Error) -> Self {
        Self::Io {
            path: path.into(),
            source,
        }
    }
}
