use std::fs;
use std::path::PathBuf;

use serde::{Deserialize, Serialize};

use crate::error::VaultError;
use crate::fs::atomic_write;
use crate::path::{RelativeVaultPath, VaultRoot};

pub const DEFAULT_STATS_HISTORY_PATH: &str = ".scriptor/stats-history.json";

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct StatsHistoryEntry {
    pub date: String,
    pub words: u32,
}

/// Resolves the configured history path against the vault root.
///
/// `history_path` comes straight out of the on-disk vault config, which is
/// attacker-controlled for any vault cloned from an untrusted source. Joining it
/// to the root unchecked let `../../../.bashrc` be overwritten with JSON on the
/// first word-count update, so it goes through the same validation as every
/// other vault-relative path.
fn resolve_history_path(root: &VaultRoot, relative_path: &str) -> Result<PathBuf, VaultError> {
    let relative = RelativeVaultPath::parse(relative_path)?;
    root.resolve_relative(&relative)
}

pub fn read_stats_history(root: &VaultRoot, relative_path: &str) -> Result<Vec<StatsHistoryEntry>, VaultError> {
    let absolute = resolve_history_path(root, relative_path)?;
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
    let absolute = resolve_history_path(root, relative_path)?;
    if let Some(parent) = absolute.parent() {
        fs::create_dir_all(parent).map_err(|source| VaultError::io(parent, source))?;
    }
    let payload = serde_json::to_string_pretty(history).map_err(VaultError::from)?;
    atomic_write(&absolute, payload.as_bytes())
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn round_trips_history_under_the_default_path() {
        let dir = tempdir().unwrap();
        let root = VaultRoot::open(dir.path()).unwrap();
        let entry = StatsHistoryEntry {
            date: "2026-07-26".into(),
            words: 120,
        };
        let history = append_stats_history(&root, DEFAULT_STATS_HISTORY_PATH, entry).unwrap();
        assert_eq!(history.len(), 1);
        assert_eq!(history[0].words, 120);
        assert_eq!(
            read_stats_history(&root, DEFAULT_STATS_HISTORY_PATH).unwrap(),
            history
        );
    }

    #[test]
    fn rejects_traversal_in_configured_history_path() {
        let dir = tempdir().unwrap();
        let outside = tempdir().unwrap();
        let root = VaultRoot::open(dir.path()).unwrap();
        let victim = outside.path().join("victim.txt");
        std::fs::write(&victim, "do not clobber").unwrap();

        for hostile in ["../victim.txt", "../../etc/passwd", "/etc/passwd", "a/../../b"] {
            let entry = StatsHistoryEntry {
                date: "2026-07-26".into(),
                words: 1,
            };
            assert!(
                append_stats_history(&root, hostile, entry).is_err(),
                "expected {hostile} to be rejected"
            );
            assert!(read_stats_history(&root, hostile).is_err());
        }

        assert_eq!(std::fs::read_to_string(&victim).unwrap(), "do not clobber");
    }
}
