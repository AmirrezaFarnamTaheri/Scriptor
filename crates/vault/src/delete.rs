use std::fs;

use serde::{Deserialize, Serialize};

use crate::error::VaultError;
use crate::hash::content_hash_bytes;
use crate::path::{RelativeVaultPath, VaultRoot};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct DeleteNoteOutput {
    pub path: String,
    pub deleted: bool,
}

pub fn delete_note(
    root: &VaultRoot,
    path: &RelativeVaultPath,
) -> Result<DeleteNoteOutput, VaultError> {
    delete_note_guarded(root, path, None)
}

pub fn delete_note_guarded(
    root: &VaultRoot,
    path: &RelativeVaultPath,
    expected_content_hash: Option<&str>,
) -> Result<DeleteNoteOutput, VaultError> {
    let absolute = root.resolve_relative(path)?;
    if !absolute.is_file() {
        return Err(VaultError::NoteNotFound(path.to_string()));
    }
    if let Some(expected) = expected_content_hash {
        let bytes = fs::read(&absolute).map_err(|source| VaultError::io(&absolute, source))?;
        let found = content_hash_bytes(&bytes);
        if found != expected {
            return Err(VaultError::HashMismatch {
                path: path.to_string(),
                expected: expected.to_string(),
                found,
            });
        }
    }
    fs::remove_file(&absolute).map_err(|source| VaultError::io(&absolute, source))?;
    Ok(DeleteNoteOutput {
        path: path.to_string(),
        deleted: true,
    })
}
