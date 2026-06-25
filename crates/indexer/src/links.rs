use rusqlite::params;
use serde::{Deserialize, Serialize};

use scriptor_vault::{note_id, VaultSession};

use crate::db::IndexCache;
use crate::error::IndexerError;
use crate::parse::{parse_note_markdown, ParsedLinkKind};

pub fn replace_note_links(
    cache: &IndexCache,
    session: &VaultSession,
    path: &str,
    markdown: &str,
) -> Result<u32, IndexerError> {
    let note_key = note_id(&session.descriptor.id, &scriptor_vault::RelativeVaultPath::parse(path)?);
    let parsed = parse_note_markdown(path, markdown);

    cache
        .connection()
        .execute("DELETE FROM links WHERE from_note_id = ?1", params![note_key])?;

    let mut inserted = 0u32;
    for link in parsed.links {
        let kind = match link.kind {
            ParsedLinkKind::Markdown => "markdown",
            ParsedLinkKind::Wikilink => "wikilink",
            ParsedLinkKind::Heading => "heading",
            ParsedLinkKind::Asset => "asset",
            ParsedLinkKind::External => "external",
        };

        let link_id = format!("{note_key}:{}:{}", link.line, link.target);
        cache.connection().execute(
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

    Ok(inserted)
}

pub fn count_links(cache: &IndexCache, vault_id: &str) -> Result<u32, IndexerError> {
    let count: i64 = cache
        .connection()
        .query_row(
            "SELECT COUNT(*) FROM links WHERE vault_id = ?1",
            params![vault_id],
            |row| row.get(0),
        )?;
    Ok(count as u32)
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

    let title: String = cache
        .connection()
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

    let mut statement = cache.connection().prepare(
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
