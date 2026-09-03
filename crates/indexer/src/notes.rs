use rusqlite::{TransactionBehavior, params};

use scriptor_vault::{NoteMetadata, VaultSession};

use crate::db::IndexCache;
use crate::error::IndexerError;
use crate::hash::content_hash;
use crate::parse::parse_note_markdown;

fn reading_time_from_word_count(word_count: u32) -> u32 {
    if word_count == 0 {
        0
    } else {
        word_count.saturating_add(199) / 200
    }
}

/// Autocommitting convenience wrapper; see [`upsert_note_on`] for the
/// connection-scoped core used by batched rebuilds.
pub fn upsert_note(
    cache: &IndexCache,
    metadata: &NoteMetadata,
    markdown: &str,
) -> Result<(), IndexerError> {
    let mut conn = cache.connection()?;
    let tx = conn.transaction_with_behavior(TransactionBehavior::Immediate)?;
    upsert_note_on(&tx, metadata, markdown)?;
    tx.commit()?;
    Ok(())
}

/// Connection-scoped upsert: writes run inside the caller's transaction so a
/// rebuild can amortize fsync cost across a whole chunk of notes.
pub fn upsert_note_on(
    conn: &rusqlite::Connection,
    metadata: &NoteMetadata,
    markdown: &str,
) -> Result<(), IndexerError> {
    let parsed = parse_note_markdown(&metadata.path, markdown);
    let tags_json = serde_json::to_string(&parsed.tags)?;
    let aliases_json = serde_json::to_string(&parsed.aliases)?;
    // Capture joined strings before moving fields into `enriched`.
    let headings_text = parsed.headings.join(" ");
    let tags_text = parsed.tags.join(" ");
    let mut enriched = metadata.clone();
    enriched.tags = parsed.tags;
    enriched.note_type = parsed.note_type.clone();
    enriched.organized = parsed.organized;
    enriched.archived = parsed.archived;

    conn.execute(
        "INSERT INTO notes(id, vault_id, path, title, content_hash, modified_at, word_count, tags_json, note_type, organized, archived, aliases_json)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)
         ON CONFLICT(id) DO UPDATE SET
           path = excluded.path,
           title = excluded.title,
           content_hash = excluded.content_hash,
           modified_at = excluded.modified_at,
           word_count = excluded.word_count,
           tags_json = excluded.tags_json,
           note_type = excluded.note_type,
           organized = excluded.organized,
           archived = excluded.archived,
           aliases_json = excluded.aliases_json",
        params![
            enriched.id,
            enriched.vault_id,
            enriched.path,
            enriched.title,
            enriched.content_hash,
            enriched.modified_at,
            enriched.word_count,
            tags_json,
            enriched.note_type,
            if enriched.organized { 1 } else { 0 },
            if enriched.archived { 1 } else { 0 },
            aliases_json,
        ],
    )?;

    // Bind the FTS row to the ordinary `notes.rowid`. FTS5 indexes rowid, so
    // equality deletes/existence checks stay O(log N) instead of scanning the
    // UNINDEXED `note_id` payload column.
    let note_rowid: i64 = conn.query_row(
        "SELECT rowid FROM notes WHERE id = ?1",
        params![metadata.id],
        |row| row.get(0),
    )?;
    conn.execute("DELETE FROM note_fts WHERE rowid = ?1", params![note_rowid])?;

    // I-3 interlock: sealed content may retain metadata but never an FTS row.
    // Deleting the previous row *before* the early return is essential when a
    // formerly-plaintext note becomes sealed.
    if scriptor_export_runner::sealed::contains_sealed_span(markdown.as_bytes()) {
        return Ok(());
    }

    // v5: populate all four FTS columns (title, headings, tags, body).
    conn.execute(
        "INSERT INTO note_fts(rowid, note_id, title, headings, tags, body) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![
            note_rowid,
            metadata.id,
            metadata.title,
            headings_text,
            tags_text,
            parsed.body
        ],
    )?;

    Ok(())
}

pub(crate) fn note_hash_on(
    conn: &rusqlite::Connection,
    note_id: &str,
) -> Result<Option<String>, IndexerError> {
    let mut statement = conn.prepare_cached("SELECT content_hash FROM notes WHERE id = ?1")?;
    let mut rows = statement.query(params![note_id])?;
    if let Some(row) = rows.next()? {
        return Ok(Some(row.get(0)?));
    }
    Ok(None)
}

pub fn note_hash(cache: &IndexCache, note_id: &str) -> Result<Option<String>, IndexerError> {
    let conn = cache.connection()?;
    note_hash_on(&conn, note_id)
}

