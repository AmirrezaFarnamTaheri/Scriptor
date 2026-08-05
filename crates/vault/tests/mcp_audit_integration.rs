use std::fs;

use scriptor_vault::{
    append_mcp_mutation, read_mcp_audit_tail, McpMutationAuditRecord, VaultRoot,
    DEFAULT_MCP_AUDIT_PATH,
};
use tempfile::tempdir;

#[test]
fn durable_mcp_audit_jsonl_contains_operational_fields() -> Result<(), Box<dyn std::error::Error>> {
    let dir = tempdir()?;
    let root = VaultRoot::open(dir.path())?;
    let intent = McpMutationAuditRecord::intent(
        "integration-id".into(),
        "mcp.updateNote",
        "note.update",
        Some("Research Plan.md".into()),
        Some("path=Research Plan.md".into()),
    );
    append_mcp_mutation(&root, intent.clone())?;
    append_mcp_mutation(
        &root,
        McpMutationAuditRecord::outcome(&intent, true, Some("saved".into()), 17),
    )?;

    let raw = fs::read_to_string(root.root().join(DEFAULT_MCP_AUDIT_PATH))?;
    let rows: Vec<serde_json::Value> = raw
        .lines()
        .map(serde_json::from_str)
        .collect::<Result<_, _>>()?;
    assert_eq!(rows.len(), 2);
    assert_eq!(rows[1]["tool_name"], "mcp.updateNote");
    assert_eq!(rows[1]["success"], true);
    assert_eq!(rows[1]["duration_ms"], 17);
    assert!(rows[1]["requested_at"].as_str().is_some_and(|value| value.contains('T')));
    assert!(rows[1]["record_hash"].as_str().is_some_and(|value| value.len() == 64));

    let tail = read_mcp_audit_tail(&root, 2)?;
    assert_eq!(tail.len(), 2);
    assert_eq!(tail[1].outcome, "allowed");
    Ok(())
}
