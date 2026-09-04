use rusqlite::TransactionBehavior;

use scriptor_vault::{
    MAX_INDEXED_NOTE_BYTES, NoteDocument, ScannedEntryKind, VaultSession, metadata_from_markdown,
    read_note, scan_vault_for_index,
};

use crate::bibliography::sync_vault_bibliography;
use crate::citation::register_bibliography_keys;
use crate::db::{IndexCache, default_cache_path};
use crate::error::IndexerError;
use crate::health::{CacheStatus, VaultHealthReport, build_health_report};
use crate::links::{replace_note_links_on, resolve_link_targets_on};
use crate::notes::{
    note_needs_reindex, note_needs_reindex_on, remove_note_from_index_on, session_cache_path,
    upsert_note_on,
};
use crate::tasks::sync_note_tasks_from_markdown_on;

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

#[derive(Debug, Clone, Copy, serde::Serialize, serde::Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum RebuildStatus {
    Idle,
    Running,
    Complete,
    Failed,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, PartialEq, Eq)]
pub struct RebuildProgressReport {
    pub status: RebuildStatus,
    pub phase: String,
    pub notes_processed: u32,
    pub notes_total: u32,
    pub event_index: u32,
}

pub fn rebuild_index(
    session: &VaultSession,
    bibliography_keys: &[&str],
) -> Result<RebuildSummary, IndexerError> {
    rebuild_index_with_progress(session, bibliography_keys, |_| ())
}

pub fn rebuild_index_with_progress(
    session: &VaultSession,
    bibliography_keys: &[&str],
    mut on_progress: impl FnMut(RebuildProgressReport),
) -> Result<RebuildSummary, IndexerError> {
    let mut event_index = 0u32;
    let mut emit = |phase: &str, notes_processed: u32, notes_total: u32, status: RebuildStatus| {
        event_index += 1;
        on_progress(RebuildProgressReport {
            status,
            phase: phase.to_string(),
            notes_processed,
            notes_total,
            event_index,
        });
    };

    emit("prepare", 0, 0, RebuildStatus::Running);

    let cache_path = session_cache_path(session);
    let cache = IndexCache::open(cache_path)?;

    sync_vault_bibliography(&cache, session)?;
    register_bibliography_keys(&cache, bibliography_keys)?;

    let note_entries: Vec<_> = scan_vault_for_index(&session.root)?
        .into_iter()
        .filter(|entry| entry.kind == ScannedEntryKind::Note)
        .collect();
    let notes_total = note_entries.len() as u32;

    emit("indexing", 0, notes_total, RebuildStatus::Running);

    let mut indexed_notes = 0u32;
    let mut skipped_notes = 0u32;
    let mut links_written = 0u32;
    let progress_stride = (notes_total / 3).max(1) as usize;

    // Keep the entire visible rebuild inside one write transaction. WAL readers
    // continue to see the previous complete cache until this transaction commits;
    // a parse/index failure rolls back the whole rebuild instead of publishing a
    // half-old/half-new derived database.
    let mut conn = cache.connection()?;
    let transaction = conn.transaction_with_behavior(TransactionBehavior::Immediate)?;
    let tx = &transaction;
    let mut processed = 0usize;
    let mut indexable_paths = std::collections::BTreeSet::<String>::new();

    for entry in &note_entries {
        processed += 1;
        if entry.size_bytes > MAX_INDEXED_NOTE_BYTES {
            skipped_notes += 1;
            tracing::warn!(
                path = %entry.path,
                size_bytes = entry.size_bytes,
                limit_bytes = MAX_INDEXED_NOTE_BYTES,
                "skipping oversized note during index rebuild"
            );
        } else {
            indexable_paths.insert(entry.path.clone());
            let path = scriptor_vault::RelativeVaultPath::parse(&entry.path)?;
            // Reuse the content the scan already read instead of re-reading every
            // file; fall back to a fresh read if the scan did not capture it.
            let note = match (entry.content.clone(), entry.modified_at.clone()) {
                (Some(markdown), Some(modified_at)) => NoteDocument {
                    metadata: metadata_from_markdown(
                        &session.descriptor.id,
                        &path,
                        &markdown,
                        modified_at,
                    ),
                    markdown,
                },
                _ => read_note(&session.descriptor.id, &session.root, &path)?,
            };

            if !note_needs_reindex_on(tx, &note.metadata, &note.markdown)? {
                skipped_notes += 1;
            } else {
                upsert_note_on(tx, &note.metadata, &note.markdown)?;
                sync_note_tasks_from_markdown_on(
                    tx,
                    &session.descriptor.id,
                    &entry.path,
                    &note.markdown,
                )?;
                links_written += replace_note_links_on(tx, session, &entry.path, &note.markdown)?;
                indexed_notes += 1;
            }
        }

        if processed.is_multiple_of(progress_stride) || processed as u32 == notes_total {
            emit(
                "indexing",
                processed as u32,
                notes_total,
                RebuildStatus::Running,
            );
        }
    }

    // A full rebuild is also authoritative deletion reconciliation. Rows for
    // deleted notes, or for notes that grew beyond the indexing budget, must
    // not survive with stale searchable content.
    let indexed_paths = {
        let mut statement = tx.prepare_cached("SELECT path FROM notes WHERE vault_id = ?1")?;
        statement
            .query_map([&session.descriptor.id], |row| row.get::<_, String>(0))?
            .collect::<Result<Vec<_>, _>>()?
    };
    for stale_path in indexed_paths {
        if !indexable_paths.contains(&stale_path) {
            remove_note_from_index_on(tx, &session.descriptor.id, &stale_path)?;
        }
    }

    resolve_link_targets_on(tx, &session.descriptor.id, None)?;
    tx.execute(
        "DELETE FROM cache_meta WHERE key = 'fts_rebuild_required'",
        [],
    )?;
    transaction.commit()?;

    // Refresh planner statistics only after the atomic rebuild is published.
    conn.execute_batch("PRAGMA optimize;")?;

    emit("health", notes_total, notes_total, RebuildStatus::Running);

    let health = build_health_report(&cache, session)?;

    let summary = RebuildSummary {
        indexed_notes,
        skipped_notes,
        links_written,
        cache_status: health.cache_status.clone(),
        health,
    };

    emit(
        "complete",
        notes_total,
        notes_total,
        RebuildStatus::Complete,
    );

    Ok(summary)
}

