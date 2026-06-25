use std::path::PathBuf;

use thiserror::Error;

#[derive(Debug, Error)]
pub enum CanvasError {
    #[error("canvas document is invalid: {0}")]
    InvalidDocument(String),
    #[error("unknown canvas template: {0}")]
    UnknownTemplate(String),
    #[error("unsupported snapshot format: {0}")]
    UnsupportedSnapshotFormat(String),
    #[error("failed to read canvas file {path}: {source}")]
    IoRead {
        path: PathBuf,
        source: std::io::Error,
    },
    #[error("failed to write snapshot {path}: {source}")]
    IoWrite {
        path: PathBuf,
        source: std::io::Error,
    },
    #[error("snapshot export failed: {0}")]
    ExportFailed(String),
}
