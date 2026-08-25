use rusqlite::params;
use serde::{Deserialize, Serialize};

use scriptor_vault::{VaultSession, note_id};

use crate::db::IndexCache;
use crate::error::IndexerError;
use crate::parse::{ParsedLinkKind, parse_note_markdown};

pub fn replace_note_links(
    cache: &IndexCache,
    session: &VaultSession,
    path: &str,
    markdown: &str,
) -> Result<u32, IndexerError> {
    let note_key = note_id(
        &session.descriptor.id,
        &scriptor_vault::RelativeVaultPath::parse(path)?,
    );
    let parsed = parse_note_markdown(path, markdown);

    let conn = cache.connection()?;
    // The delete and the re-insert must be atomic: without a transaction a failure partway
    // through leaves the note with no links at all, silently dropping every backlink to it.
    let transaction = conn.unchecked_transaction()?;
    transaction.execute(
        "DELETE FROM links WHERE from_note_id = ?1",
        params![note_key],
    )?;

    let mut inserted = 0u32;
    for (ordinal, link) in parsed.links.into_iter().enumerate() {
        let kind = match link.kind {
            ParsedLinkKind::Markdown => "markdown",
            ParsedLinkKind::Wikilink => "wikilink",
            ParsedLinkKind::Heading => "heading",
            ParsedLinkKind::Asset => "asset",
            ParsedLinkKind::External => "external",
        };

        // The ordinal keeps the primary key unique per occurrence. Two identical links on the
        // same line (`See [[A]] and [[A]] again.`), or a wikilink and a Markdown link pointing at
        // the same target on the same line, would otherwise collide on the primary key.
        let link_id = format!("{note_key}:{}:{ordinal}:{}", link.line, link.target);
        transaction.execute(
            "INSERT INTO links(id, vault_id, from_note_id, to_note_id, to_path, kind, label, line)
             VALUES (?1, ?2, ?3, NULL, ?4, ?5, ?6, ?7)",
            params![
                link_id,
                session.descriptor.id,
                note_key,
                link.target,
                kind,
                link.label,
                link.line
            ],
        )?;
        inserted += 1;
    }

    transaction.commit()?;
    Ok(inserted)
}

/// Resolves stored link targets to note IDs after note metadata is current.
///
/// Link parsing happens while individual notes are indexed, so the target note
/// may not exist in the cache yet. This pass builds a case-insensitive lookup
/// once, updates all links transactionally, and enables indexed graph traversal
/// without loading every note and link into memory for each query.
pub fn resolve_link_targets(cache: &IndexCache, vault_id: &str) -> Result<u32, IndexerError> {
    let conn = cache.connection()?;
    let mut notes_statement = conn.prepare(
        "SELECT id, path, title FROM notes WHERE vault_id = ?1 ORDER BY lower(path), id",
    )?;
    let note_rows = notes_statement.query_map(params![vault_id], |row| {
        Ok((
            row.get::<_, String>(0)?,
            row.get::<_, String>(1)?,
            row.get::<_, String>(2)?,
        ))
    })?;

    let mut lookup = std::collections::HashMap::<String, String>::new();
    for row in note_rows {
        let (id, path, title) = row?;
        let stem = path
            .trim_end_matches(".md")
            .rsplit('/')
            .next()
            .unwrap_or(&path)
            .to_string();
        for key in [path, title, stem] {
            lookup
                .entry(key.to_lowercase())
                .or_insert_with(|| id.clone());
        }
    }
    drop(notes_statement);

    let mut links_statement = conn.prepare(
        "SELECT id, to_path, to_note_id FROM links
         WHERE vault_id = ?1 AND kind IN ('wikilink', 'markdown', 'heading')",
    )?;
    let link_rows = links_statement.query_map(params![vault_id], |row| {
        Ok((
            row.get::<_, String>(0)?,
            row.get::<_, String>(1)?,
            row.get::<_, Option<String>>(2)?,
        ))
    })?;
    let mut updates = Vec::new();
    for row in link_rows {
        let (id, target, current_target_id) = row?;
        let resolved = lookup.get(&target.to_lowercase()).cloned();
        // Only queue a write when resolution actually changed; identical
        // targets are the common case in steady-state vaults.
        if resolved.as_deref() != current_target_id.as_deref() {
            updates.push((id, resolved));
        }
    }
    drop(links_statement);

    if updates.is_empty() {
        // Steady-state vault: every link already points at its resolved note.
        return Ok(0);
    }

    let transaction = conn.unchecked_transaction()?;
    let mut changed = 0u32;
    {
        let mut update = transaction
            .prepare("UPDATE links SET to_note_id = ?1 WHERE id = ?2 AND vault_id = ?3")?;
        for (id, target_id) in updates {
            changed = changed.saturating_add(
                u32::try_from(update.execute(params![target_id, id, vault_id])?)
                    .unwrap_or(u32::MAX),
            );
        }
    }
    transaction.commit()?;
    Ok(changed)
}