pub(crate) fn note_has_fts_row_on(
    conn: &rusqlite::Connection,
    note_id: &str,
) -> Result<bool, IndexerError> {
    conn.query_row(
        "SELECT EXISTS(
            SELECT 1 FROM note_fts
            WHERE rowid = (SELECT rowid FROM notes WHERE id = ?1)
         )",
        params![note_id],
        |row| row.get(0),
    )
    .map_err(IndexerError::from)
}

pub(crate) fn note_needs_reindex_on(
    conn: &rusqlite::Connection,
    metadata: &NoteMetadata,
    markdown: &str,
) -> Result<bool, IndexerError> {
    let current_hash = content_hash(markdown);
    match note_hash_on(conn, &metadata.id)? {
        Some(previous) if previous == current_hash => {
            if scriptor_export_runner::sealed::contains_sealed_span(markdown.as_bytes()) {
                // Sealed notes intentionally have no FTS row.
                Ok(false)
            } else {
                Ok(!note_has_fts_row_on(conn, &metadata.id)?)
            }
        }
        Some(_) | None => Ok(true),
    }
}

pub fn note_needs_reindex(
    cache: &IndexCache,
    metadata: &NoteMetadata,
    markdown: &str,
) -> Result<bool, IndexerError> {
    let conn = cache.connection()?;
    note_needs_reindex_on(&conn, metadata, markdown)
}

pub fn indexed_note_count(cache: &IndexCache, vault_id: &str) -> Result<u32, IndexerError> {
    let conn = cache.connection()?;
    let count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM notes WHERE vault_id = ?1",
        params![vault_id],
        |row| row.get(0),
    )?;
    Ok(u32::try_from(count).unwrap_or(u32::MAX))
}

pub fn total_word_count(cache: &IndexCache, vault_id: &str) -> Result<u32, IndexerError> {
    let conn = cache.connection()?;
    let total: i64 = conn.query_row(
        "SELECT COALESCE(SUM(word_count), 0) FROM notes WHERE vault_id = ?1",
        params![vault_id],
        |row| row.get(0),
    )?;
    Ok(u32::try_from(total).unwrap_or(u32::MAX))
}

/// Returns every indexed note path and its frontmatter aliases for the vault.
///
/// Used by `resolve_wikilink_for_session` to replace the O(n) disk-read loop
/// (scan_vault + read_note per note) with one bounded SQLite query. Aliases
/// are stored in the `aliases_json` column added by the v9 schema migration;
/// pre-v9 rows default to `'[]'`.
///
/// The pair is `(all_paths, aliases_by_path)` where `aliases_by_path` contains
/// only notes that have at least one alias (the common case is an empty map).
type PathsAndAliases = (Vec<String>, std::collections::BTreeMap<String, Vec<String>>);

pub fn note_paths_and_aliases(
    cache: &IndexCache,
    vault_id: &str,
) -> Result<PathsAndAliases, IndexerError> {
    let conn = cache.connection()?;
    let mut statement =
        conn.prepare("SELECT path, aliases_json FROM notes WHERE vault_id = ?1 ORDER BY path")?;
    let mut note_paths = Vec::new();
    let mut aliases_by_path = std::collections::BTreeMap::new();
    let mut rows = statement.query(params![vault_id])?;
    while let Some(row) = rows.next()? {
        let path: String = row.get(0)?;
        let aliases_json: String = row.get(1)?;
        let aliases: Vec<String> = serde_json::from_str(&aliases_json).unwrap_or_default();
        note_paths.push(path.clone());
        if !aliases.is_empty() {
            aliases_by_path.insert(path, aliases);
        }
    }
    Ok((note_paths, aliases_by_path))
}

pub fn load_note_metadata(
    cache: &IndexCache,
    vault_id: &str,
    path: &str,
) -> Result<Option<NoteMetadata>, IndexerError> {
    let conn = cache.connection()?;
    let mut statement = conn.prepare(
        "SELECT id, vault_id, path, title, content_hash, modified_at, word_count, tags_json, note_type, organized, archived
         FROM notes WHERE vault_id = ?1 AND path = ?2",
    )?;
    let mut rows = statement.query(params![vault_id, path])?;
    if let Some(row) = rows.next()? {
        let tags_json: String = row.get(7)?;
        let tags: Vec<String> = serde_json::from_str(&tags_json)?;
        let word_count: u32 = row.get(6)?;
        let organized: i64 = row.get(9)?;
        let archived: i64 = row.get(10)?;
        return Ok(Some(NoteMetadata {
            id: row.get(0)?,
            vault_id: row.get(1)?,
            path: row.get(2)?,
            title: row.get(3)?,
            content_hash: row.get(4)?,
            modified_at: row.get(5)?,
            word_count,
            reading_time_minutes: reading_time_from_word_count(word_count),
            tags,
            note_type: row.get(8)?,
            organized: organized != 0,
            archived: archived != 0,
        }));
    }
    Ok(None)
}

