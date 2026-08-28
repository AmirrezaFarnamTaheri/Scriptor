use std::fs;

use serde::{Deserialize, Serialize};

use crate::error::VaultError;
use crate::fs::{atomic_write, lock_vault_update};
use crate::path::VaultRoot;

const RECENT_PATH: &str = ".scriptor/recent.json";
const MAX_RECENT: usize = 50;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct RecentNoteEntry {
    pub path: String,
    pub opened_at: String,
}

pub fn list_recent_notes(
    root: &VaultRoot,
    limit: usize,
) -> Result<Vec<RecentNoteEntry>, VaultError> {
    let entries = read_recent_file(root)?;
    let capped = limit.min(MAX_RECENT);
    Ok(entries.into_iter().take(capped).collect())
}

pub fn record_recent_note(
    root: &VaultRoot,
    path: &str,
) -> Result<Vec<RecentNoteEntry>, VaultError> {
    let absolute = root.root().join(RECENT_PATH);
    // Keep the advisory lock while reading and replacing the file. Atomic
    // replacement alone cannot keep a daemon write from erasing a desktop
    // update that completed after this caller's read.
    let _update_lock = lock_vault_update(&absolute)?;
    let mut entries = read_recent_file_at(&absolute)?;
    entries.retain(|entry| entry.path != path);
    entries.insert(
        0,
        RecentNoteEntry {
            path: path.to_string(),
            opened_at: chrono::Utc::now().to_rfc3339(),
        },
    );
    entries.truncate(MAX_RECENT);
    write_recent_file_at(&absolute, &entries)?;
    Ok(entries)
}

fn read_recent_file(root: &VaultRoot) -> Result<Vec<RecentNoteEntry>, VaultError> {
    let absolute = root.root().join(RECENT_PATH);
    read_recent_file_at(&absolute)
}

fn read_recent_file_at(absolute: &std::path::Path) -> Result<Vec<RecentNoteEntry>, VaultError> {
    if !absolute.exists() {
        return Ok(Vec::new());
    }
    let raw = fs::read_to_string(absolute).map_err(|source| VaultError::io(absolute, source))?;
    serde_json::from_str(&raw).map_err(VaultError::from)
}

fn write_recent_file_at(
    absolute: &std::path::Path,
    entries: &[RecentNoteEntry],
) -> Result<(), VaultError> {
    if let Some(parent) = absolute.parent() {
        fs::create_dir_all(parent).map_err(|source| VaultError::io(parent, source))?;
    }
    let payload = serde_json::to_string_pretty(entries).map_err(VaultError::from)?;
    atomic_write(absolute, payload.as_bytes())
}

#[cfg(test)]
mod tests {
    use std::sync::{Arc, Barrier};
    use std::thread;

    use super::*;
    use tempfile::tempdir;

    #[test]
    fn concurrent_records_preserve_both_notes() {
        let dir = tempdir().unwrap();
        let root = VaultRoot::open(dir.path()).unwrap();
        let barrier = Arc::new(Barrier::new(3));
        let mut workers = Vec::new();

        for path in ["alpha.md", "beta.md"] {
            let root = root.clone();
            let barrier = Arc::clone(&barrier);
            workers.push(thread::spawn(move || {
                barrier.wait();
                record_recent_note(&root, path).unwrap();
            }));
        }

        barrier.wait();
        for worker in workers {
            worker.join().unwrap();
        }

        let recent = list_recent_notes(&root, 10).unwrap();
        assert_eq!(recent.len(), 2);
        assert!(recent.iter().any(|entry| entry.path == "alpha.md"));
        assert!(recent.iter().any(|entry| entry.path == "beta.md"));
    }
}
