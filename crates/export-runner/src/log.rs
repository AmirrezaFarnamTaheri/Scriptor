use std::fs;
use std::path::Path;

use serde::{Deserialize, Serialize};

use crate::error::ExportError;
use crate::job::ExportJobOutput;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ExportJobLogEntry {
    pub job_id: String,
    pub format: String,
    pub artifact_path: String,
    pub duration_ms: u64,
    pub success: bool,
    pub stderr: String,
    pub finished_at: String,
}

pub fn export_logs_dir(vault_root: &Path) -> std::path::PathBuf {
    vault_root.join(".scriptor/exports/logs")
}

/// Upper bound on retained per-export log files. One JSON file per export with
/// no pruning grows without limit and makes every health check slower.
pub const MAX_EXPORT_LOG_FILES: usize = 200;

pub fn write_export_log(vault_root: &Path, entry: &ExportJobLogEntry) -> Result<(), ExportError> {
    let dir = export_logs_dir(vault_root);
    fs::create_dir_all(&dir).map_err(|source| ExportError::Io {
        path: dir.clone(),
        source,
    })?;
    let file = dir.join(format!("{}.json", entry.job_id));
    let payload = serde_json::to_string_pretty(entry).map_err(|error| {
        ExportError::Process(format!("failed to serialize export log: {error}"))
    })?;
    fs::write(&file, payload).map_err(|source| ExportError::Io { path: file, source })?;
    prune_export_logs(vault_root, MAX_EXPORT_LOG_FILES);
    Ok(())
}

/// Delete the oldest log files beyond `keep`. Best effort: pruning must never
/// fail an export that otherwise succeeded.
pub fn prune_export_logs(vault_root: &Path, keep: usize) -> usize {
    let dir = export_logs_dir(vault_root);
    let mut files = match log_files_newest_first(&dir) {
        Ok(files) => files,
        Err(_) => return 0,
    };
    if files.len() <= keep {
        return 0;
    }
    let mut removed = 0;
    for (path, _) in files.drain(keep..) {
        if fs::remove_file(&path).is_ok() {
            removed += 1;
        }
    }
    removed
}

/// List `*.json` log files newest-first using only `DirEntry` metadata.
///
/// Sorting by mtime *before* reading means a `limit`-bounded query parses only
/// the files it will actually return, instead of every log ever written.
fn log_files_newest_first(
    dir: &Path,
) -> Result<Vec<(std::path::PathBuf, std::time::SystemTime)>, ExportError> {
    let mut files = Vec::new();
    for entry in fs::read_dir(dir).map_err(|source| ExportError::Io {
        path: dir.to_path_buf(),
        source,
    })? {
        // A single unreadable directory entry must not sink the whole listing.
        let Ok(entry) = entry else { continue };
        let path = entry.path();
        if path.extension().and_then(|ext| ext.to_str()) != Some("json") {
            continue;
        }
        let modified = entry
            .metadata()
            .and_then(|metadata| metadata.modified())
            .unwrap_or(std::time::SystemTime::UNIX_EPOCH);
        files.push((path, modified));
    }
    // Newest first; ties broken by path so the order is deterministic.
    files.sort_by(|left, right| right.1.cmp(&left.1).then_with(|| left.0.cmp(&right.0)));
    Ok(files)
}

pub fn read_export_logs(
    vault_root: &Path,
    limit: usize,
) -> Result<Vec<ExportJobLogEntry>, ExportError> {
    let dir = export_logs_dir(vault_root);
    if !dir.exists() {
        return Ok(Vec::new());
    }

    let mut entries = Vec::new();
    for (path, _) in log_files_newest_first(&dir)? {
        if entries.len() >= limit {
            break;
        }
        // Skip unreadable or corrupt files: a health report of the other 199
        // exports is far more useful than an error because one file is bad.
        let Ok(raw) = fs::read_to_string(&path) else {
            continue;
        };
        match serde_json::from_str::<ExportJobLogEntry>(&raw) {
            Ok(parsed) => entries.push(parsed),
            Err(error) => {
                log::warn!("skipping unparsable export log {}: {error}", path.display());
            }
        }
    }

    entries.sort_by(|left, right| right.finished_at.cmp(&left.finished_at));
    Ok(entries)
}

