use std::fs;
use std::path::Path;

use serde::{Deserialize, Serialize};

use crate::error::VaultError;
use crate::path::VaultRoot;

pub const DEFAULT_STATS_HISTORY_PATH: &str = ".scriptor/stats-history.json";

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct StatsHistoryEntry {
    pub date: String,
    pub words: u32,
}

pub fn read_stats_history(root: &VaultRoot, relative_path: &str) -> Result<Vec<StatsHistoryEntry>, VaultError> {
    let absolute = root.root().join(relative_path.replace('/', std::path::MAIN_SEPARATOR_STR));
    if !absolute.exists() {
        return Ok(Vec::new());
    }
    let raw = fs::read_to_string(&absolute).map_err(|source| VaultError::io(&absolute, source))?;
    serde_json::from_str(&raw).map_err(VaultError::from)
}

pub fn append_stats_history(
    root: &VaultRoot,
    relative_path: &str,
    entry: StatsHistoryEntry,
) -> Result<Vec<StatsHistoryEntry>, VaultError> {
    let mut history = read_stats_history(root, relative_path)?;
    if let Some(existing) = history.iter_mut().find(|row| row.date == entry.date) {
        existing.words = existing.words.saturating_add(entry.words);
    } else {
        history.push(entry);
    }
    history.sort_by(|left, right| left.date.cmp(&right.date));
    if history.len() > 90 {
        history = history.split_off(history.len().saturating_sub(90));
    }
    write_stats_history(root, relative_path, &history)?;
    Ok(history)
}

fn write_stats_history(
    root: &VaultRoot,
    relative_path: &str,
    history: &[StatsHistoryEntry],
) -> Result<(), VaultError> {
    let absolute = root.root().join(relative_path.replace('/', std::path::MAIN_SEPARATOR_STR));
    if let Some(parent) = absolute.parent() {
        fs::create_dir_all(parent).map_err(|source| VaultError::io(parent, source))?;
    }
    let payload = serde_json::to_string_pretty(history).map_err(VaultError::from)?;
    atomic_write(&absolute, payload.as_bytes())
}

fn atomic_write(path: &Path, bytes: &[u8]) -> Result<(), VaultError> {
    let parent = path.parent().ok_or_else(|| VaultError::InvalidRelativePath(path.display().to_string()))?;
    let temp = parent.join(format!(".{}.tmp", uuid::Uuid::new_v4()));
    fs::write(&temp, bytes).map_err(|source| VaultError::io(&temp, source))?;
    fs::rename(&temp, path).map_err(|source| VaultError::io(path, source))
}
