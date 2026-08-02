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
    #[error("external process policy rejected operation: {message}")]
    ProcessPolicy { message: String },
    #[error("failed to spawn external process {program}: {source}")]
    ProcessSpawn {
        program: PathBuf,
        source: std::io::Error,
    },
    #[error("failed while waiting for external process {program}: {source}")]
    ProcessWait {
        program: PathBuf,
        source: std::io::Error,
    },
    #[error("failed while reading external process output: {source}")]
    ProcessRead { source: std::io::Error },
    #[error("external process {program} timed out after {timeout_ms}ms: {stderr}")]
    ProcessTimeout {
        program: PathBuf,
        timeout_ms: u64,
        stdout: String,
        stderr: String,
    },
}
