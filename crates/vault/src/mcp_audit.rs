use std::fs::{self, File, OpenOptions};
use std::io::{BufRead, BufReader, Read, Seek, SeekFrom, Write};
use std::path::{Path, PathBuf};

use chrono::Utc;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

use crate::error::VaultError;
use crate::fs::lock_vault_update;
use crate::path::VaultRoot;

pub const DEFAULT_MCP_AUDIT_PATH: &str = ".scriptor/audit/mcp-mutations.jsonl";
pub const DEFAULT_MCP_AUDIT_MAX_BYTES: u64 = 5 * 1024 * 1024;
pub const DEFAULT_MCP_AUDIT_SEGMENTS: usize = 8;
const AUDIT_TAIL_SCAN_BYTES: u64 = 128 * 1024;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct McpMutationAuditRecord {
    pub id: String,
    pub phase: String,
    pub tool_name: String,
    pub mode: String,
    pub command_id: String,
    pub requested_at: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub approved_at: Option<String>,
    pub outcome: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub note_path: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub detail: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub input_summary: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub success: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub duration_ms: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub idempotency_key: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub previous_hash: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub record_hash: Option<String>,
}

impl McpMutationAuditRecord {
    pub fn intent(
        id: String,
        tool_name: impl Into<String>,
        command_id: impl Into<String>,
        note_path: Option<String>,
        input_summary: Option<String>,
    ) -> Self {
        Self {
            id: id.clone(),
            phase: "intent".into(),
            tool_name: tool_name.into(),
            mode: "write-approved".into(),
            command_id: command_id.into(),
            requested_at: Utc::now().to_rfc3339(),
            approved_at: Some(Utc::now().to_rfc3339()),
            outcome: "pending".into(),
            note_path,
            detail: None,
            input_summary,
            success: None,
            duration_ms: None,
            idempotency_key: Some(id),
            previous_hash: None,
            record_hash: None,
        }
    }

    pub fn outcome(intent: &Self, success: bool, detail: Option<String>, duration_ms: u64) -> Self {
        Self {
            id: intent.id.clone(),
            phase: "outcome".into(),
            tool_name: intent.tool_name.clone(),
            mode: intent.mode.clone(),
            command_id: intent.command_id.clone(),
            requested_at: intent.requested_at.clone(),
            approved_at: intent.approved_at.clone(),
            outcome: if success { "allowed" } else { "failed" }.into(),
            note_path: intent.note_path.clone(),
            detail,
            input_summary: intent.input_summary.clone(),
            success: Some(success),
            duration_ms: Some(duration_ms),
            idempotency_key: intent.idempotency_key.clone(),
            previous_hash: None,
            record_hash: None,
        }
    }

    /// Records a crash-visible terminal state without asserting whether the
    /// underlying mutation reached the filesystem. Consumers must reconcile
    /// this state rather than treating it as a completed failure.
    pub fn interrupted(intent: &Self, detail: impl Into<String>) -> Self {
        Self {
            id: intent.id.clone(),
            phase: "outcome".into(),
            tool_name: intent.tool_name.clone(),
            mode: intent.mode.clone(),
            command_id: intent.command_id.clone(),
            requested_at: intent.requested_at.clone(),
            approved_at: intent.approved_at.clone(),
            outcome: "interrupted".into(),
            note_path: intent.note_path.clone(),
            detail: Some(detail.into()),
            input_summary: intent.input_summary.clone(),
            success: None,
            duration_ms: None,
            idempotency_key: intent.idempotency_key.clone(),
            previous_hash: None,
            record_hash: None,
        }
    }
}

pub fn append_mcp_mutation(
    root: &VaultRoot,
    mut record: McpMutationAuditRecord,
) -> Result<(), VaultError> {
    let absolute = root.root().join(DEFAULT_MCP_AUDIT_PATH);
    if let Some(parent) = absolute.parent() {
        fs::create_dir_all(parent).map_err(|source| VaultError::io(parent, source))?;
    }

    // Serialize the complete read-hash / rotate / append sequence across
    // processes. Locking only the append would still allow two writers to read
    // the same previous hash and fork the chain.
    let _lock = lock_vault_update(&absolute)?;
    let previous_hash = read_last_record_hash(&absolute)?;
    rotate_if_needed(&absolute)?;
    record.previous_hash = previous_hash.clone();
    record.record_hash = None;
    let canonical = serde_json::to_vec(&record).map_err(VaultError::from)?;
    let mut hasher = Sha256::new();
    if let Some(previous) = previous_hash {
        hasher.update(previous.as_bytes());
    }
    hasher.update(&canonical);
    record.record_hash = Some(hex::encode(hasher.finalize()));

    let line = serde_json::to_string(&record).map_err(VaultError::from)?;
    let mut file = OpenOptions::new()
        .create(true)
        .append(true)
        .open(&absolute)
        .map_err(|source| VaultError::io(&absolute, source))?;
    writeln!(file, "{line}").map_err(|source| VaultError::io(&absolute, source))?;
    file.flush()
        .map_err(|source| VaultError::io(&absolute, source))?;
    file.sync_data()
        .map_err(|source| VaultError::io(&absolute, source))?;
    Ok(())
}

