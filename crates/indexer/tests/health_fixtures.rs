use std::fs;
use std::path::{Path, PathBuf};

use scriptor_indexer::{
    IndexerError, build_health_diagnostics, open_cache_for_session, rebuild_index,
};
use scriptor_vault::open_vault;

#[test]
fn health_accepts_existing_relative_assets_and_reports_missing_assets() -> Result<(), IndexerError>
{
    let fixture = tempfile::tempdir().expect("tempdir");
    fs::create_dir_all(fixture.path().join("notes")).expect("notes");
    fs::create_dir_all(fixture.path().join("assets")).expect("assets");
    fs::write(fixture.path().join("assets/image.png"), b"image").expect("asset");
    fs::write(
        fixture.path().join("notes/a.md"),
        "# A\n\n![Present](../assets/image.png)\n![Root](/assets/image.png)\n![Missing](../assets/missing.png)\n",
    )
    .expect("note");
    let session = open_vault(fixture.path())?;
    rebuild_index(&session, &[])?;
    let cache = open_cache_for_session(&session)?;
    let diagnostics = build_health_diagnostics(&cache, &session)?;
    let broken: Vec<_> = diagnostics
        .issues
        .iter()
        .filter(|issue| issue.kind == "broken_link")
        .collect();
    assert_eq!(
        broken.len(),
        1,
        "existing assets are not broken note links: {broken:?}"
    );
    assert!(broken[0].detail.contains("missing.png"));
    assert_eq!(diagnostics.summary.orphan_assets, 0);
    Ok(())
}

fn knowledge_edge_root() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("../../packages/test-fixtures/vaults/knowledge-edge-cases")
}

fn copy_fixture(source: &Path, destination: &Path) -> Result<(), IndexerError> {
    fs::create_dir_all(destination).map_err(|source_error| IndexerError::Io {
        path: destination.to_path_buf(),
        source: source_error,
    })?;

    for entry in fs::read_dir(source).map_err(|source_error| IndexerError::Io {
        path: source.to_path_buf(),
        source: source_error,
    })? {
        let entry = entry.map_err(|source_error| IndexerError::Io {
            path: source.to_path_buf(),
            source: source_error,
        })?;
        let source_path = entry.path();
        let destination_path = destination.join(entry.file_name());
        if entry
            .file_type()
            .map_err(|source_error| IndexerError::Io {
                path: source_path.clone(),
                source: source_error,
            })?
            .is_dir()
        {
            copy_fixture(&source_path, &destination_path)?;
        } else {
            fs::copy(&source_path, &destination_path).map_err(|source_error| IndexerError::Io {
                path: source_path,
                source: source_error,
            })?;
        }
    }

    Ok(())
}

fn isolated_knowledge_edge_fixture() -> Result<tempfile::TempDir, IndexerError> {
    let fixture = tempfile::tempdir().map_err(|source| IndexerError::Io {
        path: std::env::temp_dir(),
        source,
    })?;
    copy_fixture(&knowledge_edge_root(), fixture.path())?;
    Ok(fixture)
}

#[test]
fn health_reports_duplicate_titles_and_broken_links() -> Result<(), IndexerError> {
    let fixture = isolated_knowledge_edge_fixture()?;
    let session = open_vault(fixture.path()).map_err(IndexerError::from)?;
    rebuild_index(&session, &[])?;
    let cache = open_cache_for_session(&session)?;
    let diagnostics = build_health_diagnostics(&cache, &session)?;

    assert!(diagnostics.summary.duplicate_titles >= 1);
    assert!(diagnostics.summary.broken_links >= 1);
    assert!(
        diagnostics
            .issues
            .iter()
            .any(|issue| issue.kind == "duplicate_title")
    );
    assert!(
        diagnostics
            .issues
            .iter()
            .any(|issue| issue.kind == "broken_link")
    );
    Ok(())
}

#[test]
fn health_reports_alias_vault_search_targets() -> Result<(), IndexerError> {
    let fixture = isolated_knowledge_edge_fixture()?;
    let session = open_vault(fixture.path()).map_err(IndexerError::from)?;
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
    assert!(
        diagnostics
            .issues
            .iter()
            .any(|issue| issue.kind == "slow_export")
    );
    Ok(())
}
