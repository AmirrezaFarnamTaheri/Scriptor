use std::fs::{self, OpenOptions};
use std::io::Write;

use serde::{Deserialize, Serialize};

use crate::error::VaultError;
use crate::path::VaultRoot;

pub const DEFAULT_MCP_AUDIT_PATH: &str = ".scriptor/audit/mcp-mutations.jsonl";

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct McpMutationAuditRecord {
    pub id: String,
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
}

pub fn append_mcp_mutation(root: &VaultRoot, record: McpMutationAuditRecord) -> Result<(), VaultError> {
    let absolute = root.root().join(DEFAULT_MCP_AUDIT_PATH);
    if let Some(parent) = absolute.parent() {
        fs::create_dir_all(parent).map_err(|source| VaultError::io(parent, source))?;
    }
    let line = serde_json::to_string(&record).map_err(VaultError::from)?;
    let mut file = OpenOptions::new()
        .create(true)
        .append(true)
        .open(&absolute)
        .map_err(|source| VaultError::io(&absolute, source))?;
    writeln!(file, "{line}").map_err(|source| VaultError::io(&absolute, source))?;
    Ok(())
}
