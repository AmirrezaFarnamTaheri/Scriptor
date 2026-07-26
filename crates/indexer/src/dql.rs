use rusqlite::params;
use serde::{Deserialize, Serialize};

use scriptor_vault::VaultSession;

use crate::db::IndexCache;
use crate::error::IndexerError;
use crate::search::search_notes;
use crate::tags::notes_for_tag;
use crate::views::list_view_notes;

/// Result cap shared by every DQL clause.
const DQL_RESULT_LIMIT: usize = 200;

/// How many candidate rows `path matches` may pull out of SQLite before the
/// user-supplied regex is applied to them.
const PATH_MATCH_SCAN_LIMIT: i64 = 5_000;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct DqlResultRow {
    pub path: String,
    pub title: String,
    pub snippet: String,
}

/// Foam-style DQL with compound AND/OR, JSON view filters, links, and body search.
pub fn execute_dql_query(
    cache: &IndexCache,
    session: &VaultSession,
    query: &str,
) -> Result<Vec<DqlResultRow>, IndexerError> {
    let trimmed = query.trim();
    if trimmed.is_empty() {
        return Ok(Vec::new());
    }

    if trimmed.starts_with('{') {
        return view_filter_to_rows(cache, session, trimmed);
    }

    if contains_compound(trimmed, " and ") {
        let parts = split_compound(trimmed, " and ");
        return intersect_many(cache, session, &parts);
    }

    if contains_compound(trimmed, " or ") {
        let parts = split_compound(trimmed, " or ");
        return union_many(cache, session, &parts);
    }

    execute_single_clause(cache, session, trimmed)
}

fn view_filter_to_rows(
    cache: &IndexCache,
    session: &VaultSession,
    filter_json: &str,
) -> Result<Vec<DqlResultRow>, IndexerError> {
    list_view_notes(cache, session, filter_json).map(|hits| {
        hits.into_iter()
            .map(|hit| DqlResultRow {
                path: hit.path,
                title: hit.title,
                snippet: String::new(),
            })
            .collect()
    })
}

fn intersect_many(
    cache: &IndexCache,
    session: &VaultSession,
    parts: &[String],
) -> Result<Vec<DqlResultRow>, IndexerError> {
    if parts.is_empty() {
        return Ok(Vec::new());
    }
    let mut acc = execute_single_clause(cache, session, &parts[0])?;
    for part in parts.iter().skip(1) {
        let next = execute_single_clause(cache, session, part)?;
        acc = intersect_rows(acc, next);
    }
    Ok(acc)
}

fn union_many(
    cache: &IndexCache,
    session: &VaultSession,
    parts: &[String],
) -> Result<Vec<DqlResultRow>, IndexerError> {
    let mut merged = Vec::new();
    for part in parts {
        merged = union_rows(merged, execute_single_clause(cache, session, part)?);
    }
    Ok(merged)
}

fn execute_single_clause(
    cache: &IndexCache,
    session: &VaultSession,
    query: &str,
) -> Result<Vec<DqlResultRow>, IndexerError> {
    let trimmed = query.trim();
    let lower = trimmed.to_ascii_lowercase();

    if let Some(tag) = lower.strip_prefix("path has #").or_else(|| lower.strip_prefix("path has ")) {
        let tag = tag.trim_start_matches('#');
        return notes_for_tag(cache, &session.descriptor.id, tag).map(|notes| {
            notes
                .into_iter()
                .map(|note| DqlResultRow {
                    path: note.path,
                    title: note.title,
                    snippet: String::new(),
                })
                .collect()
        });
    }

    if let Some(needle) = extract_quoted_after(&lower, "title contains ") {
        return title_contains(cache, &session.descriptor.id, &needle);
    }

    if let Some(needle) = extract_quoted_after(&lower, "body contains ") {
        return body_contains(cache, &session.descriptor.id, &needle);
    }

    if let Some(pattern) = extract_regex_after(&lower, "path matches ") {
        return path_matches(cache, &session.descriptor.id, &pattern);
    }

    if let Some(target) = extract_links_to_target(trimmed) {
        return links_to(cache, &session.descriptor.id, &target);
    }

    Err(IndexerError::InvalidQuery(format!("unsupported DQL: {query}")))
}

fn extract_links_to_target(query: &str) -> Option<String> {
    let lower = query.to_ascii_lowercase();
    let start = lower.find("links to ")? + "links to ".len();
    let value = query[start..].trim();
    if value.starts_with("[[") && value.ends_with("]]") {
        return Some(value[2..value.len() - 2].trim().to_string());
    }
    if let Some(inner) = value.strip_prefix('"') {
        let end = inner.find('"')?;
        return Some(inner[..end].to_string());
    }
    if let Some(inner) = value.strip_prefix('\'') {
        let end = inner.find('\'')?;
        return Some(inner[..end].to_string());
    }
    if value.is_empty() {
        None
    } else {
        Some(value.to_string())
    }
}