pub fn log_entry_from_output(output: &ExportJobOutput, success: bool) -> ExportJobLogEntry {
    ExportJobLogEntry {
        job_id: output.job_id.clone(),
        format: output.format.clone(),
        artifact_path: output.artifact_path.clone(),
        duration_ms: output.duration_ms,
        success,
        stderr: output.stderr.clone(),
        finished_at: chrono::Utc::now().to_rfc3339(),
    }
}

pub const SLOW_EXPORT_THRESHOLD_MS: u64 = 30_000;

pub fn count_slow_exports(vault_root: &Path) -> Result<u32, ExportError> {
    let count = read_export_logs(vault_root, 50)?
        .into_iter()
        .filter(|entry| entry.success && entry.duration_ms >= SLOW_EXPORT_THRESHOLD_MS)
        .count();
    Ok(u32::try_from(count).unwrap_or(u32::MAX))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn entry(job_id: &str, finished_at: &str) -> ExportJobLogEntry {
        ExportJobLogEntry {
            job_id: job_id.to_string(),
            format: "html".into(),
            artifact_path: "out.html".into(),
            duration_ms: 10,
            success: true,
            stderr: String::new(),
            finished_at: finished_at.to_string(),
        }
    }

    #[test]
    fn corrupt_log_file_is_skipped_not_fatal() {
        let dir = tempfile::tempdir().expect("tempdir");
        let root = dir.path();
        write_export_log(root, &entry("good-1", "2025-01-01T00:00:00Z")).expect("write");
        fs::write(export_logs_dir(root).join("corrupt.json"), "{ not json").expect("corrupt");

        let logs = read_export_logs(root, 10).expect("listing must not fail on one bad file");
        assert_eq!(logs.len(), 1);
        assert_eq!(logs[0].job_id, "good-1");
    }

    #[test]
    fn read_export_logs_respects_limit() {
        let dir = tempfile::tempdir().expect("tempdir");
        let root = dir.path();
        for index in 0..10 {
            write_export_log(
                root,
                &entry(&format!("job-{index}"), "2025-01-01T00:00:00Z"),
            )
            .expect("write");
        }
        assert_eq!(read_export_logs(root, 3).expect("read").len(), 3);
    }

    #[test]
    fn prune_caps_the_log_directory() {
        let dir = tempfile::tempdir().expect("tempdir");
        let root = dir.path();
        for index in 0..12 {
            write_export_log(
                root,
                &entry(&format!("job-{index}"), "2025-01-01T00:00:00Z"),
            )
            .expect("write");
        }
        assert_eq!(count_log_files(root), 12);

        let removed = prune_export_logs(root, 5);
        assert_eq!(removed, 7);
        assert_eq!(count_log_files(root), 5);
    }

    #[test]
    fn writing_beyond_the_cap_prunes_automatically() {
        let dir = tempfile::tempdir().expect("tempdir");
        let root = dir.path();
        for index in 0..(MAX_EXPORT_LOG_FILES + 10) {
            write_export_log(
                root,
                &entry(&format!("job-{index:04}"), "2025-01-01T00:00:00Z"),
            )
            .expect("write");
        }
        assert!(
            count_log_files(root) <= MAX_EXPORT_LOG_FILES,
            "log directory must stay capped, found {}",
            count_log_files(root)
        );
    }

    #[test]
    fn missing_directory_reads_as_empty() {
        let dir = tempfile::tempdir().expect("tempdir");
        assert!(read_export_logs(dir.path(), 5).expect("read").is_empty());
        assert_eq!(prune_export_logs(dir.path(), 5), 0);
    }

    fn count_log_files(root: &Path) -> usize {
        fs::read_dir(export_logs_dir(root))
            .map(|entries| entries.flatten().count())
            .unwrap_or(0)
    }
}