pub fn count_links(cache: &IndexCache, vault_id: &str) -> Result<u32, IndexerError> {
    let conn = cache.connection()?;
    let count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM links WHERE vault_id = ?1",
        params![vault_id],
        |row| row.get(0),
    )?;
    Ok(u32::try_from(count).unwrap_or(u32::MAX))
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct BacklinkHit {
    pub from_path: String,
    pub from_title: String,
    pub label: String,
    pub kind: String,
    pub line: u32,
}

pub fn backlinks_for_path(
    cache: &IndexCache,
    session: &VaultSession,
    note_path: &str,
) -> Result<Vec<BacklinkHit>, IndexerError> {
    let relative = scriptor_vault::RelativeVaultPath::parse(note_path)?;
    let note_key = note_id(&session.descriptor.id, &relative);

    let conn = cache.connection()?;
    let title: String = conn
        .query_row(
            "SELECT title FROM notes WHERE id = ?1",
            params![note_key],
            |row| row.get(0),
        )
        .unwrap_or_else(|_| {
            note_path
                .trim_end_matches(".md")
                .rsplit('/')
                .next()
                .unwrap_or(note_path)
                .to_string()
        });

    let stem = note_path
        .trim_end_matches(".md")
        .rsplit('/')
        .next()
        .unwrap_or(note_path);

    let mut statement = conn.prepare(
        "SELECT n.path, n.title, l.label, l.kind, l.line
         FROM links l
         JOIN notes n ON l.from_note_id = n.id
         WHERE l.vault_id = ?1
           AND l.kind IN ('wikilink', 'markdown')
           AND l.from_note_id != ?2
           AND (
             l.to_path = ?3 OR l.to_path = ?4 OR l.to_path = ?5
             OR lower(l.to_path) = lower(?6) OR lower(l.to_path) = lower(?7)
           )
         ORDER BY n.path, l.line",
    )?;

    let rows = statement.query_map(
        params![
            session.descriptor.id,
            note_key,
            title,
            note_path,
            stem,
            title,
            stem,
        ],
        |row| {
            Ok(BacklinkHit {
                from_path: row.get(0)?,
                from_title: row.get(1)?,
                label: row.get(2)?,
                kind: row.get(3)?,
                line: row.get(4)?,
            })
        },
    )?;

    Ok(rows.collect::<Result<Vec<_>, _>>()?)
}

#[cfg(test)]
mod tests {
    use super::*;
    use scriptor_vault::{open_vault, save_note};
    use tempfile::tempdir;

    fn write_note(session: &VaultSession, path: &str, markdown: &str) -> Result<(), IndexerError> {
        save_note(
            &session.descriptor.id,
            &session.root,
            &scriptor_vault::RelativeVaultPath::parse(path)?,
            markdown,
            None,
        )?;
        Ok(())
    }

    #[test]
    fn duplicate_links_on_one_line_are_all_stored() -> Result<(), IndexerError> {
        let dir = tempdir().expect("temp dir");
        let session = open_vault(dir.path())?;
        let cache = crate::rebuild::open_cache_for_session(&session)?;

        let markdown = "# Source\n\nSee [[Target]] and [[Target]] again, plus [Target](Target).\n";
        write_note(&session, "source.md", markdown)?;

        let inserted = replace_note_links(&cache, &session, "source.md", markdown)?;
        assert_eq!(inserted, 3, "every occurrence should be stored");
        assert_eq!(count_links(&cache, &session.descriptor.id)?, 3);

        // Re-indexing the same note must be idempotent rather than accumulating rows.
        let reinserted = replace_note_links(&cache, &session, "source.md", markdown)?;
        assert_eq!(reinserted, 3);
        assert_eq!(count_links(&cache, &session.descriptor.id)?, 3);

        Ok(())
    }

    #[test]
    fn backlinks_survive_a_note_with_duplicate_links() -> Result<(), IndexerError> {
        let dir = tempdir().expect("temp dir");
        let session = open_vault(dir.path())?;
        let cache = crate::rebuild::open_cache_for_session(&session)?;

        write_note(&session, "target.md", "# Target\n")?;
        let markdown = "# Source\n\nSee [[Target]] and [[Target]] again.\n";
        write_note(&session, "source.md", markdown)?;

        crate::rebuild::rebuild_index(&session, &[])?;

        let hits = backlinks_for_path(&cache, &session, "target.md")?;
        assert_eq!(hits.len(), 2, "duplicate links must not wipe the backlinks");
        assert!(hits.iter().all(|hit| hit.from_path == "source.md"));

        Ok(())
    }
}
