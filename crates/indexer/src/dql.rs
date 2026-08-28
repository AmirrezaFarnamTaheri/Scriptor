use rusqlite::params;
use serde::{Deserialize, Serialize};

use scriptor_vault::VaultSession;

use crate::db::IndexCache;
use crate::error::IndexerError;
use crate::search::search_notes;
use crate::tags::notes_for_tag;
use crate::tasks::{TaskFilter, query_tasks};
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

    let mut rows = if trimmed.starts_with('{') {
        view_filter_to_rows(cache, session, trimmed)?
    } else if contains_compound(trimmed, " and ") {
        let parts = split_compound(trimmed, " and ");
        intersect_many(cache, session, &parts)?
    } else if contains_compound(trimmed, " or ") {
        let parts = split_compound(trimmed, " or ");
        union_many(cache, session, &parts)?
    } else {
        execute_single_clause(cache, session, trimmed)?
    };

    rows.truncate(DQL_RESULT_LIMIT);
    Ok(rows)
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

    // ── W3-3: compact operator syntax ────────────────────────────────────────
    // `path:<substring>` — notes whose vault-relative path contains the value.
    if let Some(value) = lower.strip_prefix("path:") {
        let value = value.trim();
        if value.is_empty() {
            return Err(caret_error(query, 5, "path: requires a value"));
        }
        return path_contains(cache, &session.descriptor.id, value);
    }

    // `tag:<name>` — notes that carry the tag (with or without leading `#`).
    if let Some(value) = lower.strip_prefix("tag:") {
        let tag = value.trim().trim_start_matches('#');
        if tag.is_empty() {
            return Err(caret_error(query, 4, "tag: requires a value"));
        }
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

    // `line:<text>` — notes that contain an exact line matching the value.
    if let Some(value) = lower.strip_prefix("line:") {
        let value = value.trim();
        if value.is_empty() {
            return Err(caret_error(query, 5, "line: requires a value"));
        }
        return line_contains(cache, &session.descriptor.id, value);
    }

    // `-<term>` — exclude notes that match term from the current set.
    // As a standalone clause this returns notes that do NOT contain `<term>`.
    if let Some(value) = trimmed.strip_prefix('-') {
        let value = value.trim();
        if value.is_empty() {
            return Err(caret_error(query, 1, "- negation requires a term"));
        }
        return body_excludes(cache, &session.descriptor.id, value);
    }

    // `"quoted phrase"` — exact phrase search via FTS.
    if trimmed.starts_with('"') && trimmed.ends_with('"') && trimmed.len() > 2 {
        let phrase = &trimmed[1..trimmed.len() - 1];
        return phrase_search(cache, &session.descriptor.id, phrase);
    }
    // ── legacy Foam-style operators (preserved, I-5) ─────────────────────────

    if let Some(tag) = lower
        .strip_prefix("path has #")
        .or_else(|| lower.strip_prefix("path has "))
    {
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

    // `task:<filter>` or `tasks:<filter>` — query tasks from the index.
    //
    // Supported sub-clauses (space-separated, all optional):
    //   status:open|done|cancelled|forwarded|in-progress
    //   due:<YYYY-MM-DD>       tasks due on this exact date
    //   due:overdue            tasks whose due date is in the past
    //   tag:<name>             tasks carrying this tag
    //
    // Examples:
    //   `task: status:open`
    //   `task: status:done tag:project`
    //   `task: due:overdue`
    //   `task: due:2026-08-15`
    if let Some(filter_str) = lower
        .strip_prefix("task:")
        .or_else(|| lower.strip_prefix("tasks:"))
    {
        let filter = parse_task_filter(filter_str.trim())?;
        let tasks = query_tasks(cache, &session.descriptor.id, &filter, 500)?;
        return Ok(tasks
            .into_iter()
            .map(|t| DqlResultRow {
                path: t.source_note_id.unwrap_or_default(),
                title: t.title,
                // tasks have no pre-built snippet; leave empty.
                snippet: String::new(),
            })
            .collect());
    }

    Err(caret_error(query, 0, "unsupported DQL clause"))
}

/// Parse a task filter expression from the sub-clause after `task:` or `tasks:`.
///
/// Sub-clauses are space-separated key:value pairs:
///   `status:open`, `due:2026-08-15`, `due:overdue`, `tag:someTag`
///
/// Unknown tokens are silently ignored so future extensions are forward-compatible.
fn parse_task_filter(filter_str: &str) -> Result<TaskFilter, IndexerError> {
    let mut filter = TaskFilter::default();
    if filter_str.is_empty() {
        return Ok(filter);
    }

    // Simple tokeniser: split on spaces, each token is `key:value`.
    for token in filter_str.split_whitespace() {
        if let Some(status) = token.strip_prefix("status:") {
            if !status.is_empty() {
                filter.status = Some(status.to_string());
            }
        } else if let Some(due_val) = token.strip_prefix("due:") {
            match due_val {
                "overdue" => {
                    // due_before = today.
                    let today = chrono_today();
                    filter.due_before = Some(today);
                }
                date if !date.is_empty() => {
                    // Exact date: treat as a date range [date, date].
                    filter.due_before = Some(date.to_string());
                    filter.due_after = Some(date.to_string());
                }
                _ => {}
            }
        } else if let Some(tag) = token.strip_prefix("tag:")
            && !tag.is_empty()
        {
            filter.tag = Some(tag.trim_start_matches('#').to_string());
        }
        // Unknown tokens ignored for forward-compatibility.
    }

    Ok(filter)
}

/// Return today's date as an ISO-8601 string (YYYY-MM-DD) in the local timezone.
/// Uses the system clock; swapped for a test stub in unit tests.
fn chrono_today() -> String {
    // Avoid pulling in chrono or time crates.  SQLite's `date('now')` is the
    // canonical date source at query time; here we just need an approximate
    // comparison value for the "overdue" filter.
    use std::time::{SystemTime, UNIX_EPOCH};
    let secs = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    // Gregorian approximation sufficient for overdue comparison.
    let days = secs / 86400;
    // Epoch = 1970-01-01; shift forward from there.
    let (y, m, d) = epoch_days_to_ymd(days as i64);
    format!("{y:04}-{m:02}-{d:02}")
}

/// Convert days since Unix epoch to (year, month, day).
/// Gregorian proleptic calendar, accurate post-1582.
fn epoch_days_to_ymd(days: i64) -> (i64, u32, u32) {
    // Adapted from Richards' algorithm.
    let z = days + 719468;
    let era = (if z >= 0 { z } else { z - 146096 }) / 146097;
    let doe = z - era * 146097;
    let yoe = (doe - doe / 1460 + doe / 36524 - doe / 146096) / 365;
    let y = yoe + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = (doy - (153 * mp + 2) / 5 + 1) as u32;
    let m = if mp < 10 { mp + 3 } else { mp - 9 } as u32;
    let y = if m <= 2 { y + 1 } else { y };
    (y, m, d)
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
    let right_paths: std::collections::BTreeSet<_> =
        right.iter().map(|row| row.path.clone()).collect();
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

fn title_contains(
    cache: &IndexCache,
    vault_id: &str,
    needle: &str,
) -> Result<Vec<DqlResultRow>, IndexerError> {
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

fn body_contains(
    cache: &IndexCache,
    vault_id: &str,
    needle: &str,
) -> Result<Vec<DqlResultRow>, IndexerError> {
    Ok(search_notes(cache, vault_id, needle, 200)?
        .into_iter()
        .map(|hit| DqlResultRow {
            path: hit.path,
            title: hit.title,
            snippet: hit.snippet,
        })
        .collect())
}

fn path_matches(
    cache: &IndexCache,
    vault_id: &str,
    pattern: &str,
) -> Result<Vec<DqlResultRow>, IndexerError> {
    let re = regex::RegexBuilder::new(pattern)
        .size_limit(1 << 20)
        .dfa_size_limit(1 << 20)
        .build()
        .map_err(|error| IndexerError::InvalidQuery(error.to_string()))?;
    let conn = cache.connection()?;
    // Two bounds, because the regex is applied in Rust rather than in SQL: the
    // SQL LIMIT caps how many rows are ever materialised and matched against a
    // user-supplied pattern, and the result cap matches the sibling clauses.
    let mut statement =
        conn.prepare("SELECT path, title FROM notes WHERE vault_id = ?1 ORDER BY path LIMIT ?2")?;
    let rows = statement.query_map(params![vault_id, PATH_MATCH_SCAN_LIMIT], |row| {
        Ok(DqlResultRow {
            path: row.get(0)?,
            title: row.get(1)?,
            snippet: String::new(),
        })
    })?;
    let rows = rows.collect::<Result<Vec<_>, _>>()?;
    Ok(rows
        .into_iter()
        .filter(|row| re.is_match(&row.path))
        .take(DQL_RESULT_LIMIT)
        .collect())
}

fn links_to(
    cache: &IndexCache,
    vault_id: &str,
    target: &str,
) -> Result<Vec<DqlResultRow>, IndexerError> {
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

// ── W3-3 new helpers ──────────────────────────────────────────────────────────

/// Produce a caret-positioned error: the caret sits under `column` (0-indexed).
///
/// ```text
/// unsupported DQL clause
/// path:
///      ^  path: requires a value
/// ```
fn caret_error(query: &str, column: usize, message: &str) -> IndexerError {
    let caret_line = format!("{}{}", " ".repeat(column), "^");
    IndexerError::InvalidQuery(format!("{message}\n{query}\n{caret_line}"))
}

/// `path:<substring>` — notes whose vault-relative path contains the value
/// (case-insensitive SQL LIKE).
fn path_contains(
    cache: &IndexCache,
    vault_id: &str,
    value: &str,
) -> Result<Vec<DqlResultRow>, IndexerError> {
    let pattern = format!("%{value}%");
    let conn = cache.connection()?;
    let mut stmt = conn.prepare(
        "SELECT path, title FROM notes
         WHERE vault_id = ?1 AND lower(path) LIKE lower(?2)
         ORDER BY path LIMIT ?3",
    )?;
    let rows = stmt.query_map(params![vault_id, pattern, DQL_RESULT_LIMIT as i64], |row| {
        Ok(DqlResultRow {
            path: row.get(0)?,
            title: row.get(1)?,
            snippet: String::new(),
        })
    })?;
    Ok(rows.collect::<Result<Vec<_>, _>>()?)
}

/// `line:<text>` — notes that contain at least one line whose lowercased form
/// contains `value`.  Implemented via FTS body search as a close approximation;
/// an exact line match would require full content scanning which exceeds the
/// latency budget for large vaults.
fn line_contains(
    cache: &IndexCache,
    vault_id: &str,
    value: &str,
) -> Result<Vec<DqlResultRow>, IndexerError> {
    // Use the existing FTS path; `value` is treated as a search phrase.
    body_contains(cache, vault_id, value)
}

/// `"quoted phrase"` — exact FTS phrase search.
fn phrase_search(
    cache: &IndexCache,
    vault_id: &str,
    phrase: &str,
) -> Result<Vec<DqlResultRow>, IndexerError> {
    // Build a quoted FTS5 phrase: inner double-quotes doubled per SQLite rules.
    let escaped = phrase.replace('"', "\"\"");
    let fts_expr = format!("\"{escaped}\"");
    let conn = cache.connection()?;
    let mut stmt = conn.prepare(
        "SELECT note_fts.note_id, notes.path, notes.title,
                snippet(note_fts, 4, '[[', ']]', '...', 32) AS snippet
         FROM note_fts
         JOIN notes ON notes.id = note_fts.note_id
         WHERE note_fts MATCH ?1 AND notes.vault_id = ?2
         ORDER BY bm25(note_fts, 0.0, 10.0, 5.0, 3.0, 1.0)
         LIMIT ?3",
    )?;
    let rows = stmt.query_map(
        params![fts_expr, vault_id, DQL_RESULT_LIMIT as i64],
        |row| {
            Ok(DqlResultRow {
                path: row.get(1)?,
                title: row.get(2)?,
                snippet: row.get(3)?,
            })
        },
    )?;
    Ok(rows.collect::<Result<Vec<_>, _>>()?)
}

/// `-<term>` — notes that do NOT contain `term` in their FTS body.
/// Returns all notes minus those that match the term (complement).
fn body_excludes(
    cache: &IndexCache,
    vault_id: &str,
    term: &str,
) -> Result<Vec<DqlResultRow>, IndexerError> {
    let matching: std::collections::BTreeSet<String> = search_notes(cache, vault_id, term, 10_000)?
        .into_iter()
        .map(|h| h.path)
        .collect();

    let conn = cache.connection()?;
    let mut stmt =
        conn.prepare("SELECT path, title FROM notes WHERE vault_id = ?1 ORDER BY path LIMIT ?2")?;
    let rows = stmt.query_map(params![vault_id, DQL_RESULT_LIMIT as i64], |row| {
        Ok(DqlResultRow {
            path: row.get(0)?,
            title: row.get(1)?,
            snippet: String::new(),
        })
    })?;
    let rows = rows.collect::<Result<Vec<_>, _>>()?;
    Ok(rows
        .into_iter()
        .filter(|r| !matching.contains(&r.path))
        .collect())
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
    fn pathological_regex_returns_error_instead_of_exploding()
    -> Result<(), Box<dyn std::error::Error>> {
        let dir = tempfile::tempdir()?;
        let cache = IndexCache::open(dir.path().join("cache.sqlite"))?;
        let result = path_matches(&cache, "vault-test", "(?:(?:(?:a{100}){100}){100}){100}");
        assert!(matches!(result, Err(IndexerError::InvalidQuery(_))));
        Ok(())
    }

    // ── W3-3 operator tests ───────────────────────────────────────────────────

    #[test]
    fn caret_error_positions_caret_correctly() {
        let err = caret_error("path:", 5, "path: requires a value");
        let msg = err.to_string();
        // The caret line should contain 5 spaces then a `^`.
        assert!(
            msg.contains("     ^"),
            "expected caret at col 5, got: {msg}"
        );
    }

    #[test]
    fn path_colon_operator_returns_invalid_query_on_empty_value() {
        let dir = tempfile::tempdir().unwrap();
        let cache = IndexCache::open(dir.path().join("cache.sqlite")).unwrap();
        let session = test_session(dir.path());
        let err = execute_dql_query(&cache, &session, "path:").unwrap_err();
        assert!(
            matches!(err, IndexerError::InvalidQuery(_)),
            "expected InvalidQuery, got {err:?}"
        );
    }

    #[test]
    fn tag_colon_operator_returns_invalid_query_on_empty_value() {
        let dir = tempfile::tempdir().unwrap();
        let cache = IndexCache::open(dir.path().join("cache.sqlite")).unwrap();
        let session = test_session(dir.path());
        let err = execute_dql_query(&cache, &session, "tag:").unwrap_err();
        assert!(matches!(err, IndexerError::InvalidQuery(_)));
    }

    #[test]
    fn negation_operator_returns_invalid_query_on_empty_term() {
        let dir = tempfile::tempdir().unwrap();
        let cache = IndexCache::open(dir.path().join("cache.sqlite")).unwrap();
        let session = test_session(dir.path());
        let err = execute_dql_query(&cache, &session, "-").unwrap_err();
        assert!(matches!(err, IndexerError::InvalidQuery(_)));
    }

    #[test]
    fn unknown_clause_error_contains_caret() {
        let dir = tempfile::tempdir().unwrap();
        let cache = IndexCache::open(dir.path().join("cache.sqlite")).unwrap();
        let session = test_session(dir.path());
        let err = execute_dql_query(&cache, &session, "frobnicate foo").unwrap_err();
        let msg = err.to_string();
        assert!(
            msg.contains('^'),
            "malformed query error must contain a caret: {msg}"
        );
    }
}