pub(crate) fn remove_note_from_index_on(
    conn: &rusqlite::Connection,
    vault_id: &str,
    path: &str,
) -> Result<bool, IndexerError> {
    let relative = scriptor_vault::RelativeVaultPath::parse(path)?;
    let note_key = scriptor_vault::note_id(vault_id, &relative);
    let exists: bool = conn.query_row(
        "SELECT EXISTS(SELECT 1 FROM notes WHERE id = ?1 AND vault_id = ?2)",
        params![note_key, vault_id],
        |row| row.get(0),
    )?;
    if !exists {
        return Ok(false);
    }

    conn.execute(
        "DELETE FROM task_tags WHERE task_id IN (
            SELECT id FROM tasks WHERE vault_id = ?1 AND source_note_id = ?2
         )",
        params![vault_id, path],
    )?;
    conn.execute(
        "DELETE FROM tasks WHERE vault_id = ?1 AND source_note_id = ?2",
        params![vault_id, path],
    )?;
    conn.execute("DELETE FROM links WHERE from_note_id = ?1", params![note_key])?;
    conn.execute("DELETE FROM citation_refs WHERE note_id = ?1", params![note_key])?;
    conn.execute("DELETE FROM blocks WHERE note_id = ?1", params![note_key])?;
    conn.execute(
        "DELETE FROM note_fts WHERE rowid = (SELECT rowid FROM notes WHERE id = ?1)",
        params![note_key],
    )?;
    conn.execute(
        "DELETE FROM notes WHERE id = ?1 AND vault_id = ?2",
        params![note_key, vault_id],
    )?;
    Ok(true)
}

pub fn remove_note_from_index(
    cache: &IndexCache,
    session: &VaultSession,
    path: &str,
) -> Result<bool, IndexerError> {
    let mut conn = cache.connection()?;
    let tx = conn.transaction_with_behavior(TransactionBehavior::Immediate)?;
    let removed = remove_note_from_index_on(&tx, &session.descriptor.id, path)?;
    tx.commit()?;
    Ok(removed)
}

pub fn session_cache_path(session: &VaultSession) -> std::path::PathBuf {
    crate::db::default_cache_path(session.root.root())
}

#[cfg(test)]
mod remove_tests {
    use super::*;
    use crate::db::IndexCache;
    use scriptor_vault::{RelativeVaultPath, note_id};
    use tempfile::tempdir;

    #[test]
    fn remove_note_from_index_drops_cached_rows() -> Result<(), IndexerError> {
        let dir = tempdir().expect("temp dir");
        let cache = IndexCache::open(dir.path().join("cache.sqlite"))?;
        let session = scriptor_vault::VaultSession {
            descriptor: scriptor_vault::VaultDescriptor {
                id: "vault-test".into(),
                name: "test".into(),
                root_path: dir.path().display().to_string(),
                opened_at: "2026-01-01T00:00:00Z".into(),
                status: scriptor_vault::VaultStatus::Ready,
            },
            root: scriptor_vault::VaultRoot::open(dir.path()).expect("vault root"),
            pending_reindex_paths: Vec::new(),
        };

        upsert_note(&cache, &sample_metadata("notes/a.md", 10), "# A")?;
        assert!(remove_note_from_index(&cache, &session, "notes/a.md")?);
        assert!(load_note_metadata(&cache, "vault-test", "notes/a.md")?.is_none());
        Ok(())
    }

    fn sample_metadata(path: &str, words: u32) -> NoteMetadata {
        NoteMetadata {
            id: note_id("vault-test", &RelativeVaultPath::parse(path).expect("path")),
            vault_id: "vault-test".into(),
            path: path.into(),
            title: path.into(),
            content_hash: format!("hash-{path}"),
            modified_at: "2026-01-01T00:00:00Z".into(),
            word_count: words,
            reading_time_minutes: reading_time_from_word_count(words),
            tags: vec![],
            note_type: None,
            organized: false,
            archived: false,
        }
    }