pub fn incremental_note_index(
    session: &VaultSession,
    path: &str,
    bibliography_keys: &[&str],
) -> Result<bool, IndexerError> {
    let summary = incremental_notes_index(session, &[path.to_string()], bibliography_keys)?;
    Ok(summary.updated > 0 || summary.removed > 0)
}

pub fn incremental_note_index_with_cache(
    session: &VaultSession,
    cache: &IndexCache,
    path: &str,
    bibliography_keys: &[&str],
) -> Result<bool, IndexerError> {
    let summary =
        incremental_notes_index_with_cache(session, cache, &[path.to_string()], bibliography_keys)?;
    Ok(summary.updated > 0 || summary.removed > 0)
}

pub fn incremental_notes_index(
    session: &VaultSession,
    paths: &[String],
    bibliography_keys: &[&str],
) -> Result<IncrementalIndexSummary, IndexerError> {
    let cache = IndexCache::open(session_cache_path(session))?;
    incremental_notes_index_with_cache(session, &cache, paths, bibliography_keys)
}

pub fn incremental_notes_index_with_cache(
    session: &VaultSession,
    cache: &IndexCache,
    paths: &[String],
    bibliography_keys: &[&str],
) -> Result<IncrementalIndexSummary, IndexerError> {
    // A full bibliography scan is only meaningful when a BibTeX database
    // changed; note-body edits must not pay O(vault) maintenance.
    if paths
        .iter()
        .any(|path| path.to_ascii_lowercase().ends_with(".bib"))
    {
        sync_vault_bibliography(cache, session)?;
    }
    register_bibliography_keys(cache, bibliography_keys)?;

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

        match apply_note_index_change(session, cache, path)? {
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
        let mut conn = cache.connection()?;
        let tx = conn.transaction_with_behavior(TransactionBehavior::Immediate)?;
        let removed = remove_note_from_index_on(&tx, &session.descriptor.id, path)?;
        if removed {
            resolve_link_targets_on(&tx, &session.descriptor.id, None)?;
        }
        tx.commit()?;
        return Ok(if removed {
            NoteIndexAction::Removed
        } else {
            NoteIndexAction::Skipped
        });
    }

    let size_bytes = std::fs::metadata(&absolute)
        .map_err(|source| IndexerError::Io {
            path: absolute.clone(),
            source,
        })?
        .len();
    if size_bytes > MAX_INDEXED_NOTE_BYTES {
        tracing::warn!(
            path,
            size_bytes,
            limit_bytes = MAX_INDEXED_NOTE_BYTES,
            "removing oversized note from derived index"
        );
        let mut conn = cache.connection()?;
        let tx = conn.transaction_with_behavior(TransactionBehavior::Immediate)?;
        let removed = remove_note_from_index_on(&tx, &session.descriptor.id, path)?;
        if removed {
            resolve_link_targets_on(&tx, &session.descriptor.id, None)?;
        }
        tx.commit()?;
        return Ok(if removed {
            NoteIndexAction::Removed
        } else {
            NoteIndexAction::Skipped
        });
    }

    let note = read_note(&session.descriptor.id, &session.root, &relative)?;
    if !note_needs_reindex(cache, &note.metadata, &note.markdown)? {
        return Ok(NoteIndexAction::Skipped);
    }

    let parsed = crate::parse::parse_note_markdown(path, &note.markdown);
    let new_aliases = serde_json::to_string(&parsed.aliases)?;

    // Keep metadata, FTS, tasks, outgoing links, and link resolution in one
    // write-intent transaction. Ordinary content edits re-resolve only the
    // changed note's outgoing links; title/alias changes (or a new note) may
    // affect incoming links and therefore trigger the full resolver.
    let mut conn = cache.connection()?;
    let tx = conn.transaction_with_behavior(TransactionBehavior::Immediate)?;
    let old_identity: Option<(String, String)> = {
        let mut statement = tx.prepare_cached(
            "SELECT title, aliases_json FROM notes WHERE id = ?1 AND vault_id = ?2",
        )?;
        let mut rows =
            statement.query(rusqlite::params![note.metadata.id, session.descriptor.id])?;
        rows.next()?
            .map(|row| {
                Ok::<_, rusqlite::Error>((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
            })
            .transpose()?
    };
    let identity_changed = old_identity
        .as_ref()
        .is_none_or(|(title, aliases)| title != &parsed.title || aliases != &new_aliases);

    upsert_note_on(&tx, &note.metadata, &note.markdown)?;
    sync_note_tasks_from_markdown_on(&tx, &session.descriptor.id, path, &note.markdown)?;
    replace_note_links_on(&tx, session, path, &note.markdown)?;
    resolve_link_targets_on(
        &tx,
        &session.descriptor.id,
        if identity_changed {
            None
        } else {
            Some(&note.metadata.id)
        },
    )?;
    tx.commit()?;
    Ok(NoteIndexAction::Updated)
}

pub fn open_cache_for_session(session: &VaultSession) -> Result<IndexCache, IndexerError> {
    crate::migration::open_cache_migrated(default_cache_path(session.root.root()))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{TaskFilter, query_tasks};
    use scriptor_vault::{RelativeVaultPath, open_vault, save_note};
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

    #[test]
    fn incremental_notes_index_syncs_task_rows_from_markdown() -> Result<(), IndexerError> {
        let dir = tempdir().expect("temp dir");
        std::fs::create_dir_all(dir.path().join("notes")).expect("notes dir");
        let session = open_vault(dir.path())?;
        let path = "notes/tasks.md";
        let relative = RelativeVaultPath::parse(path)?;

        save_note(
            &session.descriptor.id,
            &session.root,
            &relative,
            "- [ ] Ship release 📅 2026-08-20\n",
            None,
        )?;

        let summary = incremental_notes_index(&session, &[path.to_string()], &[])?;
        assert_eq!(summary.updated, 1);

        let cache = open_cache_for_session(&session)?;
        let rows = query_tasks(&cache, &session.descriptor.id, &TaskFilter::default(), 20)?;
        assert_eq!(rows.len(), 1);
        assert_eq!(rows[0].title, "Ship release");
        assert_eq!(rows[0].due_at.as_deref(), Some("2026-08-20"));

        Ok(())
    }
}
