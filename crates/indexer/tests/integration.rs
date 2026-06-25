use std::fs;
use std::path::PathBuf;

use scriptor_indexer::{
    backlinks_for_path, build_health_diagnostics, list_recent_files, list_unresolved_link_targets, open_cache_for_session,
    parse_note_markdown, query_focused_graph, rebuild_index, record_recent_access, resolve_wikilink_target_with_aliases,
    search_notes, IndexerError,
};
use scriptor_vault::{open_vault, read_note, rename_apply, save_note, RelativeVaultPath, VaultError};
use tempfile::TempDir;

fn copied_fixture() -> (TempDir, PathBuf) {
    let dir = tempfile::tempdir().expect("tempdir");
    let root = dir.path().to_path_buf();
    let source = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("../../packages/test-fixtures/vaults/minimal/Research Plan.md");
    fs::copy(source, root.join("Research Plan.md")).expect("copy fixture");
    (dir, root)
}

#[test]
fn health_diagnostics_lists_broken_links() -> Result<(), IndexerError> {
    let (_dir, root) = copied_fixture();
    let session = open_vault(root).map_err(IndexerError::from)?;
    rebuild_index(&session, &[])?;
    let cache = open_cache_for_session(&session)?;

    let diagnostics = build_health_diagnostics(&cache, &session)?;
    assert_eq!(diagnostics.summary.broken_links, 2);
    assert_eq!(
        diagnostics
            .issues
            .iter()
            .filter(|issue| issue.kind == "broken_link")
            .count(),
        2
    );
    Ok(())
}

#[test]
fn rebuilds_fixture_index() -> Result<(), IndexerError> {
    let (_dir, root) = copied_fixture();
    let session = open_vault(root).map_err(IndexerError::from)?;
    let summary = rebuild_index(&session, &[])?;

    assert_eq!(summary.indexed_notes, 1);
    assert_eq!(summary.links_written, 2);
    assert_eq!(summary.health.broken_links, 2);
    Ok(())
}

#[test]
fn incremental_hash_skip_on_second_rebuild() -> Result<(), IndexerError> {
    let (_dir, root) = copied_fixture();
    let session = open_vault(root).map_err(IndexerError::from)?;
    let first = rebuild_index(&session, &[])?;
    let second = rebuild_index(&session, &[])?;

    assert_eq!(first.indexed_notes, 1);
    assert_eq!(second.indexed_notes, 0);
    assert_eq!(second.skipped_notes, 1);
    Ok(())
}

fn linked_fixture() -> (TempDir, PathBuf) {
    let dir = tempfile::tempdir().expect("tempdir");
    let root = dir.path().to_path_buf();
    fs::write(
        root.join("Research Plan.md"),
        "# Research Plan\n\n- [[Field Notes]]\n",
    )
    .expect("write research");
    fs::write(root.join("Field Notes.md"), "# Field Notes\n\nBack to [[Research Plan]].\n")
        .expect("write field notes");
    (dir, root)
}

#[test]
fn search_finds_linked_fixture_notes() -> Result<(), IndexerError> {
    let (_dir, root) = linked_fixture();
    let session = open_vault(root).map_err(IndexerError::from)?;
    rebuild_index(&session, &[])?;
    let cache = open_cache_for_session(&session)?;

    let hits = search_notes(&cache, &session.descriptor.id, "Field", 10)?;
    assert!(!hits.is_empty());
    assert!(hits.iter().any(|hit| hit.path.ends_with("Field Notes.md")));
    Ok(())
}

#[test]
fn backlinks_resolve_for_target_note() -> Result<(), IndexerError> {
    let (_dir, root) = linked_fixture();
    let session = open_vault(root).map_err(IndexerError::from)?;
    rebuild_index(&session, &[])?;
    let cache = open_cache_for_session(&session)?;

    let hits = backlinks_for_path(&cache, &session, "Research Plan.md")?;
    assert_eq!(hits.len(), 1);
    assert_eq!(hits[0].from_path, "Field Notes.md");
    Ok(())
}

#[test]
fn graph_query_returns_neighbors() -> Result<(), IndexerError> {
    let (_dir, root) = linked_fixture();
    let session = open_vault(root).map_err(IndexerError::from)?;
    rebuild_index(&session, &[])?;
    let cache = open_cache_for_session(&session)?;

    let graph = query_focused_graph(&cache, &session, Some("Research Plan.md"), 1, &[])?;
    assert!(graph.nodes.len() >= 2);
    assert!(!graph.edges.is_empty());
    Ok(())
}

fn knowledge_edge_fixture_root() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../packages/test-fixtures/vaults/knowledge-edge-cases")
}

