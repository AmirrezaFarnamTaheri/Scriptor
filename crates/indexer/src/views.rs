use rusqlite::types::Value;
use serde::{Deserialize, Serialize};

use scriptor_vault::{
    NoteMetadata, VaultSession, ViewFilter, ViewFilterCondition, ViewFilterNode, ViewFilterOp,
    ViewNoteMetadata, evaluate_view_filter,
};

use crate::db::IndexCache;
use crate::error::IndexerError;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ViewNoteHit {
    pub path: String,
    pub title: String,
}

pub fn evaluate_view_filter_json(
    filter_json: &str,
    note: &NoteMetadata,
) -> Result<bool, IndexerError> {
    let filter: ViewFilter = serde_json::from_str(filter_json).map_err(|error| {
        IndexerError::InvalidQuery(format!("invalid view filter JSON: {error}"))
    })?;
    Ok(evaluate_view_filter(&filter, &ViewNoteMetadata::from(note)))
}

pub fn list_view_notes(
    cache: &IndexCache,
    session: &VaultSession,
    filter_json: &str,
) -> Result<Vec<ViewNoteHit>, IndexerError> {
    list_view_notes_inner(cache, session, filter_json, None, None)
}

/// MAT-009: return at most 201 filtered hits in deterministic index path order.
/// The final hit is used as a look-ahead, not a UI result. Cursor pagination
/// is scoped to a stable index; callers must reload when index data changes.
pub fn list_view_notes_page(
    cache: &IndexCache,
    session: &VaultSession,
    filter_json: &str,
    after_path: Option<&str>,
    page_size: usize,
) -> Result<Vec<ViewNoteHit>, IndexerError> {
    if !(1..=201).contains(&page_size) {
        return Err(IndexerError::InvalidQuery(
            "database view page size must be between 1 and 201".into(),
        ));
    }
    if after_path.is_some_and(|path| path.is_empty() || path.len() > 4096) {
        return Err(IndexerError::InvalidQuery(
            "invalid database view cursor".into(),
        ));
    }
    list_view_notes_inner(cache, session, filter_json, after_path, Some(page_size))
}

fn list_view_notes_inner(
    cache: &IndexCache,
    session: &VaultSession,
    filter_json: &str,
    after_path: Option<&str>,
    limit: Option<usize>,
) -> Result<Vec<ViewNoteHit>, IndexerError> {
    let filter: ViewFilter = serde_json::from_str(filter_json).map_err(|error| {
        IndexerError::InvalidQuery(format!("invalid view filter JSON: {error}"))
    })?;

    let conn = cache.connection()?;
    let mut sql = String::from(
        "SELECT id, path, title, modified_at, tags_json, note_type, organized, archived \
         FROM notes WHERE vault_id = ?",
    );
    let mut values = vec![Value::Text(session.descriptor.id.clone())];
    if let Some((predicate, mut predicate_values)) = view_sql_prefilter(&filter) {
        sql.push_str(" AND (");
        sql.push_str(&predicate);
        sql.push(')');
        values.append(&mut predicate_values);
    }
    if let Some(cursor) = after_path {
        // Parameterized path keyset pagination uses the same binary collation
        // and ORDER BY as the indexed query; never apply LIMIT before the
        // authoritative Rust filter, which would drop matching notes.
        sql.push_str(" AND path > ?");
        values.push(Value::Text(cursor.to_owned()));
    }
    sql.push_str(" ORDER BY path");

    let mut statement = conn.prepare_cached(&sql)?;
    let rows = statement.query_map(rusqlite::params_from_iter(values.iter()), |row| {
        Ok((
            row.get::<_, String>(0)?,
            row.get::<_, String>(1)?,
            row.get::<_, String>(2)?,
            row.get::<_, String>(3)?,
            row.get::<_, String>(4)?,
            row.get::<_, Option<String>>(5)?,
            row.get::<_, i64>(6)?,
            row.get::<_, i64>(7)?,
        ))
    })?;

    let mut hits = Vec::new();
    for row in rows {
        let (id, path, title, modified_at, tags_json, note_type, organized, archived) = row?;
        let tags: Vec<String> = serde_json::from_str(&tags_json)?;
        let metadata = NoteMetadata {
            id,
            vault_id: session.descriptor.id.clone(),
            path,
            title,
            content_hash: String::new(),
            modified_at,
            word_count: 0,
            reading_time_minutes: 0,
            tags,
            note_type,
            organized: organized != 0,
            archived: archived != 0,
        };
        if evaluate_view_filter(&filter, &ViewNoteMetadata::from(&metadata)) {
            hits.push(ViewNoteHit {
                path: metadata.path,
                title: metadata.title,
            });
            if limit.is_some_and(|max| hits.len() >= max) {
                break;
            }
        }
    }

    Ok(hits)
}

