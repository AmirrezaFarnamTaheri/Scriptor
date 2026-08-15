use std::fs::{self, OpenOptions};
use std::io::Write;

use serde::{Deserialize, Serialize};

use crate::error::VaultError;
use crate::path::VaultRoot;

pub const DEFAULT_ACTIVITY_LOG_PATH: &str = ".scriptor/diagnostics/activity.jsonl";
const MAX_READ_LINES: usize = 200;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ActivityLogEntry {
    pub id: String,
    pub ts: i64,
    pub kind: String,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub detail: Option<String>,
}

pub fn read_activity_log(
    root: &VaultRoot,
    limit: usize,
) -> Result<Vec<ActivityLogEntry>, VaultError> {
    let absolute = root.root().join(DEFAULT_ACTIVITY_LOG_PATH);
    if !absolute.exists() {
        return Ok(Vec::new());
    }
    let raw = fs::read_to_string(&absolute).map_err(|source| VaultError::io(&absolute, source))?;
    let mut entries = Vec::new();
    for line in raw.lines().filter(|line| !line.trim().is_empty()) {
        if let Ok(entry) = serde_json::from_str::<ActivityLogEntry>(line) {
            entries.push(entry);
        }
    }
    let capped = limit.min(MAX_READ_LINES);
    if entries.len() > capped {
        entries = entries.split_off(entries.len().saturating_sub(capped));
    }
    entries.reverse();
    Ok(entries)
}

pub fn append_activity_log(root: &VaultRoot, entry: ActivityLogEntry) -> Result<(), VaultError> {
    let absolute = root.root().join(DEFAULT_ACTIVITY_LOG_PATH);
    if let Some(parent) = absolute.parent() {
        fs::create_dir_all(parent).map_err(|source| VaultError::io(parent, source))?;
    }
    let line = serde_json::to_string(&entry).map_err(VaultError::from)?;
    let mut file = OpenOptions::new()
        .create(true)
        .append(true)
        .open(&absolute)
        .map_err(|source| VaultError::io(&absolute, source))?;
    writeln!(file, "{line}").map_err(|source| VaultError::io(&absolute, source))?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn append_and_read_activity_log_roundtrip() {
        let dir = std::env::temp_dir().join(format!("scriptor-activity-{}", uuid::Uuid::new_v4()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).expect("temp dir");
        let root = VaultRoot::open(&dir).expect("vault root");

        append_activity_log(
            &root,
            ActivityLogEntry {
                id: "1".into(),
                ts: 1,
                kind: "info".into(),
                message: "Opened vault".into(),
                detail: None,
            },
        )
        .expect("append");

        let entries = read_activity_log(&root, 10).expect("read");
        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].message, "Opened vault");

        let _ = fs::remove_dir_all(&dir);
    }
}
