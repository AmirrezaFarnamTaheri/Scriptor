use std::fs;
use std::io::Read;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};

use crate::error::VaultError;
use crate::fs::{atomic_write, lock_vault_update};
use crate::path::{RelativeVaultPath, VaultRoot};

pub const DEFAULT_STATS_HISTORY_PATH: &str = ".scriptor/stats-history.json";
const MAX_HISTORY_BYTES: u64 = 65_536;
const MAX_HISTORY_ROWS: usize = 1000;

fn validate_entry(entry: &StatsHistoryEntry) -> Result<(), VaultError> {
    let date = entry.date.as_bytes();
    if date.len() != 10
        || date[4] != b'-'
        || date[7] != b'-'
        || !date
            .iter()
            .enumerate()
            .all(|(index, byte)| index == 4 || index == 7 || byte.is_ascii_digit())
        || chrono::NaiveDate::parse_from_str(&entry.date, "%Y-%m-%d").is_err()
    {
        return Err(VaultError::InvalidConfig {
            message: "Stats history requires a valid YYYY-MM-DD calendar date".into(),
        });
    }
    Ok(())
}

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
    let raw = relative.as_str();
    let (parent, file_name) = raw
        .rsplit_once('/')
        .map_or((".", raw), |(parent, file_name)| (parent, file_name));
    let parent = if parent == "." {
        root.root().to_path_buf()
    } else {
        root.resolve_relative(&RelativeVaultPath::parse(parent)?)?
    };
    let absolute = parent.join(file_name);
    reject_symlink_target(&absolute, &relative)?;
    Ok(absolute)
}

fn reject_symlink_target(path: &Path, relative: &RelativeVaultPath) -> Result<(), VaultError> {
    let metadata = match fs::symlink_metadata(path) {
        Ok(metadata) => metadata,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(()),
        Err(error) => return Err(VaultError::io(path, error)),
    };
    if metadata.file_type().is_symlink() {
        return Err(VaultError::SymlinkEscape(relative.to_string()));
    }
    Ok(())
}

pub fn read_stats_history(
    root: &VaultRoot,
    relative_path: &str,
) -> Result<Vec<StatsHistoryEntry>, VaultError> {
    let absolute = resolve_history_path(root, relative_path)?;
    read_stats_history_at(&absolute)
}

fn read_stats_history_at(absolute: &std::path::Path) -> Result<Vec<StatsHistoryEntry>, VaultError> {
    let file = match fs::File::open(absolute) {
        Ok(file) => file,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(Vec::new()),
        Err(error) => return Err(VaultError::io(absolute, error)),
    };
    if !file
        .metadata()
        .map_err(|source| VaultError::io(absolute, source))?
        .is_file()
    {
        return Err(VaultError::InvalidConfig {
            message: "Stats history must be a regular file".into(),
        });
    }
    let mut raw = Vec::new();
    file.take(MAX_HISTORY_BYTES + 1)
        .read_to_end(&mut raw)
        .map_err(|source| VaultError::io(absolute, source))?;
    if raw.len() as u64 > MAX_HISTORY_BYTES {
        return Err(VaultError::InvalidConfig {
            message: "Stats history exceeds 64 KiB".into(),
        });
    }
    let history: Vec<StatsHistoryEntry> = serde_json::from_slice(&raw)?;
    if history.len() > MAX_HISTORY_ROWS {
        return Err(VaultError::InvalidConfig {
            message: "Stats history exceeds its row bound".into(),
        });
    }
    for entry in &history {
        validate_entry(entry)?;
    }
    Ok(history)
}

