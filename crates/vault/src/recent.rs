use std::fs;

use serde::{Deserialize, Serialize};

use crate::error::VaultError;
use crate::path::VaultRoot;

const RECENT_PATH: &str = ".scriptor/recent.json";
const MAX_RECENT: usize = 50;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct RecentNoteEntry {
    pub path: String,
    pub opened_at: String,
}

pub fn list_recent_notes(root: &VaultRoot, limit: usize) -> Result<Vec<RecentNoteEntry>, VaultError> {
    let entries = read_recent_file(root)?;
    let capped = limit.min(MAX_RECENT);
    Ok(entries.into_iter().take(capped).collect())
}

pub fn record_recent_note(root: &VaultRoot, path: &str) -> Result<Vec<RecentNoteEntry>, VaultError> {
    let mut entries = read_recent_file(root)?;
    entries.retain(|entry| entry.path != path);
    entries.insert(
        0,
        RecentNoteEntry {
            path: path.to_string(),
            opened_at: chrono::Utc::now().to_rfc3339(),
        },
    );
    entries.truncate(MAX_RECENT);
    write_recent_file(root, &entries)?;
    Ok(entries)
}

fn read_recent_file(root: &VaultRoot) -> Result<Vec<RecentNoteEntry>, VaultError> {
    let absolute = root.root().join(RECENT_PATH);
    if !absolute.exists() {
        return Ok(Vec::new());
    }
    let raw = fs::read_to_string(&absolute).map_err(|source| VaultError::io(&absolute, source))?;
    serde_json::from_str(&raw).map_err(VaultError::from)
}

fn write_recent_file(root: &VaultRoot, entries: &[RecentNoteEntry]) -> Result<(), VaultError> {
    let absolute = root.root().join(RECENT_PATH);
    if let Some(parent) = absolute.parent() {
        fs::create_dir_all(parent).map_err(|source| VaultError::io(parent, source))?;
    }
    let payload = serde_json::to_string_pretty(entries).map_err(VaultError::from)?;
    fs::write(&absolute, payload).map_err(|source| VaultError::io(&absolute, source))
}
