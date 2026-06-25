use serde::{Deserialize, Serialize};

use scriptor_vault::{evaluate_view_filter, NoteMetadata, ViewFilter, ViewNoteMetadata, VaultSession};

use crate::db::IndexCache;
use crate::error::IndexerError;
use crate::parse::parse_note_markdown;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ViewNoteHit {
    pub path: String,
    pub title: String,
}

pub fn evaluate_view_filter_json(filter_json: &str, note: &NoteMetadata) -> Result<bool, IndexerError> {
    let filter: ViewFilter = serde_json::from_str(filter_json)
        .map_err(|error| IndexerError::InvalidQuery(format!("invalid view filter JSON: {error}")))?;
    Ok(evaluate_view_filter(&filter, &ViewNoteMetadata::from(note)))
}

pub fn list_view_notes(
    cache: &IndexCache,
    session: &VaultSession,
    filter_json: &str,
) -> Result<Vec<ViewNoteHit>, IndexerError> {
    let filter: ViewFilter = serde_json::from_str(filter_json)
        .map_err(|error| IndexerError::InvalidQuery(format!("invalid view filter JSON: {error}")))?;

    let mut statement = cache.connection().prepare(
        "SELECT path, title, modified_at, tags_json, note_type, organized, archived FROM notes WHERE vault_id = ?1 ORDER BY path",
    )?;
    let rows = statement.query_map(rusqlite::params![session.descriptor.id], |row| {
        Ok((
            row.get::<_, String>(0)?,
            row.get::<_, String>(1)?,
            row.get::<_, String>(2)?,
            row.get::<_, String>(3)?,
            row.get::<_, Option<String>>(4)?,
            row.get::<_, i64>(5)?,
            row.get::<_, i64>(6)?,
        ))
    })?;

    let mut hits = Vec::new();
    for row in rows {
        let (path, title, modified_at, tags_json, note_type, organized, archived) = row?;
        let tags: Vec<String> = serde_json::from_str(&tags_json).unwrap_or_default();
        let metadata = NoteMetadata {
            id: format!("{}:{path}", session.descriptor.id),
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
        }
    }

    Ok(hits)
}

pub fn note_metadata_matches_view(markdown_path: &str, markdown: &str, filter: &ViewFilter) -> bool {
    let parsed = parse_note_markdown(markdown_path, markdown);
    let metadata = ViewNoteMetadata {
        path: markdown_path,
        title: &parsed.title,
        tags: &parsed.tags,
        modified_at: "",
        note_type: parsed.note_type.as_deref(),
        organized: parsed.organized,
        archived: parsed.archived,
    };
    evaluate_view_filter(filter, &metadata)
}

#[cfg(test)]
mod tests {
    use super::*;
    use scriptor_vault::{open_vault, ViewFilterOp};
    use chrono::Utc;
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
    fn matches_markdown_without_index_row() {
        let filter = ViewFilter::All(vec![scriptor_vault::ViewFilterNode::Condition(
            scriptor_vault::ViewFilterCondition {
                op: ViewFilterOp::TagHas,
                value: Some(serde_json::json!("project")),
            },
        )]);
        let markdown = "# Title\n\nTagged #project\n";
        assert!(note_metadata_matches_view("x.md", markdown, &filter));
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

    fn rebuild_for_test(cache: &IndexCache, session: &VaultSession) -> Result<(), IndexerError> {
        crate::rebuild::rebuild_index(session, &[])?;
        let _ = cache;
        Ok(())
    }
}
