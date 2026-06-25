use scriptor_vault::{read_note, scan_vault, ScannedEntryKind, VaultSession};

use crate::bibliography::sync_vault_bibliography;
use crate::citation::register_bibliography_keys;
use crate::db::{default_cache_path, IndexCache};
use crate::error::IndexerError;
use crate::health::{build_health_report, CacheStatus, VaultHealthReport};
use crate::links::replace_note_links;
use crate::notes::{note_needs_reindex, remove_note_from_index, session_cache_path, upsert_note};

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, PartialEq, Eq)]
pub struct RebuildSummary {
    pub indexed_notes: u32,
    pub skipped_notes: u32,
    pub links_written: u32,
    pub cache_status: CacheStatus,
    pub health: VaultHealthReport,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum NoteIndexAction {
    Updated,
    Removed,
    Skipped,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, PartialEq, Eq)]
pub struct IncrementalIndexSummary {
    pub updated: u32,
    pub removed: u32,
    pub skipped: u32,
}

pub fn rebuild_index(session: &VaultSession, bibliography_keys: &[&str]) -> Result<RebuildSummary, IndexerError> {
    let cache_path = session_cache_path(session);
    let cache = IndexCache::open(cache_path)?;

    sync_vault_bibliography(&cache, session)?;
    register_bibliography_keys(&cache, bibliography_keys)?;

    let mut indexed_notes = 0u32;
    let mut skipped_notes = 0u32;
    let mut links_written = 0u32;

    for entry in scan_vault(&session.root)? {
        if entry.kind != ScannedEntryKind::Note {
            continue;
        }

        let path = scriptor_vault::RelativeVaultPath::parse(&entry.path)?;
        let note = read_note(&session.descriptor.id, &session.root, &path)?;

        if !note_needs_reindex(&cache, &note.metadata, &note.markdown)? {
            skipped_notes += 1;
            continue;
        }

        upsert_note(&cache, &note.metadata, &note.markdown)?;
        links_written += replace_note_links(&cache, session, &entry.path, &note.markdown)?;
        indexed_notes += 1;
    }

    let health = build_health_report(&cache, session)?;

    Ok(RebuildSummary {
        indexed_notes,
        skipped_notes,
        links_written,
        cache_status: health.cache_status.clone(),
        health,
    })
}

pub fn incremental_note_index(
    session: &VaultSession,
    path: &str,
    bibliography_keys: &[&str],
) -> Result<bool, IndexerError> {
    let summary = incremental_notes_index(session, &[path.to_string()], bibliography_keys)?;
    Ok(summary.updated > 0 || summary.removed > 0)
}

pub fn incremental_notes_index(
    session: &VaultSession,
    paths: &[String],
    bibliography_keys: &[&str],
) -> Result<IncrementalIndexSummary, IndexerError> {
    let cache = IndexCache::open(session_cache_path(session))?;
    sync_vault_bibliography(&cache, session)?;
    register_bibliography_keys(&cache, bibliography_keys)?;

    let mut summary = IncrementalIndexSummary {
        updated: 0,
        removed: 0,
        skipped: 0,
    };

    let mut seen = std::collections::BTreeSet::new();
    for path in paths {
        if !seen.insert(path.clone()) {
            continue;
        }

        match apply_note_index_change(session, &cache, path)? {
            NoteIndexAction::Updated => summary.updated += 1,
            NoteIndexAction::Removed => summary.removed += 1,
            NoteIndexAction::Skipped => summary.skipped += 1,
        }
    }

    Ok(summary)
}

fn apply_note_index_change(
    session: &VaultSession,
    cache: &IndexCache,
    path: &str,
) -> Result<NoteIndexAction, IndexerError> {
    let relative = scriptor_vault::RelativeVaultPath::parse(path)?;
    let absolute = session.root.resolve_relative(&relative)?;

    if !absolute.exists() {
        return if remove_note_from_index(cache, session, path)? {
            Ok(NoteIndexAction::Removed)
        } else {
            Ok(NoteIndexAction::Skipped)
        };
    }

    let note = read_note(&session.descriptor.id, &session.root, &relative)?;
    if !note_needs_reindex(cache, &note.metadata, &note.markdown)? {
        return Ok(NoteIndexAction::Skipped);
    }

    upsert_note(cache, &note.metadata, &note.markdown)?;
    replace_note_links(cache, session, path, &note.markdown)?;
    Ok(NoteIndexAction::Updated)
}

pub fn open_cache_for_session(session: &VaultSession) -> Result<IndexCache, IndexerError> {
    crate::migration::open_cache_migrated(default_cache_path(session.root.root()))
}

#[cfg(test)]
mod tests {
    use super::*;
    use scriptor_vault::{open_vault, save_note};
    use tempfile::tempdir;

    #[test]
    fn incremental_notes_index_removes_deleted_note() -> Result<(), IndexerError> {
        let dir = tempdir().expect("temp dir");
        std::fs::create_dir_all(dir.path().join("notes")).expect("notes dir");
        let session = open_vault(dir.path())?;
        let path = "notes/temp.md";

        save_note(
            &session.descriptor.id,
            &session.root,
            &scriptor_vault::RelativeVaultPath::parse(path)?,
            "# Temp",
            None,
        )?;

        let first = incremental_notes_index(&session, &[path.to_string()], &[])?;
        assert_eq!(first.updated, 1);

        std::fs::remove_file(dir.path().join(path)).expect("remove note");

        let second = incremental_notes_index(&session, &[path.to_string()], &[])?;
        assert_eq!(second.removed, 1);

        Ok(())
    }
}