fn contains_compound(query: &str, op: &str) -> bool {
    split_compound(query, op).len() > 1
}

fn split_compound(query: &str, op: &str) -> Vec<String> {
    let mut parts = Vec::new();
    let mut current = String::new();
    let mut in_quotes = false;
    // `to_ascii_lowercase` only rewrites ASCII bytes, so `lower` shares the exact
    // byte layout of `query`; byte offsets are valid in both strings.
    let lower = query.to_ascii_lowercase();
    let op_lower = op.to_ascii_lowercase();
    let mut index = 0;

    while let Some(ch) = query[index..].chars().next() {
        if ch == '"' {
            in_quotes = !in_quotes;
            current.push(ch);
            index += ch.len_utf8();
            continue;
        }

        if !in_quotes && lower[index..].starts_with(&op_lower) {
            let part = current.trim().to_string();
            if !part.is_empty() {
                parts.push(part);
            }
            current.clear();
            index += op.len();
            continue;
        }

        current.push(ch);
        index += ch.len_utf8();
    }

    let part = current.trim().to_string();
    if !part.is_empty() {
        parts.push(part);
    }
    parts
}

fn intersect_rows(left: Vec<DqlResultRow>, right: Vec<DqlResultRow>) -> Vec<DqlResultRow> {
    let right_paths: std::collections::BTreeSet<_> = right.iter().map(|row| row.path.clone()).collect();
    left.into_iter()
        .filter(|row| right_paths.contains(&row.path))
        .collect()
}

fn union_rows(left: Vec<DqlResultRow>, right: Vec<DqlResultRow>) -> Vec<DqlResultRow> {
    let mut seen = std::collections::BTreeSet::new();
    let mut merged = Vec::new();
    for row in left.into_iter().chain(right) {
        if seen.insert(row.path.clone()) {
            merged.push(row);
        }
    }
    merged
}

fn extract_quoted_after(input: &str, prefix: &str) -> Option<String> {
    let rest = if prefix.is_empty() {
        input.trim()
    } else {
        input.strip_prefix(prefix)?.trim()
    };
    if let Some(inner) = rest.strip_prefix('"') {
        let end = inner.find('"')?;
        return Some(inner[..end].to_string());
    }
    if let Some(inner) = rest.strip_prefix('\'') {
        let end = inner.find('\'')?;
        return Some(inner[..end].to_string());
    }
    if prefix.is_empty() {
        return None;
    }
    Some(rest.to_string())
}

fn extract_regex_after(input: &str, prefix: &str) -> Option<String> {
    let rest = input.strip_prefix(prefix)?.trim();
    if rest.starts_with('/') && rest.len() > 2 {
        let end = rest[1..].find('/')?;
        return Some(rest[1..1 + end].to_string());
    }
    None
}

fn title_contains(cache: &IndexCache, vault_id: &str, needle: &str) -> Result<Vec<DqlResultRow>, IndexerError> {
    let pattern = format!("%{needle}%");
    let conn = cache.connection()?;
    let mut statement = conn.prepare(
        "SELECT path, title FROM notes WHERE vault_id = ?1 AND title LIKE ?2 ORDER BY path LIMIT 200",
    )?;
    let rows = statement.query_map(params![vault_id, pattern], |row| {
        Ok(DqlResultRow {
            path: row.get(0)?,
            title: row.get(1)?,
            snippet: String::new(),
        })
    })?;
    Ok(rows.collect::<Result<Vec<_>, _>>()?)
}

fn body_contains(cache: &IndexCache, vault_id: &str, needle: &str) -> Result<Vec<DqlResultRow>, IndexerError> {
    Ok(search_notes(cache, vault_id, needle, 200)?
        .into_iter()
        .map(|hit| DqlResultRow {
            path: hit.path,
            title: hit.title,
            snippet: hit.snippet,
        })
        .collect())
}

fn path_matches(cache: &IndexCache, vault_id: &str, pattern: &str) -> Result<Vec<DqlResultRow>, IndexerError> {
    let re = regex::RegexBuilder::new(pattern)
        .size_limit(1 << 20)
        .dfa_size_limit(1 << 20)
        .build()
        .map_err(|error| IndexerError::InvalidQuery(error.to_string()))?;
    let conn = cache.connection()?;
    // Two bounds, because the regex is applied in Rust rather than in SQL: the
    // SQL LIMIT caps how many rows are ever materialised and matched against a
    // user-supplied pattern, and the result cap matches the sibling clauses.
    let mut statement = conn.prepare(
        "SELECT path, title FROM notes WHERE vault_id = ?1 ORDER BY path LIMIT ?2",
    )?;
    let rows = statement.query_map(params![vault_id, PATH_MATCH_SCAN_LIMIT], |row| {
        Ok(DqlResultRow {
            path: row.get(0)?,
            title: row.get(1)?,
            snippet: String::new(),
        })
    })?;
    Ok(rows
        .filter_map(|row| row.ok())
        .filter(|row| re.is_match(&row.path))
        .take(DQL_RESULT_LIMIT)
        .collect())
}

