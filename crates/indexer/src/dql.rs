use rusqlite::params;
use serde::{Deserialize, Serialize};

use scriptor_vault::VaultSession;

use crate::db::IndexCache;
use crate::error::IndexerError;
use crate::search::search_notes;
use crate::tags::notes_for_tag;
use crate::views::list_view_notes;

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
    if value.starts_with('"') {
        let end = value[1..].find('"')?;
        return Some(value[1..1 + end].to_string());
    }
    if value.starts_with('\'') {
        let end = value[1..].find('\'')?;
        return Some(value[1..1 + end].to_string());
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
    let lower = query.to_ascii_lowercase();
    let op_lower = op.to_ascii_lowercase();
    let chars: Vec<char> = query.chars().collect();
    let mut index = 0;

    while index < chars.len() {
        let ch = chars[index];
        if ch == '"' {
            in_quotes = !in_quotes;
            current.push(ch);
            index += 1;
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
        index += 1;
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
    if rest.starts_with('"') {
        let end = rest[1..].find('"')?;
        return Some(rest[1..1 + end].to_string());
    }
    if rest.starts_with('\'') {
        let end = rest[1..].find('\'')?;
        return Some(rest[1..1 + end].to_string());
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
    let mut statement = cache.connection().prepare(
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
    let re = regex::Regex::new(pattern).map_err(|error| IndexerError::InvalidQuery(error.to_string()))?;
    let mut statement = cache.connection().prepare(
        "SELECT path, title FROM notes WHERE vault_id = ?1 ORDER BY path",
    )?;
    let rows = statement.query_map(params![vault_id], |row| {
        Ok(DqlResultRow {
            path: row.get(0)?,
            title: row.get(1)?,
            snippet: String::new(),
        })
    })?;
    Ok(rows
        .filter_map(|row| row.ok())
        .filter(|row| re.is_match(&row.path))
        .collect())
}

fn links_to(cache: &IndexCache, vault_id: &str, target: &str) -> Result<Vec<DqlResultRow>, IndexerError> {
    let pattern = format!("%{target}%");
    let mut statement = cache.connection().prepare(
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
}
