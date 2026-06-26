use rusqlite::params;

use crate::db::IndexCache;
use crate::error::IndexerError;
use crate::parse::ParsedCitation;

#[derive(Debug, Clone, Default, serde::Serialize, serde::Deserialize, PartialEq, Eq)]
pub struct CitationValidationSummary {
    pub total: u32,
    pub resolved: u32,
    pub unresolved: u32,
}

impl CitationValidationSummary {
    pub fn merge(&mut self, other: Self) {
        self.total += other.total;
        self.resolved += other.resolved;
        self.unresolved += other.unresolved;
    }
}

pub fn register_bibliography_keys(cache: &IndexCache, keys: &[&str]) -> Result<(), IndexerError> {
    let conn = cache.connection()?;
    for key in keys {
        conn.execute(
            "INSERT OR IGNORE INTO cache_meta(key, value) VALUES (?1, 'bib')",
            params![format!("bib:{key}")],
        )?;
    }
    Ok(())
}

pub fn validate_citations(
    cache: &IndexCache,
    note_id: &str,
    citations: &[ParsedCitation],
) -> Result<CitationValidationSummary, IndexerError> {
    let mut summary = CitationValidationSummary {
        total: citations.len() as u32,
        resolved: 0,
        unresolved: 0,
    };

    let conn = cache.connection()?;
    conn.execute("DELETE FROM citation_refs WHERE note_id = ?1", params![note_id])?;

    for citation in citations {
        let valid = bibliography_contains(cache, &citation.key)?;
        if valid {
            summary.resolved += 1;
        } else {
            summary.unresolved += 1;
        }

        conn.execute(
            "INSERT INTO citation_refs(id, note_id, key, line, valid)
             VALUES (?1, ?2, ?3, ?4, ?5)",
            params![
                format!("{note_id}:{}:{}", citation.line, citation.key),
                note_id,
                citation.key,
                citation.line,
                if valid { 1 } else { 0 }
            ],
        )?;
    }

    Ok(summary)
}

fn bibliography_contains(cache: &IndexCache, key: &str) -> Result<bool, IndexerError> {
    bibliography_contains_public(cache, key)
}

pub(crate) fn bibliography_contains_public(cache: &IndexCache, key: &str) -> Result<bool, IndexerError> {
    let conn = cache.connection()?;
    let count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM cache_meta WHERE key = ?1",
        params![format!("bib:{key}")],
        |row| row.get(0),
    )?;
    Ok(count > 0)
}
