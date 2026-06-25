use scriptor_vault::{scan_vault, ScannedEntryKind, VaultSession};
use rusqlite::params;
use serde::{Deserialize, Serialize};

use crate::db::IndexCache;
use crate::error::IndexerError;
use crate::health::build_health_diagnostics;
use crate::links::backlinks_for_path;

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

pub fn list_orphan_notes(cache: &IndexCache, session: &VaultSession) -> Result<Vec<KnowledgeNoteSummary>, IndexerError> {
    let summaries = note_link_summaries(cache, session)?;
    Ok(summaries
        .into_iter()
        .filter(|note| note.inbound_links == 0)
        .collect())
}

pub fn list_dead_end_notes(cache: &IndexCache, session: &VaultSession) -> Result<Vec<KnowledgeNoteSummary>, IndexerError> {
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

fn note_link_summaries(
    cache: &IndexCache,
    session: &VaultSession,
) -> Result<Vec<KnowledgeNoteSummary>, IndexerError> {
    let scanned = scan_vault(&session.root)?;
    let note_paths: Vec<String> = scanned
        .iter()
        .filter(|entry| entry.kind == ScannedEntryKind::Note)
        .map(|entry| entry.path.clone())
        .collect();

    let mut outbound_counts = std::collections::BTreeMap::<String, u32>::new();
    let mut statement = cache.connection().prepare(
        "SELECT notes.path, COUNT(links.id)
         FROM notes
         LEFT JOIN links ON links.from_note_id = notes.id
           AND links.kind IN ('wikilink', 'markdown')
         WHERE notes.vault_id = ?1
         GROUP BY notes.path",
    )?;
    let rows = statement.query_map(params![session.descriptor.id], |row| {
        Ok((row.get::<_, String>(0)?, row.get::<_, i64>(1)? as u32))
    })?;
    for row in rows {
        let (path, count) = row?;
        outbound_counts.insert(path, count);
    }

    let mut summaries = Vec::with_capacity(note_paths.len());
    for path in note_paths {
        let title: String = cache
            .connection()
            .query_row(
                "SELECT title FROM notes WHERE vault_id = ?1 AND path = ?2",
                params![session.descriptor.id, path],
                |row| row.get(0),
            )
            .unwrap_or_else(|_| {
                path.trim_end_matches(".md")
                    .rsplit('/')
                    .next()
                    .unwrap_or(&path)
                    .to_string()
            });

        let inbound_links = backlinks_for_path(cache, session, &path)?.len() as u32;
        let outbound_links = *outbound_counts.get(&path).unwrap_or(&0);

        summaries.push(KnowledgeNoteSummary {
            path,
            title,
            inbound_links,
            outbound_links,
        });
    }

    Ok(summaries)
}