fn view_sql_prefilter(filter: &ViewFilter) -> Option<(String, Vec<Value>)> {
    match filter {
        ViewFilter::All(nodes) => {
            let mut predicates = Vec::new();
            let mut values = Vec::new();
            for node in nodes {
                if let Some((predicate, mut node_values)) = view_node_sql_prefilter(node) {
                    predicates.push(format!("({predicate})"));
                    values.append(&mut node_values);
                }
            }
            (!predicates.is_empty()).then(|| (predicates.join(" AND "), values))
        }
        ViewFilter::Any(nodes) => {
            // For OR, dropping an unsupported branch would create false
            // negatives. Only push the group when every branch has a safe SQL
            // superset predicate; exact semantics are still rechecked in Rust.
            let mut predicates = Vec::new();
            let mut values = Vec::new();
            for node in nodes {
                let (predicate, mut node_values) = view_node_sql_prefilter(node)?;
                predicates.push(format!("({predicate})"));
                values.append(&mut node_values);
            }
            (!predicates.is_empty()).then(|| (predicates.join(" OR "), values))
        }
    }
}

fn view_node_sql_prefilter(node: &ViewFilterNode) -> Option<(String, Vec<Value>)> {
    match node {
        ViewFilterNode::Condition(condition) => view_condition_sql_prefilter(condition),
        ViewFilterNode::Group(group) => view_sql_prefilter(group),
    }
}

