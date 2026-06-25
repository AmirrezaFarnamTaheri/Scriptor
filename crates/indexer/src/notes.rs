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
    let mut enriched = metadata.clone();
    enriched.tags = parsed.tags;
    enriched.note_type = parsed.note_type.clone();
    enriched.organized = parsed.organized;
    enriched.archived = parsed.archived;

    cache.connection().execute(
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

    cache.connection().execute(
        "DELETE FROM note_fts WHERE note_id = ?1",
        params![metadata.id],
    )?;
    cache.connection().execute(
        "INSERT INTO note_fts(note_id, title, body) VALUES (?1, ?2, ?3)",
        params![metadata.id, metadata.title, markdown],
    )?;

    Ok(())
}

pub fn note_hash(cache: &IndexCache, note_id: &str) -> Result<Option<String>, IndexerError> {
    let mut statement = cache
        .connection()
        .prepare("SELECT content_hash FROM notes WHERE id = ?1")?;
    let mut rows = statement.query(params![note_id])?;
    if let Some(row) = rows.next()? {
        return Ok(Some(row.get(0)?));
    }
    Ok(None)
}

pub fn note_needs_reindex(cache: &IndexCache, metadata: &NoteMetadata, markdown: &str) -> Result<bool, IndexerError> {
    let current_hash = content_hash(markdown);
    Ok(match note_hash(cache, &metadata.id)? {
        Some(previous) => previous != current_hash,
        None => true,
    })
}

pub fn indexed_note_count(cache: &IndexCache, vault_id: &str) -> Result<u32, IndexerError> {
    let count: i64 = cache.connection().query_row(
        "SELECT COUNT(*) FROM notes WHERE vault_id = ?1",
        params![vault_id],
        |row| row.get(0),
    )?;
    Ok(count as u32)
}

pub fn total_word_count(cache: &IndexCache, vault_id: &str) -> Result<u32, IndexerError> {
    let total: i64 = cache.connection().query_row(
        "SELECT COALESCE(SUM(word_count), 0) FROM notes WHERE vault_id = ?1",
        params![vault_id],
        |row| row.get(0),
    )?;
    Ok(total as u32)
}

pub fn load_note_metadata(
    cache: &IndexCache,
    vault_id: &str,
    path: &str,
) -> Result<Option<NoteMetadata>, IndexerError> {
    let mut statement = cache.connection().prepare(
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

    cache
        .connection()
        .execute("DELETE FROM links WHERE from_note_id = ?1", params![note_key])?;
    cache
        .connection()
        .execute("DELETE FROM citation_refs WHERE note_id = ?1", params![note_key])?;
    cache
        .connection()
        .execute("DELETE FROM note_fts WHERE note_id = ?1", params![note_key])?;
    cache
        .connection()
        .execute("DELETE FROM notes WHERE id = ?1", params![note_key])?;
    Ok(true)
}

pub fn session_cache_path(session: &VaultSession) -> std::path::PathBuf {
    crate::db::default_cache_path(session.root.root())
}

#[cfg(test)]
mod remove_tests {
    use super::*;
    use scriptor_vault::{note_id, RelativeVaultPath};
    use crate::db::IndexCache;
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
        };

        upsert_note(
            &cache,
            &sample_metadata("notes/a.md", 10),
            "# A",
        )?;
        assert!(remove_note_from_index(&cache, &session, "notes/a.md")?);
        assert!(load_note_metadata(&cache, "vault-test", "notes/a.md")?.is_none());
        Ok(())
    }

    fn sample_metadata(path: &str, words: u32) -> NoteMetadata {
        NoteMetadata {
            id: note_id(
                "vault-test",
                &RelativeVaultPath::parse(path).expect("path"),
            ),
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
}
