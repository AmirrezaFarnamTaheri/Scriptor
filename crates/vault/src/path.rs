use std::io::ErrorKind;
use std::path::{Component, Path, PathBuf};

use crate::error::VaultError;

#[derive(Debug, Clone, PartialEq, Eq, Hash, serde::Serialize, serde::Deserialize)]
#[serde(transparent)]
pub struct RelativeVaultPath(String);

impl RelativeVaultPath {
    pub fn parse(raw: &str) -> Result<Self, VaultError> {
        let normalized = normalize_relative(raw)?;
        Ok(Self(normalized))
    }