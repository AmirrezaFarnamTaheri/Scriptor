use std::fs::{self, OpenOptions};
use std::io::{Read, Seek, SeekFrom, Write};

use serde::{Deserialize, Serialize};

use crate::error::VaultError;
use crate::path::{RelativeVaultPath, VaultRoot};

pub const DEFAULT_ACTIVITY_LOG_PATH: &str = ".scriptor/diagnostics/activity.jsonl";
const MAX_READ_LINES: usize = 200;
const MAX_LOG_BYTES: u64 = 1024 * 1024;
const MAX_TAIL_BYTES: u64 = 256 * 1024;
const MAX_ENTRY_BYTES: usize = 16 * 1024;

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
    let absolute = root.resolve_relative(&RelativeVaultPath::parse(DEFAULT_ACTIVITY_LOG_PATH)?)?;
    let capped = limit.min(MAX_READ_LINES);
    if capped == 0 {
        return Ok(Vec::new());
    }
    if !absolute.exists() {
        return Ok(Vec::new());
    }
    let mut file = fs::File::open(&absolute).map_err(|source| VaultError::io(&absolute, source))?;
    let size = file
        .metadata()
        .map_err(|source| VaultError::io(&absolute, source))?
        .len();
    let offset = size.saturating_sub(MAX_TAIL_BYTES);
    file.seek(SeekFrom::Start(offset))
        .map_err(|source| VaultError::io(&absolute, source))?;
    let mut raw = Vec::new();
    file.take(MAX_TAIL_BYTES)
        .read_to_end(&mut raw)
        .map_err(|source| VaultError::io(&absolute, source))?;
    // An arbitrary seek may land inside UTF-8 or a JSON record. Skip that
    // partial record and parse complete lines independently.
    let start = if offset > 0 {
        raw.iter()
            .position(|byte| *byte == b'\n')
            .map_or(raw.len(), |index| index + 1)
    } else {
        0
    };
    let mut entries = Vec::new();
    for line in raw[start..].split(|byte| *byte == b'\n').rev() {
        if line.len() > MAX_ENTRY_BYTES {
            continue;
        }
        if let Ok(entry) = serde_json::from_slice::<ActivityLogEntry>(line) {
            entries.push(entry);
            if entries.len() == capped {
                break;
            }
        }
    }
    Ok(entries)
}

pub fn append_activity_log(root: &VaultRoot, entry: ActivityLogEntry) -> Result<(), VaultError> {
    let absolute = root.resolve_relative(&RelativeVaultPath::parse(DEFAULT_ACTIVITY_LOG_PATH)?)?;
    let line = serde_json::to_string(&entry).map_err(VaultError::from)?;
    if line.len() > MAX_ENTRY_BYTES {
        return Err(VaultError::InvalidConfig {
            message: "Activity entry exceeds 16 KiB".into(),
        });
    }
    let _lock = crate::fs::lock_vault_update(&absolute)?;
    if let Some(parent) = absolute.parent() {
        fs::create_dir_all(parent).map_err(|source| VaultError::io(parent, source))?;
    }
    match fs::metadata(&absolute) {
        Ok(metadata) if metadata.len() + line.len() as u64 + 1 > MAX_LOG_BYTES => {
            let entries = read_activity_log(root, MAX_READ_LINES)?;
            let mut compacted = Vec::new();
            for retained in entries.iter().rev() {
                serde_json::to_writer(&mut compacted, retained).map_err(VaultError::from)?;
                compacted.push(b'\n');
            }
            crate::fs::atomic_write(&absolute, &compacted)?;
        }
        Ok(_) => {}
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {}
        Err(error) => return Err(VaultError::io(&absolute, error)),
    }
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
    fn oversized_activity_history_is_compacted_before_append() {
        let dir = std::env::temp_dir().join(format!("scriptor-activity-{}", uuid::Uuid::new_v4()));
        fs::create_dir_all(&dir).expect("temp dir");
        let root = VaultRoot::open(&dir).expect("vault root");
        let path = dir.join(DEFAULT_ACTIVITY_LOG_PATH);
        fs::create_dir_all(path.parent().unwrap()).unwrap();
        let entry = ActivityLogEntry {
            id: "old".into(),
            ts: 1,
            kind: "info".into(),
            message: "x".repeat(1024),
            detail: None,
        };
        let line = format!("{}\n", serde_json::to_string(&entry).unwrap());
        fs::write(&path, line.repeat(2048)).unwrap();
        append_activity_log(
            &root,
            ActivityLogEntry {
                id: "new".into(),
                ts: 2,
                kind: "info".into(),
                message: "Newest event".into(),
                detail: None,
            },
        )
        .unwrap();
        assert!(fs::metadata(&path).unwrap().len() < 1024 * 1024);
        let entries = read_activity_log(&root, usize::MAX).unwrap();
        assert_eq!(entries.len(), MAX_READ_LINES);
        assert_eq!(entries[0].id, "new");
        assert!(read_activity_log(&root, 0).unwrap().is_empty());
        fs::remove_dir_all(dir).unwrap();
    }

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
