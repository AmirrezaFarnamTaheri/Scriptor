use std::fs;

use serde::{Deserialize, Serialize};

use crate::error::VaultError;
use crate::path::{RelativeVaultPath, VaultRoot};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct DeleteNoteOutput {
    pub path: String,
    pub deleted: bool,
}

pub fn delete_note(root: &VaultRoot, path: &RelativeVaultPath) -> Result<DeleteNoteOutput, VaultError> {
    let absolute = root.resolve_relative(path)?;
    if !absolute.is_file() {
        return Err(VaultError::NoteNotFound(path.to_string()));
    }
    fs::remove_file(&absolute).map_err(|source| VaultError::io(&absolute, source))?;
    Ok(DeleteNoteOutput {
        path: path.to_string(),
        deleted: true,
    })
}
