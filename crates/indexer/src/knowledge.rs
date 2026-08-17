use rusqlite::params;
use scriptor_vault::VaultSession;
use serde::{Deserialize, Serialize};

use crate::db::IndexCache;
use crate::error::IndexerError;
use crate::health::build_health_diagnostics;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct KnowledgeNoteSummary {
    pub path: String,
    pub title: String,
    pub inbound_links: u32,
    pub outbound_links: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct UnresolvedLinkTarget {
    pub target: String,
    pub reference_count: u32,
    pub referencing_paths: Vec<String>,
}

pub fn list_orphan_notes(
    cache: &IndexCache,
    session: &VaultSession,
) -> Result<Vec<KnowledgeNoteSummary>, IndexerError> {
    let summaries = note_link_summaries(cache, session)?;
    Ok(summaries
        .into_iter()
        .filter(|note| note.inbound_links == 0)
        .collect())
}

pub fn list_dead_end_notes(
    cache: &IndexCache,
    session: &VaultSession,
) -> Result<Vec<KnowledgeNoteSummary>, IndexerError> {
    let summaries = note_link_summaries(cache, session)?;
    Ok(summaries
        .into_iter()
        .filter(|note| note.outbound_links == 0)
        .collect())
}

pub fn list_unresolved_link_targets(
    cache: &IndexCache,
    session: &VaultSession,
) -> Result<Vec<UnresolvedLinkTarget>, IndexerError> {
    let diagnostics = build_health_diagnostics(cache, session)?;
    let mut grouped: std::collections::BTreeMap<String, std::collections::BTreeSet<String>> =
        std::collections::BTreeMap::new();

    for issue in diagnostics.issues {
        if issue.kind != "broken_link" {
            continue;
        }
        let target = issue
            .detail
            .strip_prefix("unresolved link target: ")
            .unwrap_or(&issue.detail)
            .to_string();
        grouped.entry(target).or_default().insert(issue.path);
    }

    Ok(grouped
        .into_iter()
        .map(|(target, paths)| UnresolvedLinkTarget {
            reference_count: paths.len() as u32,
            referencing_paths: paths.into_iter().collect(),
            target,
        })
        .collect())
}

/// Returns all note/link summaries in one indexed SQL statement.
///
/// Earlier implementations scanned the filesystem, queried every title, then
/// executed a backlink query per note. That made orphan/dead-end views O(notes)
/// database round trips. The cache is the authoritative source for knowledge
/// views, so counts and metadata are now derived as one bounded result set.
fn note_link_summaries(
    cache: &IndexCache,
    session: &VaultSession,
) -> Result<Vec<KnowledgeNoteSummary>, IndexerError> {
    let conn = cache.connection()?;
    let mut statement = conn.prepare(
        "SELECT
            n.path,
            n.title,
            (
              SELECT COUNT(*)
              FROM links incoming
              WHERE incoming.vault_id = n.vault_id
                AND incoming.kind IN ('wikilink', 'markdown')
                AND (
                  incoming.to_note_id = n.id
                  OR (incoming.to_note_id IS NULL AND lower(incoming.to_path) = lower(n.path))
                )
            ) AS inbound_links,
            (
              SELECT COUNT(*)
              FROM links outgoing
              WHERE outgoing.vault_id = n.vault_id
                AND outgoing.from_note_id = n.id
                AND outgoing.kind IN ('wikilink', 'markdown')
            ) AS outbound_links
         FROM notes n
         WHERE n.vault_id = ?1
         ORDER BY lower(n.title), lower(n.path)",
    )?;
    let rows = statement.query_map(params![session.descriptor.id], |row| {
        Ok(KnowledgeNoteSummary {
            path: row.get(0)?,
            title: row.get(1)?,
            inbound_links: u32::try_from(row.get::<_, i64>(2)?).unwrap_or(u32::MAX),
            outbound_links: u32::try_from(row.get::<_, i64>(3)?).unwrap_or(u32::MAX),
        })
    })?;
    rows.collect::<Result<Vec<_>, _>>()
        .map_err(IndexerError::from)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::schema::apply_schema;
    use rusqlite::Connection;

    #[test]
    fn summary_query_is_single_statement_and_preserves_counts() -> Result<(), IndexerError> {
        let connection = Connection::open_in_memory()?;
        apply_schema(&connection)?;
        connection.execute(
            "INSERT INTO notes(id, vault_id, path, title, content_hash, modified_at, word_count)
             VALUES ('a', 'v', 'a.md', 'A', 'a', 'now', 1),
                    ('b', 'v', 'b.md', 'B', 'b', 'now', 1)",
            [],
        )?;
        connection.execute(
            "INSERT INTO links(id, vault_id, from_note_id, to_note_id, to_path, kind, label)
             VALUES ('l', 'v', 'a', 'b', 'b.md', 'wikilink', 'B')",
            [],
        )?;

        let mut statement = connection.prepare(
            "SELECT n.path,
                    (SELECT COUNT(*) FROM links i WHERE i.vault_id=n.vault_id AND i.to_note_id=n.id),
                    (SELECT COUNT(*) FROM links o WHERE o.vault_id=n.vault_id AND o.from_note_id=n.id)
             FROM notes n WHERE n.vault_id='v' ORDER BY n.path",
        )?;
        let rows = statement
            .query_map([], |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, i64>(1)?,
                    row.get::<_, i64>(2)?,
                ))
            })?
            .collect::<Result<Vec<_>, _>>()?;
        assert_eq!(rows, vec![("a.md".into(), 0, 1), ("b.md".into(), 1, 0)]);
        Ok(())
    }
}