pub fn read_mcp_audit_tail(
    root: &VaultRoot,
    limit: usize,
) -> Result<Vec<McpMutationAuditRecord>, VaultError> {
    if limit == 0 {
        return Ok(Vec::new());
    }
    let absolute = root.root().join(DEFAULT_MCP_AUDIT_PATH);
    if !absolute.is_file() {
        return Ok(Vec::new());
    }
    let mut file = File::open(&absolute).map_err(|source| VaultError::io(&absolute, source))?;
    let len = file
        .metadata()
        .map_err(|source| VaultError::io(&absolute, source))?
        .len();
    let start = len.saturating_sub(AUDIT_TAIL_SCAN_BYTES.max((limit as u64) * 2048));
    file.seek(SeekFrom::Start(start))
        .map_err(|source| VaultError::io(&absolute, source))?;
    let mut bytes = Vec::new();
    file.read_to_end(&mut bytes)
        .map_err(|source| VaultError::io(&absolute, source))?;
    let buffer = String::from_utf8_lossy(&bytes);
    let mut records: Vec<_> = buffer
        .lines()
        .skip(if start > 0 { 1 } else { 0 })
        .filter_map(|line| serde_json::from_str(line).ok())
        .collect();
    if records.len() > limit {
        records.drain(..records.len() - limit);
    }
    Ok(records)
}

pub fn reconcile_pending_mcp_mutations(root: &VaultRoot) -> Result<usize, VaultError> {
    verify_mcp_audit_chain(root)?;
    let records = read_mcp_audit_tail(root, 10_000)?;
    let mut pending = std::collections::BTreeMap::new();
    for record in records {
        match record.phase.as_str() {
            "intent" => {
                pending.insert(record.id.clone(), record);
            }
            "outcome" => {
                pending.remove(&record.id);
            }
            _ => {}
        }
    }
    let count = pending.len();
    for intent in pending.into_values() {
        append_mcp_mutation(
            root,
            McpMutationAuditRecord::interrupted(
                &intent,
                "recovered after interruption; mutation outcome requires reconciliation",
            ),
        )?;
    }
    Ok(count)
}

fn read_last_record_hash(path: &Path) -> Result<Option<String>, VaultError> {
    if !path.is_file() {
        return Ok(None);
    }
    let mut file = File::open(path).map_err(|source| VaultError::io(path, source))?;
    let len = file.metadata().map_err(|source| VaultError::io(path, source))?.len();
    let start = len.saturating_sub(AUDIT_TAIL_SCAN_BYTES);
    file.seek(SeekFrom::Start(start)).map_err(|source| VaultError::io(path, source))?;
    let mut bytes = Vec::new();
    file.read_to_end(&mut bytes).map_err(|source| VaultError::io(path, source))?;
    let buffer = String::from_utf8_lossy(&bytes);
    for line in buffer.lines().skip(if start > 0 { 1 } else { 0 }).rev() {
        if let Ok(record) = serde_json::from_str::<McpMutationAuditRecord>(line)
            && record.record_hash.is_some()
        {
            return Ok(record.record_hash);
        }
    }
    Ok(None)
}

