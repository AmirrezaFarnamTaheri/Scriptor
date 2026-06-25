use rusqlite::params;
use serde::Serialize;

use crate::db::IndexCache;
use crate::error::IndexerError;

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
pub struct NoteIndexSummary {
    pub path: String,
    pub title: String,
    pub modified_at: String,
    pub note_type: Option<String>,
    pub organized: bool,
    pub archived: bool,
    pub tags: Vec<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum InboxPeriod {
    Week,
    Month,
    Quarter,
    All,
}

impl InboxPeriod {
    pub fn parse(raw: &str) -> Self {
        match raw {
            "week" => Self::Week,
            "month" => Self::Month,
            "quarter" => Self::Quarter,
            _ => Self::All,
        }
    }

    fn cutoff_rfc3339(self) -> Option<String> {
        let days = match self {
            Self::Week => 7,
            Self::Month => 30,
            Self::Quarter => 90,
            Self::All => return None,
        };
        let cutoff = chrono::Utc::now() - chrono::Duration::days(days);
        Some(cutoff.to_rfc3339())
    }
}

pub fn list_note_summaries(cache: &IndexCache, vault_id: &str) -> Result<Vec<NoteIndexSummary>, IndexerError> {
    let mut statement = cache.connection().prepare(
        "SELECT path, title, modified_at, note_type, organized, archived, tags_json
         FROM notes WHERE vault_id = ?1 ORDER BY modified_at DESC",
    )?;
    let mut rows = statement.query(params![vault_id])?;
    let mut output = Vec::new();
    while let Some(row) = rows.next()? {
        let tags_json: String = row.get(6)?;
        let tags: Vec<String> = serde_json::from_str(&tags_json).unwrap_or_default();
        let organized: i64 = row.get(4)?;
        let archived: i64 = row.get(5)?;
        output.push(NoteIndexSummary {
            path: row.get(0)?,
            title: row.get(1)?,
            modified_at: row.get(2)?,
            note_type: row.get(3)?,
            organized: organized != 0,
            archived: archived != 0,
            tags,
        });
    }
    Ok(output)
}

pub fn list_inbox_notes(
    cache: &IndexCache,
    vault_id: &str,
    period: InboxPeriod,
) -> Result<Vec<NoteIndexSummary>, IndexerError> {
    let summaries = list_note_summaries(cache, vault_id)?;
    let cutoff = period.cutoff_rfc3339();
    Ok(summaries
        .into_iter()
        .filter(|note| is_inbox_candidate(note))
        .filter(|note| {
            cutoff.as_ref().map_or(true, |cutoff_at| note.modified_at.as_str() >= cutoff_at.as_str())
        })
        .collect())
}

pub fn is_inbox_candidate(note: &NoteIndexSummary) -> bool {
    if note.archived {
        return false;
    }
    if note.note_type.as_deref() == Some("Type") {
        return false;
    }
    !note.organized
}
