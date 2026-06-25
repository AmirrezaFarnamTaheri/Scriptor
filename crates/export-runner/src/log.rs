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
    fs::write(&file, payload).map_err(|source| ExportError::Io {
        path: file,
        source,
    })
}

pub fn read_export_logs(vault_root: &Path, limit: usize) -> Result<Vec<ExportJobLogEntry>, ExportError> {
    let dir = export_logs_dir(vault_root);
    if !dir.exists() {
        return Ok(Vec::new());
    }

    let mut entries = Vec::new();
    for entry in fs::read_dir(&dir).map_err(|source| ExportError::Io {
        path: dir.clone(),
        source,
    })? {
        let entry = entry.map_err(|source| ExportError::Io {
            path: dir.clone(),
            source,
        })?;
        if entry.path().extension().and_then(|ext| ext.to_str()) != Some("json") {
            continue;
        }
        let raw = fs::read_to_string(entry.path()).map_err(|source| ExportError::Io {
            path: entry.path(),
            source,
        })?;
        if let Ok(parsed) = serde_json::from_str::<ExportJobLogEntry>(&raw) {
            entries.push(parsed);
        }
    }

    entries.sort_by(|left, right| right.finished_at.cmp(&left.finished_at));
    entries.truncate(limit);
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
    Ok(read_export_logs(vault_root, 50)?
        .into_iter()
        .filter(|entry| entry.success && entry.duration_ms >= SLOW_EXPORT_THRESHOLD_MS)
        .count() as u32)
}
