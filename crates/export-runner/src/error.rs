use std::path::PathBuf;

use thiserror::Error;

#[derive(Debug, Error)]
pub enum ExportError {
    #[error("pandoc was not found on PATH")]
    PandocMissing,
    #[error("unsupported export format: {0}")]
    UnsupportedFormat(String),
    #[error("export output path is invalid: {0}")]
    InvalidOutput(PathBuf),
    #[error("disallowed pandoc argument: {0}")]
    DisallowedArg(String),
    #[error("process error: {0}")]
    Process(String),
    #[error("export cancelled")]
    Cancelled,
    #[error("invalid export artifact: {0}")]
    InvalidArtifact(String),
    #[error("io error at {path}: {source}")]
    Io {
        path: PathBuf,
        #[source]
        source: std::io::Error,
    },
}
