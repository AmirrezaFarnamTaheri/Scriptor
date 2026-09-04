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
    record: McpMutationAuditRecord,
) -> Result<(), VaultError> {
    let absolute = root.root().join(DEFAULT_MCP_AUDIT_PATH);
    if let Some(parent) = absolute.parent() {
        fs::create_dir_all(parent).map_err(|source| VaultError::io(parent, source))?;
    }

    // Serialize the complete read-hash / rotate / append sequence across
    // processes. Locking only the append would still allow two writers to read
    // the same previous hash and fork the chain.
    let _lock = lock_vault_update(&absolute)?;
    // Capture the previous hash *before* rotation: if the active file is
    // rotated it becomes empty, and re-reading afterwards would anchor the new
    // record to a non-existent tail and fork the chain.
    let previous_hash = read_last_record_hash(&absolute)?;
    rotate_if_needed(&absolute)?;
    link_and_append(&absolute, previous_hash, record)
}

/// Link `record` onto the last record hash of `target` (given as
/// `previous_hash`, already captured) and append it. Exposed as a helper so the
/// test-suite can seed a realistic multi-segment chain with correct continuity.
fn link_and_append(
    target: &Path,
    previous_hash: Option<String>,
    mut record: McpMutationAuditRecord,
) -> Result<(), VaultError> {
    if let Some(parent) = target.parent() {
        fs::create_dir_all(parent).map_err(|source| VaultError::io(parent, source))?;
    }
    record.previous_hash = previous_hash.clone();
    record.record_hash = None;
    let canonical = serde_json::to_vec(&record).map_err(VaultError::from)?;
    let mut hasher = Sha256::new();
    if let Some(previous) = &previous_hash {
        hasher.update(previous.as_bytes());
    }
    hasher.update(&canonical);
    record.record_hash = Some(hex::encode(hasher.finalize()));

    let line = serde_json::to_string(&record).map_err(VaultError::from)?;
    let mut file = OpenOptions::new()
        .create(true)
        .append(true)
        .open(target)
        .map_err(|source| VaultError::io(target, source))?;
    writeln!(file, "{line}").map_err(|source| VaultError::io(target, source))?;
    file.flush()
        .map_err(|source| VaultError::io(target, source))?;
    file.sync_data()
        .map_err(|source| VaultError::io(target, source))?;
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
///
/// Segment rotation (`rotate_if_needed`) keeps at most `DEFAULT_MCP_AUDIT_SEGMENTS`
/// segments and prunes the oldest once the byte budget is exceeded. Pruning means
/// the head record of the oldest *retained* segment still carries a `previous_hash`
/// that points at the tail of the pruned predecessor. That link is intentionally
/// not re-verifiable, so the oldest retained segment is treated as an **anchor**:
/// we verify every record's own hash and every *subsequent* link, but do not reject
/// an unverifiable dangling head. This keeps tamper-detection meaningful across all
/// retained bytes while not false-positiving after a legitimate prune.
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

    // `head_is_anchor` is true only for the very first record across all retained
    // files. Its declared `previous_hash` may reference a pruned predecessor, so we
    // accept it without a link check (its own hash is still verified below).
    let mut previous: Option<String> = None;
    let mut head_is_anchor = true;
    for path in files {
        let file = File::open(&path).map_err(|source| VaultError::io(&path, source))?;
        for line in BufReader::new(file).lines() {
            let line = line.map_err(|source| VaultError::io(&path, source))?;
            if line.trim().is_empty() { continue; }
            let record: McpMutationAuditRecord = serde_json::from_str(&line).map_err(|error| {
                VaultError::InvalidConfig { message: format!("invalid MCP audit record in {}: {error}", path.display()) }
            })?;
            if !head_is_anchor && record.previous_hash != previous {
                return Err(VaultError::InvalidConfig { message: format!("MCP audit chain fork/tamper detected at {}", record.id) });
            }
            // After the first retained record every subsequent record must chain to
            // the previous record's hash.
            head_is_anchor = false;
            let claimed = record.record_hash.clone().ok_or_else(|| VaultError::InvalidConfig {
                message: format!("MCP audit record {} has no hash", record.id),
            })?;
            // Recompute the record hash from its own (possibly anchored) previous
            // hash, so the anchor head is still integrity-checked against tampering
            // of the retained bytes themselves.
            let previous_for_hash = record.previous_hash.as_deref();
            let mut canonical_record = record.clone();
            canonical_record.record_hash = None;
            let canonical = serde_json::to_vec(&canonical_record)?;
            let mut hasher = Sha256::new();
            if let Some(prev) = previous_for_hash { hasher.update(prev.as_bytes()); }
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

    /// Append `record` to `rel` inside `root`, linking it to `previous`, and
    /// return the new tail hash. Lets tests build a realistic chain that spans
    /// several files exactly as rotation would produce it.
    fn seed_with(
        root: &VaultRoot,
        rel: &str,
        record: McpMutationAuditRecord,
        previous: Option<String>,
    ) -> Result<String, VaultError> {
        let path = root.root().join(rel);
        link_and_append(&path, previous, record)?;
        read_last_record_hash(&path)?
            .ok_or_else(|| VaultError::InvalidConfig { message: "seeded record missing hash".into() })
    }

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

    #[test]
    fn verify_accepts_a_pruned_head_and_rejects_internal_tampering() -> Result<(), Box<dyn std::error::Error>>
    {
        let dir = tempdir()?;
        let root = VaultRoot::open(dir.path())?;
        let mut counter = 0u32;
        let mut intent = |tag: &str| {
            counter += 1;
            McpMutationAuditRecord::intent(
                format!("{tag}-{counter}"),
                "mcp.proposePatch",
                "note.update",
                Some("alpha.md".into()),
                Some("path=alpha.md".into()),
            )
        };

        // Build a three-file chain exactly as rotation + append produces it:
        // the head of each new file continues from the tail of the previous one.
        let mut previous = None;
        previous = Some(seed_with(&root, ".scriptor/audit/mcp-mutations-0001.jsonl", intent("old"), previous)?);
        previous = Some(seed_with(&root, ".scriptor/audit/mcp-mutations-0001.jsonl", intent("old"), previous)?);
        previous = Some(seed_with(&root, ".scriptor/audit/mcp-mutations-0002.jsonl", intent("mid"), previous)?);
        previous = Some(seed_with(&root, ".scriptor/audit/mcp-mutations-0002.jsonl", intent("mid"), previous)?);
        previous = Some(seed_with(&root, DEFAULT_MCP_AUDIT_PATH, intent("act"), previous)?);
        seed_with(&root, DEFAULT_MCP_AUDIT_PATH, intent("act"), previous)?;

        // The complete retained chain verifies.
        verify_mcp_audit_chain(&root)?;

        // Simulate pruning of the oldest segment: the 0002 head now dangles to a
        // pruned predecessor and must be accepted as an anchor (regression: this
        // used to be reported as a fork/tamper).
        fs::remove_file(root.root().join(".scriptor/audit/mcp-mutations-0001.jsonl"))?;
        verify_mcp_audit_chain(&root)?;

        // Tampering inside retained bytes is still detected: corrupt the active
        // tail's note_path while leaving its hashes untouched.
        let active_path = root.root().join(DEFAULT_MCP_AUDIT_PATH);
        let content = fs::read_to_string(&active_path)?;
        let mut lines: Vec<String> = content.lines().map(str::to_string).collect();
        let mut tail: serde_json::Value = serde_json::from_str(lines.last().unwrap())?;
        tail["note_path"] = serde_json::Value::String("tampered.md".into());
        let rewritten = serde_json::to_string(&tail)?;
        lines.pop();
        lines.push(rewritten);
        fs::write(&active_path, lines.join("\n") + "\n")?;
        assert!(verify_mcp_audit_chain(&root).is_err());
        Ok(())
    }
}