/// Verify the complete retained MCP mutation chain, including rotated segments.
pub fn verify_mcp_audit_chain(root: &VaultRoot) -> Result<(), VaultError> {
    let active = root.root().join(DEFAULT_MCP_AUDIT_PATH);
    let parent = active.parent().unwrap_or_else(|| Path::new("."));
    if !parent.exists() {
        return Ok(());
    }
    let mut files: Vec<PathBuf> = fs::read_dir(parent)
        .map_err(|source| VaultError::io(parent, source))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|source| VaultError::io(parent, source))?
        .into_iter()
        .map(|entry| entry.path())
        .filter(|path| path.file_name().and_then(|n| n.to_str()).is_some_and(|name| {
            name.starts_with("mcp-mutations-") && name.ends_with(".jsonl")
        }))
        .collect();
    files.sort();
    if active.is_file() {
        files.push(active.clone());
    }

    let mut previous: Option<String> = None;
    for path in files {
        let file = File::open(&path).map_err(|source| VaultError::io(&path, source))?;
        for line in BufReader::new(file).lines() {
            let line = line.map_err(|source| VaultError::io(&path, source))?;
            if line.trim().is_empty() { continue; }
            let record: McpMutationAuditRecord = serde_json::from_str(&line).map_err(|error| {
                VaultError::InvalidConfig { message: format!("invalid MCP audit record in {}: {error}", path.display()) }
            })?;
            if record.previous_hash != previous {
                return Err(VaultError::InvalidConfig { message: format!("MCP audit chain fork/tamper detected at {}", record.id) });
            }
            let claimed = record.record_hash.clone().ok_or_else(|| VaultError::InvalidConfig {
                message: format!("MCP audit record {} has no hash", record.id),
            })?;
            let mut canonical_record = record.clone();
            canonical_record.record_hash = None;
            let canonical = serde_json::to_vec(&canonical_record)?;
            let mut hasher = Sha256::new();
            if let Some(ref prev) = previous { hasher.update(prev.as_bytes()); }
            hasher.update(&canonical);
            let computed = hex::encode(hasher.finalize());
            if computed != claimed {
                return Err(VaultError::InvalidConfig { message: format!("MCP audit record hash mismatch at {}", record.id) });
            }
            previous = Some(claimed);
        }
    }
    Ok(())
}

fn rotate_if_needed(path: &Path) -> Result<(), VaultError> {
    let size = match path.metadata() {
        Ok(metadata) => metadata.len(),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => 0,
        Err(error) => return Err(VaultError::io(path, error)),
    };
    if size < DEFAULT_MCP_AUDIT_MAX_BYTES {
        return Ok(());
    }
    let parent = path.parent().unwrap_or_else(|| Path::new("."));
    let rotated = parent.join(format!(
        "mcp-mutations-{}-{}.jsonl",
        Utc::now().format("%Y%m%dT%H%M%S%.3fZ"),
        std::process::id()
    ));
    fs::rename(path, &rotated).map_err(|source| VaultError::io(path, source))?;
    prune_segments(parent)?;
    Ok(())
}

fn prune_segments(parent: &Path) -> Result<(), VaultError> {
    let mut segments: Vec<PathBuf> = fs::read_dir(parent)
        .map_err(|source| VaultError::io(parent, source))?
        .filter_map(Result::ok)
        .map(|entry| entry.path())
        .filter(|path| {
            path.file_name()
                .and_then(|name| name.to_str())
                .is_some_and(|name| name.starts_with("mcp-mutations-") && name.ends_with(".jsonl"))
        })
        .collect();
    segments.sort();
    let remove_count = segments.len().saturating_sub(DEFAULT_MCP_AUDIT_SEGMENTS);
    for stale in segments.into_iter().take(remove_count) {
        fs::remove_file(&stale).map_err(|source| VaultError::io(&stale, source))?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use std::fs;

    use tempfile::tempdir;

    use super::*;

    #[test]
    fn audit_records_are_hash_chained_and_tail_is_bounded() -> Result<(), Box<dyn std::error::Error>>
    {
        let dir = tempdir()?;
        let root = VaultRoot::open(dir.path())?;
        let intent = McpMutationAuditRecord::intent(
            "id-1".into(),
            "mcp.proposePatch",
            "note.update",
            Some("alpha.md".into()),
            Some("path=alpha.md".into()),
        );
        append_mcp_mutation(&root, intent.clone())?;
        append_mcp_mutation(
            &root,
            McpMutationAuditRecord::outcome(&intent, true, None, 4),
        )?;

        let records = read_mcp_audit_tail(&root, 1)?;
        assert_eq!(records.len(), 1);
        assert_eq!(records[0].phase, "outcome");
        assert!(records[0].previous_hash.is_some());
        assert!(records[0].record_hash.is_some());
        assert_eq!(records[0].success, Some(true));
        Ok(())
    }

    #[test]
    fn startup_reconciliation_closes_pending_intents() -> Result<(), Box<dyn std::error::Error>> {
        let dir = tempdir()?;
        let root = VaultRoot::open(dir.path())?;
        append_mcp_mutation(
            &root,
            McpMutationAuditRecord::intent(
                "pending".into(),
                "mcp.createNote",
                "note.create",
                Some("pending.md".into()),
                None,
            ),
        )?;
        assert_eq!(reconcile_pending_mcp_mutations(&root)?, 1);
        assert_eq!(reconcile_pending_mcp_mutations(&root)?, 0);
        let content = fs::read_to_string(root.root().join(DEFAULT_MCP_AUDIT_PATH))?;
        assert!(content.contains("recovered after interruption"));
        assert!(content.contains("\"outcome\":\"interrupted\""));
        assert!(!content.contains("\"success\":false"));
        Ok(())
    }
}
