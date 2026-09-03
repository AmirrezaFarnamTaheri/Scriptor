use std::collections::BTreeSet;

use rusqlite::{Connection, params};

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
    let transaction = conn.unchecked_transaction()?;
    register_bibliography_keys_on(&transaction, keys)?;
    transaction.commit()?;
    Ok(())
}

/// Register bibliography keys on a caller-supplied connection.
///
/// Callers that already hold a pooled connection must use this instead of
/// [`register_bibliography_keys`]: checking out a second connection while holding the first can
/// exhaust the pool and deadlock every worker.
pub(crate) fn register_bibliography_keys_on(
    connection: &Connection,
    keys: &[&str],
) -> Result<(), IndexerError> {
    let mut statement =
        connection.prepare("INSERT OR IGNORE INTO cache_meta(key, value) VALUES (?1, 'bib')")?;
    for key in keys {
        statement.execute(params![format!("bib:{key}")])?;
    }
    Ok(())
}

pub fn validate_citations(
    cache: &IndexCache,
    note_id: &str,
    citations: &[ParsedCitation],
) -> Result<CitationValidationSummary, IndexerError> {
    let conn = cache.connection()?;
    validate_citations_on(&conn, note_id, citations)
}

/// Rewrite the citation rows for one note using a single connection and a single transaction.
pub(crate) fn validate_citations_on(
    connection: &Connection,
    note_id: &str,
    citations: &[ParsedCitation],
) -> Result<CitationValidationSummary, IndexerError> {
    let mut summary = CitationValidationSummary {
        total: citations.len() as u32,
        resolved: 0,
        unresolved: 0,
    };

    // One batched lookup instead of a query per citation, and no second pooled connection.
    let known = known_bibliography_keys_on(
        connection,
        &citations
            .iter()
            .map(|citation| citation.key.clone())
            .collect::<BTreeSet<_>>(),
    )?;

    let transaction = connection.unchecked_transaction()?;
    transaction.execute(
        "DELETE FROM citation_refs WHERE note_id = ?1",
        params![note_id],
    )?;

    {
        let mut insert = transaction.prepare(
            "INSERT OR REPLACE INTO citation_refs(id, note_id, key, line, valid)
             VALUES (?1, ?2, ?3, ?4, ?5)",
        )?;
        for (ordinal, citation) in citations.iter().enumerate() {
            let valid = known.contains(&citation.key);
            if valid {
                summary.resolved += 1;
            } else {
                summary.unresolved += 1;
            }

            // The ordinal keeps the primary key unique when the same key appears twice on one
            // line, which would otherwise abort the rewrite after the rows were already deleted.
            insert.execute(params![
                format!("{note_id}:{}:{ordinal}:{}", citation.line, citation.key),
                note_id,
                citation.key,
                citation.line,
                i64::from(valid)
            ])?;
        }
    }

    transaction.commit()?;
    Ok(summary)
}

/// Return the subset of `keys` that have a bibliography entry, in one query.
pub(crate) fn known_bibliography_keys_on(
    connection: &Connection,
    keys: &BTreeSet<String>,
) -> Result<BTreeSet<String>, IndexerError> {
    if keys.is_empty() {
        return Ok(BTreeSet::new());
    }

    let mut found = BTreeSet::new();
    // SQLite caps the number of bound parameters, so look the keys up in chunks.
    let lookup: Vec<String> = keys.iter().map(|key| format!("bib:{key}")).collect();
    for chunk in lookup.chunks(500) {
        let placeholders = vec!["?"; chunk.len()].join(",");
        let sql = format!("SELECT key FROM cache_meta WHERE key IN ({placeholders})");
        let mut statement = connection.prepare(&sql)?;
        let rows = statement.query_map(rusqlite::params_from_iter(chunk), |row| {
            row.get::<_, String>(0)
        })?;
        for row in rows {
            if let Some(key) = row?.strip_prefix("bib:") {
                found.insert(key.to_string());
            }
        }
    }
    Ok(found)
}


pub(crate) fn known_bibliography_keys_for_cache(
    cache: &IndexCache,
    keys: &BTreeSet<String>,
) -> Result<BTreeSet<String>, IndexerError> {
    let connection = cache.connection()?;
    known_bibliography_keys_on(&connection, keys)
}

pub(crate) fn bibliography_contains_public(
    cache: &IndexCache,
    key: &str,
) -> Result<bool, IndexerError> {
    let connection = cache.connection()?;
    let count: i64 = connection.query_row(
        "SELECT COUNT(*) FROM cache_meta WHERE key = ?1",
        params![format!("bib:{key}")],
        |row| row.get(0),
    )?;
    Ok(count > 0)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::schema::apply_schema;

    fn cache_connection() -> Connection {
        let connection = Connection::open_in_memory().expect("open in-memory cache");
        apply_schema(&connection).expect("apply schema");
        connection
    }

    #[test]
    fn duplicate_citation_keys_on_one_line_are_stored() {
        let connection = cache_connection();
        register_bibliography_keys_on(&connection, &["known"]).expect("register keys");

        let citations = vec![
            ParsedCitation {
                key: "known".into(),
                line: 3,
            },
            ParsedCitation {
                key: "known".into(),
                line: 3,
            },
            ParsedCitation {
                key: "missing".into(),
                line: 3,
            },
        ];

        let summary = validate_citations_on(&connection, "note", &citations).expect("validate");
        assert_eq!(summary.total, 3);
        assert_eq!(summary.resolved, 2);
        assert_eq!(summary.unresolved, 1);

        let stored: i64 = connection
            .query_row(
                "SELECT COUNT(*) FROM citation_refs WHERE note_id = 'note'",
                [],
                |row| row.get(0),
            )
            .expect("count");
        assert_eq!(stored, 3);
    }

    #[test]
    fn revalidating_replaces_rather_than_accumulates() {
        let connection = cache_connection();
        let citations = vec![
            ParsedCitation {
                key: "a".into(),
                line: 1,
            },
            ParsedCitation {
                key: "a".into(),
                line: 1,
            },
        ];

        validate_citations_on(&connection, "note", &citations).expect("first pass");
        validate_citations_on(&connection, "note", &citations).expect("second pass");

        let stored: i64 = connection
            .query_row(
                "SELECT COUNT(*) FROM citation_refs WHERE note_id = 'note'",
                [],
                |row| row.get(0),
            )
            .expect("count");
        assert_eq!(stored, 2);
    }

    #[test]
    fn validate_citations_uses_a_single_pooled_connection() {
        // Exhaust all but one pooled connection; validation must still succeed.
        let temp = tempfile::tempdir().expect("tempdir");
        let cache = IndexCache::open(temp.path().join("index.sqlite")).expect("open cache");
        let held: Vec<_> = (0..7)
            .map(|_| cache.connection().expect("checkout"))
            .collect();

        let citations = vec![ParsedCitation {
            key: "a".into(),
            line: 1,
        }];
        let summary = validate_citations(&cache, "note", &citations).expect("validate");
        assert_eq!(summary.unresolved, 1);
        drop(held);
    }
}