fn links_to(cache: &IndexCache, vault_id: &str, target: &str) -> Result<Vec<DqlResultRow>, IndexerError> {
    let pattern = format!("%{target}%");
    let conn = cache.connection()?;
    let mut statement = conn.prepare(
        "SELECT DISTINCT n.path, n.title
         FROM notes n
         INNER JOIN links l ON l.from_note_id = n.id
         WHERE l.vault_id = ?1 AND (l.label LIKE ?2 OR IFNULL(l.to_path, '') LIKE ?2)
         ORDER BY n.path
         LIMIT 200",
    )?;
    let rows = statement.query_map(params![vault_id, pattern], |row| {
        Ok(DqlResultRow {
            path: row.get(0)?,
            title: row.get(1)?,
            snippet: String::new(),
        })
    })?;
    Ok(rows.collect::<Result<Vec<_>, _>>()?)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn split_compound_respects_quotes() {
        let parts = split_compound(
            r#"title contains "foo and bar" and path has #draft"#,
            " and ",
        );
        assert_eq!(parts.len(), 2);
        assert!(parts[0].contains("foo and bar"));
        assert!(parts[1].contains("path has #draft"));
    }

    #[test]
    fn extract_links_to_target_parses_wikilink() {
        assert_eq!(
            extract_links_to_target("links to [[Project Plan]]"),
            Some("Project Plan".to_string())
        );
    }

    #[test]
    fn split_compound_handles_non_ascii_query() {
        let parts = split_compound(
            r#"title contains "café" and body contains "naïve — 🚀""#,
            " and ",
        );
        assert_eq!(parts.len(), 2);
        assert!(parts[0].contains("café"));
        assert!(parts[1].contains("naïve — 🚀"));
    }

    fn test_session(root: &std::path::Path) -> VaultSession {
        VaultSession {
            descriptor: scriptor_vault::VaultDescriptor {
                id: "vault-test".into(),
                name: "test".into(),
                root_path: root.display().to_string(),
                opened_at: "2026-01-01T00:00:00Z".into(),
                status: scriptor_vault::VaultStatus::Ready,
            },
            root: scriptor_vault::VaultRoot::open(root).expect("vault root"),
            pending_reindex_paths: Vec::new(),
        }
    }

    #[test]
    fn execute_dql_with_non_ascii_query_does_not_panic() -> Result<(), Box<dyn std::error::Error>> {
        let dir = tempfile::tempdir()?;
        let cache = IndexCache::open(dir.path().join("cache.sqlite"))?;
        let session = test_session(dir.path());
        let rows = execute_dql_query(
            &cache,
            &session,
            r#"title contains "café" and body contains "café""#,
        )?;
        assert!(rows.is_empty());
        Ok(())
    }

    #[test]
    fn path_matches_caps_its_result_set() -> Result<(), Box<dyn std::error::Error>> {
        let dir = tempfile::tempdir()?;
        let cache = IndexCache::open(dir.path().join("cache.sqlite"))?;
        {
            let conn = cache.connection()?;
            for index in 0..(DQL_RESULT_LIMIT + 50) {
                conn.execute(
                    "INSERT INTO notes (id, vault_id, path, title, content_hash, modified_at, word_count)
                     VALUES (?1, 'vault-test', ?2, ?3, 'hash', '2026-01-01T00:00:00Z', 1)",
                    params![
                        format!("note-{index:04}"),
                        format!("notes/{index:04}.md"),
                        format!("Note {index}")
                    ],
                )?;
            }
        }

        let rows = path_matches(&cache, "vault-test", r"^notes/")?;
        assert_eq!(
            rows.len(),
            DQL_RESULT_LIMIT,
            "path matches must be bounded like its sibling clauses"
        );
        Ok(())
    }

    #[test]
    fn pathological_regex_returns_error_instead_of_exploding() -> Result<(), Box<dyn std::error::Error>> {
        let dir = tempfile::tempdir()?;
        let cache = IndexCache::open(dir.path().join("cache.sqlite"))?;
        let result = path_matches(&cache, "vault-test", "(?:(?:(?:a{100}){100}){100}){100}");
        assert!(matches!(result, Err(IndexerError::InvalidQuery(_))));
        Ok(())
    }
}