#[test]
fn search_relevance_fixture_cases() -> Result<(), IndexerError> {
  let minimal = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../packages/test-fixtures/vaults/minimal");
  let session = open_vault(minimal).map_err(IndexerError::from)?;
  rebuild_index(&session, &[])?;
  let cache = open_cache_for_session(&session)?;
  let hits = search_notes(&cache, &session.descriptor.id, "research", 10)?;
  assert!(hits.iter().any(|hit| hit.path == "Research Plan.md"));

  let (_dir, linked_root) = linked_fixture();
  let linked_session = open_vault(linked_root).map_err(IndexerError::from)?;
  rebuild_index(&linked_session, &[])?;
  let linked_cache = open_cache_for_session(&linked_session)?;
  let field_hits = search_notes(&linked_cache, &linked_session.descriptor.id, "Field", 10)?;
  assert!(field_hits.iter().any(|hit| hit.path.ends_with("Field Notes.md")));

  let edge_session = open_vault(knowledge_edge_fixture_root()).map_err(IndexerError::from)?;
  rebuild_index(&edge_session, &[])?;
  let edge_cache = open_cache_for_session(&edge_session)?;
  let alias_hits = search_notes(&edge_cache, &edge_session.descriptor.id, "alias", 10)?;
  assert!(alias_hits.iter().any(|hit| hit.path == "Alias Target.md"));
  Ok(())
}

#[test]
fn resolves_wikilink_via_frontmatter_alias() -> Result<(), IndexerError> {
    let session = open_vault(knowledge_edge_fixture_root()).map_err(IndexerError::from)?;
    let scanned = scriptor_vault::scan_vault(&session.root).map_err(IndexerError::from)?;
    let mut paths = Vec::new();
    let mut aliases = std::collections::BTreeMap::new();
    for entry in scanned {
        if entry.kind != scriptor_vault::ScannedEntryKind::Note {
            continue;
        }
        paths.push(entry.path.clone());
        let relative = RelativeVaultPath::parse(&entry.path).map_err(IndexerError::from)?;
        let document = read_note(&session.descriptor.id, &session.root, &relative).map_err(IndexerError::from)?;
        let parsed = parse_note_markdown(&entry.path, &document.markdown);
        if !parsed.aliases.is_empty() {
            aliases.insert(entry.path, parsed.aliases);
        }
    }
    let resolution = resolve_wikilink_target_with_aliases(&paths, &aliases, "Friendly Name");
    assert_eq!(resolution.kind, scriptor_indexer::WikilinkResolutionKind::Resolved);
    assert_eq!(resolution.path.as_deref(), Some("Alias Target.md"));
    Ok(())
}

#[test]
fn creates_note_from_unresolved_wikilink_target() -> Result<(), IndexerError> {
    let dir = tempfile::tempdir().expect("tempdir");
    let root = dir.path().to_path_buf();
    fs::write(root.join("Source.md"), "# Source\n\nSee [[New Note]].\n").expect("write source");
    let session = open_vault(root).map_err(IndexerError::from)?;
    rebuild_index(&session, &[])?;
    let cache = open_cache_for_session(&session)?;
    let before = list_unresolved_link_targets(&cache, &session)?;
    assert!(before.iter().any(|target| target.target == "New Note"));

    let path = RelativeVaultPath::parse("New Note.md").map_err(IndexerError::from)?;
    save_note(
        &session.descriptor.id,
        &session.root,
        &path,
        "# New Note\n\nCreated from wikilink.\n",
        None,
    )
    .map_err(IndexerError::from)?;
    rebuild_index(&session, &[])?;
    let cache = open_cache_for_session(&session)?;
    let after = list_unresolved_link_targets(&cache, &session)?;
    assert!(!after.iter().any(|target| target.target == "New Note"));
    Ok(())
}

#[test]
fn rename_updates_inbound_wikilinks() -> Result<(), VaultError> {
    let (_dir, root) = linked_fixture();
    let session = open_vault(root)?;
    let from = RelativeVaultPath::parse("Field Notes.md")?;
    let to = RelativeVaultPath::parse("Updated Field Notes.md")?;
    rename_apply(
        &session.descriptor.id,
        &session.root,
        &from,
        &to,
        true,
    )?;

    let research = read_note(
        &session.descriptor.id,
        &session.root,
        &RelativeVaultPath::parse("Research Plan.md")?,
    )?;
    assert!(research.markdown.contains("[[Updated Field Notes]]"));
    Ok(())
}

#[test]
fn recent_files_index_roundtrip() -> Result<(), IndexerError> {
    let (_dir, root) = linked_fixture();
    let session = open_vault(root).map_err(IndexerError::from)?;
    rebuild_index(&session, &[])?;
    let cache = open_cache_for_session(&session)?;
    record_recent_access(&cache, "Research Plan.md")?;
    record_recent_access(&cache, "Field Notes.md")?;
    let recent = list_recent_files(&cache, 5)?;
    assert_eq!(recent.first().map(|hit| hit.path.as_str()), Some("Field Notes.md"));
    Ok(())
}