pub fn append_stats_history(
    root: &VaultRoot,
    relative_path: &str,
    entry: StatsHistoryEntry,
) -> Result<Vec<StatsHistoryEntry>, VaultError> {
    validate_entry(&entry)?;
    let absolute = resolve_history_path(root, relative_path)?;
    // Atomic replacement prevents torn JSON; this sidecar advisory lock also
    // serializes independent desktop and daemon processes that would otherwise
    // read the same history and overwrite one another's increments.
    let _update_lock = lock_vault_update(&absolute)?;
    let absolute = resolve_history_path(root, relative_path)?;
    let mut history = read_stats_history_at(&absolute)?;
    if let Some(existing) = history.iter_mut().find(|row| row.date == entry.date) {
        existing.words = existing.words.saturating_add(entry.words);
    } else {
        history.push(entry);
    }
    history.sort_by(|left, right| left.date.cmp(&right.date));
    if history.len() > 90 {
        history = history.split_off(history.len().saturating_sub(90));
    }
    write_stats_history_at(&absolute, &history)?;
    Ok(history)
}

fn write_stats_history_at(
    absolute: &std::path::Path,
    history: &[StatsHistoryEntry],
) -> Result<(), VaultError> {
    if let Some(parent) = absolute.parent() {
        fs::create_dir_all(parent).map_err(|source| VaultError::io(parent, source))?;
    }
    let payload = serde_json::to_string_pretty(history).map_err(VaultError::from)?;
    atomic_write(absolute, payload.as_bytes())
}

#[cfg(test)]
mod tests {
    use std::sync::{Arc, Barrier};
    use std::thread;

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
    fn rejects_oversized_history_without_replacing_it() {
        let dir = tempdir().unwrap();
        let root = VaultRoot::open(dir.path()).unwrap();
        let path = dir.path().join("history.json");
        let original = format!("[]{}", " ".repeat(65_537));
        fs::write(&path, &original).unwrap();
        assert!(read_stats_history(&root, "history.json").is_err());
        assert!(
            append_stats_history(
                &root,
                "history.json",
                StatsHistoryEntry {
                    date: "2026-10-01".into(),
                    words: 1,
                }
            )
            .is_err()
        );
        assert_eq!(fs::read_to_string(path).unwrap(), original);
    }

    #[test]
    fn rejects_invalid_calendar_dates() {
        let dir = tempdir().unwrap();
        let root = VaultRoot::open(dir.path()).unwrap();
        for date in ["2026-02-30", "not-a-date", "2026-1-1", "2026-10-01\n"] {
            assert!(
                append_stats_history(
                    &root,
                    "history.json",
                    StatsHistoryEntry {
                        date: date.into(),
                        words: 1,
                    }
                )
                .is_err()
            );
        }
        assert!(!dir.path().join("history.json").exists());
    }

    #[test]
    fn rejects_traversal_in_configured_history_path() {
        let dir = tempdir().unwrap();
        let outside = tempdir().unwrap();
        let root = VaultRoot::open(dir.path()).unwrap();
        let victim = outside.path().join("victim.txt");
        std::fs::write(&victim, "do not clobber").unwrap();

        for hostile in [
            "../victim.txt",
            "../../etc/passwd",
            "/etc/passwd",
            "a/../../b",
        ] {
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

    #[test]
    fn concurrent_appends_preserve_every_increment() {
        let dir = tempdir().unwrap();
        let root = VaultRoot::open(dir.path()).unwrap();
        let barrier = Arc::new(Barrier::new(3));
        let mut workers = Vec::new();

        for _ in 0..2 {
            let root = root.clone();
            let barrier = Arc::clone(&barrier);
            workers.push(thread::spawn(move || {
                barrier.wait();
                for _ in 0..25 {
                    append_stats_history(
                        &root,
                        DEFAULT_STATS_HISTORY_PATH,
                        StatsHistoryEntry {
                            date: "2026-07-26".into(),
                            words: 1,
                        },
                    )
                    .unwrap();
                }
            }));
        }

        barrier.wait();
        for worker in workers {
            worker.join().unwrap();
        }

        let history = read_stats_history(&root, DEFAULT_STATS_HISTORY_PATH).unwrap();
        assert_eq!(
            history,
            vec![StatsHistoryEntry {
                date: "2026-07-26".into(),
                words: 50,
            }]
        );
    }
}