    fn metadata_for_markdown(path: &str, markdown: &str) -> NoteMetadata {
        let mut metadata = sample_metadata(path, markdown.split_whitespace().count() as u32);
        metadata.content_hash = content_hash(markdown);
        metadata
    }

    #[test]
    fn total_word_count_sums_indexed_notes() -> Result<(), IndexerError> {
        let dir = tempdir().expect("temp dir");
        let cache = IndexCache::open(dir.path().join("cache.sqlite"))?;
        upsert_note(&cache, &sample_metadata("a.md", 100), "one two")?;
        upsert_note(&cache, &sample_metadata("b.md", 250), "many words")?;
        assert_eq!(total_word_count(&cache, "vault-test")?, 350);
        assert_eq!(indexed_note_count(&cache, "vault-test")?, 2);
        Ok(())
    }

    #[test]
    fn missing_fts_row_for_unchanged_note_forces_reindex() -> Result<(), IndexerError> {
        let dir = tempdir().expect("temp dir");
        let cache = IndexCache::open(dir.path().join("cache.sqlite"))?;
        let markdown = "# Searchable\n\nBody text";
        let metadata = metadata_for_markdown("searchable.md", markdown);
        upsert_note(&cache, &metadata, markdown)?;
        assert!(!note_needs_reindex(&cache, &metadata, markdown)?);

        let conn = cache.connection()?;
        conn.execute("DELETE FROM note_fts WHERE note_id = ?1", [&metadata.id])?;
        drop(conn);

        assert!(note_needs_reindex(&cache, &metadata, markdown)?);
        Ok(())
    }

    /// W1-10 / I-3 acceptance criterion: `sealed_content_is_never_embedded`.
    ///
    /// A note whose body contains a sealed span must be stored in the `notes`
    /// table (metadata, including word-count) but must **not** appear in
    /// `note_fts` (full-text search). This prevents ciphertext from ever
    /// surfacing in search snippets or embedding inputs.
    #[test]
    fn sealed_content_is_never_embedded() -> Result<(), IndexerError> {
        let dir = tempdir().expect("temp dir");
        let cache = IndexCache::open(dir.path().join("cache.sqlite"))?;

        let sealed_body = "# Title\n\nNormal paragraph.\n\n%%scriptor-sealed:hint:ciphertext%%\n";
        let meta = metadata_for_markdown("private.md", sealed_body);

        upsert_note(&cache, &meta, sealed_body)?;

        // The note must appear in the metadata table.
        let loaded = load_note_metadata(&cache, "vault-test", "private.md")?;
        assert!(loaded.is_some(), "note metadata must be stored");

        // The note must NOT appear in the FTS table.
        let conn = cache.connection()?;
        let fts_count: i64 = conn.query_row(
            "SELECT COUNT(*) FROM note_fts WHERE note_id = ?1",
            [&meta.id],
            |row| row.get(0),
        )?;
        assert_eq!(fts_count, 0, "sealed note must be excluded from note_fts");
        drop(conn);
        assert!(
            !note_needs_reindex(&cache, &meta, sealed_body)?,
            "missing FTS rows for sealed notes are intentional"
        );
        Ok(())
    }

    #[test]
    fn sealing_previously_plain_note_removes_existing_fts_row() -> Result<(), IndexerError> {
        let dir = tempdir().expect("temp dir");
        let cache = IndexCache::open(dir.path().join("cache.sqlite"))?;
        let plain = "# Private\n\nvisible secret";
        let plain_meta = metadata_for_markdown("private.md", plain);
        upsert_note(&cache, &plain_meta, plain)?;

        let sealed = "# Private\n\n%%scriptor-sealed:hint:ciphertext%%";
        let sealed_meta = metadata_for_markdown("private.md", sealed);
        upsert_note(&cache, &sealed_meta, sealed)?;

        let conn = cache.connection()?;
        let count: i64 = conn.query_row(
            "SELECT COUNT(*) FROM note_fts WHERE rowid = (SELECT rowid FROM notes WHERE id = ?1)",
            [&sealed_meta.id],
            |row| row.get(0),
        )?;
        assert_eq!(count, 0, "sealing must purge the previous plaintext FTS row");
        Ok(())
    }

    #[test]
    fn reading_time_rounds_partial_minutes_up() {
        assert_eq!(reading_time_from_word_count(0), 0);
        assert_eq!(reading_time_from_word_count(1), 1);
        assert_eq!(reading_time_from_word_count(200), 1);
        assert_eq!(reading_time_from_word_count(201), 2);
    }
}
