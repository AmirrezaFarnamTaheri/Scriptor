use std::fs;
use std::path::PathBuf;

use scriptor_indexer::{build_health_diagnostics, open_cache_for_session, rebuild_index, IndexerError};
use scriptor_vault::open_vault;

fn knowledge_edge_root() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../packages/test-fixtures/vaults/knowledge-edge-cases")
}

#[test]
fn health_reports_duplicate_titles_and_broken_links() -> Result<(), IndexerError> {
    let session = open_vault(knowledge_edge_root()).map_err(IndexerError::from)?;
    rebuild_index(&session, &[])?;
    let cache = open_cache_for_session(&session)?;
    let diagnostics = build_health_diagnostics(&cache, &session)?;

    assert!(diagnostics.summary.duplicate_titles >= 1);
    assert!(diagnostics.summary.broken_links >= 1);
    assert!(diagnostics
        .issues
        .iter()
        .any(|issue| issue.kind == "duplicate_title"));
    assert!(diagnostics
        .issues
        .iter()
        .any(|issue| issue.kind == "broken_link"));
    Ok(())
}

#[test]
fn health_reports_alias_vault_search_targets() -> Result<(), IndexerError> {
    let session = open_vault(knowledge_edge_root()).map_err(IndexerError::from)?;
    rebuild_index(&session, &[])?;
    let cache = open_cache_for_session(&session)?;
    let diagnostics = build_health_diagnostics(&cache, &session)?;
    assert!(diagnostics.summary.indexed_notes >= 3);
    assert_eq!(diagnostics.summary.invalid_frontmatter, 0);
    Ok(())
}

#[test]
fn slow_export_metric_reads_logs() -> Result<(), IndexerError> {
    let dir = tempfile::tempdir().expect("tempdir");
    let root = dir.path().to_path_buf();
    fs::create_dir_all(root.join(".scriptor/exports/logs")).expect("logs dir");
    let payload = serde_json::json!({
        "job_id": "slow-1",
        "format": "pdf",
        "artifact_path": ".scriptor/exports/pdf/note.pdf",
        "duration_ms": 45000,
        "success": true,
        "stderr": "",
        "finished_at": "2026-06-22T12:00:00Z"
    });
    fs::write(
        root.join(".scriptor/exports/logs/slow-1.json"),
        serde_json::to_string_pretty(&payload).expect("json"),
    )
    .expect("write log");

    let session = open_vault(root).map_err(IndexerError::from)?;
    rebuild_index(&session, &[])?;
    let cache = open_cache_for_session(&session)?;
    let diagnostics = build_health_diagnostics(&cache, &session)?;
    assert_eq!(diagnostics.summary.slow_exports, 1);
    assert!(diagnostics
        .issues
        .iter()
        .any(|issue| issue.kind == "slow_export"));
    Ok(())
}