fn view_condition_sql_prefilter(condition: &ViewFilterCondition) -> Option<(String, Vec<Value>)> {
    let scalar = || match &condition.value {
        Some(serde_json::Value::String(value)) => Some(value.clone()),
        Some(serde_json::Value::Number(value)) => Some(value.to_string()),
        Some(value) if !value.is_null() => Some(value.to_string()),
        _ => None,
    };

    match condition.op {
        ViewFilterOp::InInbox => Some((
            "archived = 0 AND organized = 0 AND (note_type IS NULL OR note_type != 'Type')".into(),
            Vec::new(),
        )),
        ViewFilterOp::OrganizedIs => {
            let value = scalar()?;
            let expected = matches!(value.to_lowercase().as_str(), "true" | "yes" | "1");
            Some((
                "organized = ?".into(),
                vec![Value::Integer(i64::from(expected))],
            ))
        }
        ViewFilterOp::TypeEquals => {
            let value = scalar()?;
            value.is_ascii().then(|| {
                (
                    "note_type = ? COLLATE NOCASE".into(),
                    vec![Value::Text(value)],
                )
            })
        }
        ViewFilterOp::TagHas => {
            let value = scalar()?.trim_start_matches('#').to_string();
            value.is_ascii().then(|| {
                (
                    "json_valid(tags_json) AND EXISTS (SELECT 1 FROM json_each(tags_json) WHERE value = ? COLLATE NOCASE)".into(),
                    vec![Value::Text(value)],
                )
            })
        }
        // SQLite LIKE/NOCASE fold only ASCII, but the Rust TitleContains
        // evaluator lowercases Unicode. A SQL prefilter for "kelvin" would
        // otherwise drop a title beginning with the Kelvin sign (K).
        // Preserve exact native semantics; safe All-group predicates can
        // still reduce the candidate set before Rust evaluation.
        ViewFilterOp::TitleContains => None,
        ViewFilterOp::PathMatches | ViewFilterOp::ModifiedWithinDays => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::Utc;
    use scriptor_vault::open_vault;
    use tempfile::tempdir;

    #[test]
    fn evaluates_filter_from_json_for_note_metadata() {
        let filter_json = r#"{"all":[{"op":"title contains","value":"plan"}]}"#;
        let metadata = NoteMetadata {
            id: "v:plan.md".into(),
            vault_id: "v".into(),
            path: "plan.md".into(),
            title: "Research plan".into(),
            content_hash: String::new(),
            modified_at: Utc::now().to_rfc3339(),
            word_count: 0,
            reading_time_minutes: 0,
            tags: vec![],
            note_type: None,
            organized: false,
            archived: false,
        };
        assert!(evaluate_view_filter_json(filter_json, &metadata).unwrap());
    }

    #[test]
    fn any_group_with_regex_does_not_build_an_incomplete_sql_prefilter() {
        let filter: ViewFilter = serde_json::from_value(serde_json::json!({
            "any": [
                { "op": "path matches", "value": "^daily/" },
                { "op": "organized is", "value": true }
            ]
        }))
        .unwrap();
        assert!(view_sql_prefilter(&filter).is_none());
    }

    #[test]
    fn all_group_pushes_safe_subset_predicates() {
        let filter: ViewFilter = serde_json::from_value(serde_json::json!({
            "all": [
                { "op": "path matches", "value": "^daily/" },
                { "op": "in inbox" }
            ]
        }))
        .unwrap();
        let (sql, _values) = view_sql_prefilter(&filter).expect("safe conjunctive subset");
        assert!(sql.contains("archived = 0"));
    }

    #[test]
    fn lists_view_notes_from_cache() {
        let dir = tempdir().unwrap();
        std::fs::write(dir.path().join("match.md"), "# Match plan\n").unwrap();
        std::fs::write(dir.path().join("skip.md"), "# Skip\n").unwrap();
        let session = open_vault(dir.path()).unwrap();
        let cache = crate::rebuild::open_cache_for_session(&session).unwrap();
        rebuild_for_test(&cache, &session).unwrap();

        let filter_json = r#"{"all":[{"op":"title contains","value":"plan"}]}"#;
        let hits = list_view_notes(&cache, &session, filter_json).unwrap();
        assert_eq!(hits.len(), 1);
        assert_eq!(hits[0].path, "match.md");
    }

    #[test]
    fn page_cursor_walks_filtered_notes_in_index_order_without_duplication() {
        let dir = tempdir().unwrap();
        for idx in 0..5 {
            std::fs::write(
                dir.path().join(format!("page-{idx:02}.md")),
                format!("# Page {idx:02}\n"),
            )
            .unwrap();
        }
        std::fs::write(dir.path().join("unrelated.md"), "# Unrelated\n").unwrap();
        let session = open_vault(dir.path()).unwrap();
        let cache = crate::rebuild::open_cache_for_session(&session).unwrap();
        rebuild_for_test(&cache, &session).unwrap();

        let filter_json = r#"{"all":[{"op":"title contains","value":"page"}]}"#;
        let first = list_view_notes_page(&cache, &session, filter_json, None, 2).unwrap();
        assert_eq!(
            first
                .iter()
                .map(|hit| hit.path.as_str())
                .collect::<Vec<_>>(),
            vec!["page-00.md", "page-01.md"],
        );
        let second =
            list_view_notes_page(&cache, &session, filter_json, Some(&first[1].path), 2).unwrap();
        assert_eq!(
            second
                .iter()
                .map(|hit| hit.path.as_str())
                .collect::<Vec<_>>(),
            vec!["page-02.md", "page-03.md"],
        );
        let third =
            list_view_notes_page(&cache, &session, filter_json, Some(&second[1].path), 2).unwrap();
        assert_eq!(third.len(), 1);
        assert_eq!(third[0].path, "page-04.md");
        assert!(
            list_view_notes_page(&cache, &session, filter_json, Some(&third[0].path), 2,)
                .unwrap()
                .is_empty()
        );
    }

    #[test]
    fn indexed_page_cursor_walks_25k_note_metadata_without_duplicates_or_drops() {
        // Fast deterministic index fixture: create metadata directly in SQLite.
        // This does not claim 25k filesystem note reads, export, or UI latency.
        let dir = tempdir().unwrap();
        let session = open_vault(dir.path()).unwrap();
        let cache = crate::rebuild::open_cache_for_session(&session).unwrap();
        {
            let mut conn = cache.connection().unwrap();
            let transaction = conn.transaction().unwrap();
            {
                let mut insert = transaction
                    .prepare(
                        "INSERT INTO notes
                         (id, vault_id, path, title, content_hash, modified_at, word_count)
                         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
                    )
                    .unwrap();
                for number in 0..25_000 {
                    insert
                        .execute(rusqlite::params![
                            format!("fixture-{number:05}"),
                            &session.descriptor.id,
                            format!("notes/{number:05}.md"),
                            "Target note",
                            "fixture-hash",
                            "2026-11-01T00:00:00Z",
                            0_i64,
                        ])
                        .unwrap();
                }
            }
            transaction.commit().unwrap();
        }

        let filter = r#"{"all":[{"op":"title contains","value":"Target"}]}"#;
        let mut last_path: Option<String> = None;
        let mut visited = 0;
        loop {
            let page =
                list_view_notes_page(&cache, &session, filter, last_path.as_deref(), 201).unwrap();
            assert!(page.len() <= 201);
            if page.is_empty() {
                break;
            }
            for hit in page {
                if let Some(ref previous) = last_path {
                    assert!(
                        previous < &hit.path,
                        "index cursor returned an out-of-order or repeated path"
                    );
                }
                last_path = Some(hit.path);
                visited += 1;
            }
        }
        assert_eq!(visited, 25_000);
        assert_eq!(last_path.as_deref(), Some("notes/24999.md"));
    }

    #[test]
    fn unicode_title_contains_survives_native_index_pagination() {
        let dir = tempdir().unwrap();
        let session = open_vault(dir.path()).unwrap();
        let cache = crate::rebuild::open_cache_for_session(&session).unwrap();
        {
            let conn = cache.connection().unwrap();
            conn.execute(
                "INSERT INTO notes
                 (id, vault_id, path, title, content_hash, modified_at, word_count)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
                rusqlite::params![
                    "unicode-note",
                    &session.descriptor.id,
                    "unicode.md",
                    "Kelvin",
                    "fixture-hash",
                    "2026-11-01T00:00:00Z",
                    0_i64,
                ],
            )
            .unwrap();
        }
        // Rust's Unicode lowercase matches K -> k; SQLite LIKE does not.
        let filter = r#"{"all":[{"op":"title contains","value":"kelvin"}]}"#;
        let hits = list_view_notes_page(&cache, &session, filter, None, 201).unwrap();
        assert_eq!(hits.len(), 1);
        assert_eq!(hits[0].path, "unicode.md");
    }

    #[test]
    fn view_pages_reject_invalid_sizes_and_cursors() {
        let dir = tempdir().unwrap();
        let session = open_vault(dir.path()).unwrap();
        let cache = crate::rebuild::open_cache_for_session(&session).unwrap();
        let filter_json = r#"{"all":[{"op":"title contains","value":""}]}"#;
        assert!(list_view_notes_page(&cache, &session, filter_json, None, 0).is_err());
        assert!(list_view_notes_page(&cache, &session, filter_json, None, 202).is_err());
        assert!(list_view_notes_page(&cache, &session, filter_json, Some(""), 2).is_err());
    }

    fn rebuild_for_test(cache: &IndexCache, session: &VaultSession) -> Result<(), IndexerError> {
        crate::rebuild::rebuild_index(session, &[])?;
        let _ = cache;
        Ok(())
    }
}
