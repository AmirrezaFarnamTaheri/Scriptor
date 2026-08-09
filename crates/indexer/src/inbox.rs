use chrono::{DateTime, Duration, Utc};
use rusqlite::params;
use serde::Serialize;

use crate::db::IndexCache;
use crate::error::IndexerError;

#[derive(Debug, Clone, Serialize, serde::Deserialize, PartialEq, Eq)]
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

    fn cutoff(self) -> Option<DateTime<Utc>> {
        let days = match self {
            Self::Week => 7,
            Self::Month => 30,
            Self::Quarter => 90,
            Self::All => return None,
        };
        Duration::try_days(days).map(|window| Utc::now() - window)
    }
}

/// Parse an RFC3339 timestamp into a UTC instant.
///
/// Stored timestamps may carry any UTC offset, so they cannot be compared as strings:
/// `2026-07-25T23:00:00-05:00` sorts before `2026-07-26T00:00:00Z` yet happens after it, and
/// `Z` never compares equal to `+00:00`.
fn parse_timestamp(raw: &str) -> Option<DateTime<Utc>> {
    DateTime::parse_from_rfc3339(raw)
        .ok()
        .map(|parsed| parsed.with_timezone(&Utc))
}

pub fn list_note_summaries(
    cache: &IndexCache,
    vault_id: &str,
) -> Result<Vec<NoteIndexSummary>, IndexerError> {
    let conn = cache.connection()?;
    let mut statement = conn.prepare(
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

    // `ORDER BY modified_at DESC` is a lexicographic sort over RFC3339 strings, which misorders
    // timestamps written with different UTC offsets. Re-sort on the parsed instant.
    output.sort_by(|left, right| {
        let left_at = parse_timestamp(&left.modified_at);
        let right_at = parse_timestamp(&right.modified_at);
        match (left_at, right_at) {
            // Newest first.
            (Some(left_at), Some(right_at)) => right_at.cmp(&left_at),
            // Unparseable timestamps sort last rather than jumping to the top.
            (Some(_), None) => std::cmp::Ordering::Less,
            (None, Some(_)) => std::cmp::Ordering::Greater,
            (None, None) => right.modified_at.cmp(&left.modified_at),
        }
        .then_with(|| left.path.cmp(&right.path))
    });

    Ok(output)
}

pub fn list_inbox_notes(
    cache: &IndexCache,
    vault_id: &str,
    period: InboxPeriod,
) -> Result<Vec<NoteIndexSummary>, IndexerError> {
    let summaries = list_note_summaries(cache, vault_id)?;
    Ok(filter_inbox_notes(summaries, period))
}

fn filter_inbox_notes(
    summaries: Vec<NoteIndexSummary>,
    period: InboxPeriod,
) -> Vec<NoteIndexSummary> {
    let cutoff = period.cutoff();
    summaries
        .into_iter()
        .filter(is_inbox_candidate)
        .filter(|note| {
            let Some(cutoff_at) = cutoff else {
                return true;
            };
            // Compare instants, never the raw strings; keep notes whose timestamp is unreadable
            // so a malformed value cannot silently hide a note from the inbox.
            parse_timestamp(&note.modified_at).is_none_or(|modified_at| modified_at >= cutoff_at)
        })
        .collect()
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

#[cfg(test)]
mod tests {
    use super::*;

    fn summary(path: &str, modified_at: &str) -> NoteIndexSummary {
        NoteIndexSummary {
            path: path.into(),
            title: path.into(),
            modified_at: modified_at.into(),
            note_type: None,
            organized: false,
            archived: false,
            tags: Vec::new(),
        }
    }

    #[test]
    fn cutoff_compares_instants_across_offsets() {
        let now = Utc::now();
        // Five days old, but written with a -05:00 offset so its string form sorts *before* a
        // cutoff rendered as UTC even though the instant is well inside the window.
        let recent = now - Duration::try_days(5).expect("valid window");
        let recent_local = recent.with_timezone(&chrono::FixedOffset::east_opt(-5 * 3600).unwrap());

        let old = now - Duration::try_days(40).expect("valid window");

        let notes = vec![
            summary("recent.md", &recent_local.to_rfc3339()),
            summary("old.md", &old.to_rfc3339()),
        ];

        let kept = filter_inbox_notes(notes, InboxPeriod::Week);
        assert_eq!(kept.len(), 1);
        assert_eq!(kept[0].path, "recent.md");
    }

    #[test]
    fn z_and_zero_offset_are_equivalent() {
        let now = Utc::now();
        let inside = now - Duration::try_hours(1).expect("valid window");
        let as_offset = inside
            .with_timezone(&chrono::FixedOffset::east_opt(0).unwrap())
            .to_rfc3339();
        assert!(as_offset.ends_with("+00:00"));

        let kept = filter_inbox_notes(vec![summary("a.md", &as_offset)], InboxPeriod::Week);
        assert_eq!(kept.len(), 1);
    }

    #[test]
    fn all_period_has_no_cutoff() {
        let kept = filter_inbox_notes(
            vec![summary("ancient.md", "1999-01-01T00:00:00Z")],
            InboxPeriod::All,
        );
        assert_eq!(kept.len(), 1);
    }

    #[test]
    fn unparseable_timestamps_are_not_dropped() {
        let kept = filter_inbox_notes(
            vec![summary("weird.md", "not-a-timestamp")],
            InboxPeriod::Week,
        );
        assert_eq!(kept.len(), 1);
    }
}
