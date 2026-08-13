use rusqlite::params;

use scriptor_vault::{NoteMetadata, VaultSession};

use crate::db::IndexCache;
use crate::error::IndexerError;
use crate::hash::content_hash;
use crate::parse::parse_note_markdown;

fn reading_time_from_word_count(word_count: u32) -> u32 {
    if word_count == 0 {
        0
    } else {
        (word_count / 200).max(1)
    }
}

pub fn upsert_note(
    cache: &IndexCache,
    metadata: &NoteMetadata,
    markdown: &str,
) -> Result<(), IndexerError> {
    let parsed = parse_note_markdown(&metadata.path, markdown);
    let tags_json = serde_json::to_string(&parsed.tags)?;
    // Capture joined strings before moving fields into `enriched`.
    let headings_text = parsed.headings.join(" ");
    let tags_text = parsed.tags.join(" ");
    let mut enriched = metadata.clone();
    enriched.tags = parsed.tags;
    enriched.note_type = parsed.note_type.clone();
    enriched.organized = parsed.organized;
    enriched.archived = parsed.archived;

    let conn = cache.connection()?;
    let tx = conn.unchecked_transaction()?;
    tx.execute(
        "INSERT INTO notes(id, vault_id, path, title, content_hash, modified_at, word_count, tags_json, note_type, organized, archived)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)
         ON CONFLICT(id) DO UPDATE SET
           path = excluded.path,
           title = excluded.title,
           content_hash = excluded.content_hash,
           modified_at = excluded.modified_at,
           word_count = excluded.word_count,
           tags_json = excluded.tags_json,
           note_type = excluded.note_type,
           organized = excluded.organized,
           archived = excluded.archived",
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
        ],
    )?;

    // I-3 interlock: do not index sealed content into the FTS table.
    // Search snippets are user-visible and could expose ciphertext.
    // `contains_sealed_span` is the single authoritative check (I-5).
    if scriptor_export_runner::sealed::contains_sealed_span(markdown.as_bytes()) {
        // Refuse silently: the note stays in `notes` (metadata only) but is
        // not added to `note_fts`. Callers that need an error should call
        // `check_or_redact` from `scriptor_export_runner::sealed` before
        // calling `upsert_note`.
        tx.commit()?;
        return Ok(());
    }

    // v5: populate all four FTS columns (title, headings, tags, body).
    // headings_text and tags_text were captured before the move above.
    tx.execute(
        "DELETE FROM note_fts WHERE note_id = ?1",
        params![metadata.id],
    )?;
    tx.execute(
        "INSERT INTO note_fts(note_id, title, headings, tags, body) VALUES (?1, ?2, ?3, ?4, ?5)",
        params![
            metadata.id,
            metadata.title,
            headings_text,
            tags_text,
            markdown
        ],
    )?;
    tx.commit()?;

    Ok(())
}

pub fn note_hash(cache: &IndexCache, note_id: &str) -> Result<Option<String>, IndexerError> {
    let conn = cache.connection()?;
    let mut statement = conn.prepare("SELECT content_hash FROM notes WHERE id = ?1")?;
    let mut rows = statement.query(params![note_id])?;
    if let Some(row) = rows.next()? {
        return Ok(Some(row.get(0)?));
    }
    Ok(None)
}

pub fn note_needs_reindex(
    cache: &IndexCache,
    metadata: &NoteMetadata,
    markdown: &str,
) -> Result<bool, IndexerError> {
    let current_hash = content_hash(markdown);
    Ok(match note_hash(cache, &metadata.id)? {
        Some(previous) => previous != current_hash,
        None => true,
    })
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

pub fn remove_note_from_index(
    cache: &IndexCache,
    session: &VaultSession,
    path: &str,
) -> Result<bool, IndexerError> {
    let relative = scriptor_vault::RelativeVaultPath::parse(path)?;
    let note_key = scriptor_vault::note_id(&session.descriptor.id, &relative);

    if load_note_metadata(cache, &session.descriptor.id, path)?.is_none() {
        return Ok(false);
    }

    let conn = cache.connection()?;
    let tx = conn.unchecked_transaction()?;
    tx.execute(
        "DELETE FROM task_tags WHERE task_id IN (
            SELECT id FROM tasks WHERE source_note_id = ?1
         )",
        params![path],
    )?;
    tx.execute("DELETE FROM tasks WHERE source_note_id = ?1", params![path])?;
    tx.execute(
        "DELETE FROM links WHERE from_note_id = ?1",
        params![note_key],
    )?;
    tx.execute(
        "DELETE FROM citation_refs WHERE note_id = ?1",
        params![note_key],
    )?;
    tx.execute("DELETE FROM note_fts WHERE note_id = ?1", params![note_key])?;
    tx.execute("DELETE FROM notes WHERE id = ?1", params![note_key])?;
    tx.commit()?;
    Ok(true)
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
        let meta = sample_metadata("private.md", 5);

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
        Ok(())
    }
}
