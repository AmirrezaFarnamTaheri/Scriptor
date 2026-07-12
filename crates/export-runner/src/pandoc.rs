use std::path::{Path, PathBuf};
use std::process::Command;

use serde::{Deserialize, Serialize};

use crate::error::ExportError;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct PandocDiscovery {
    pub path: String,
    pub version: String,
    pub sha256: Option<String>,
}

/// Compute the SHA-256 hash of a file at the given path, returning a