use rusqlite::params;
use serde::{Deserialize, Serialize};

use crate::db::IndexCache;
use crate::error::IndexerError;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct SearchHit {
    pub note_id: String,
    pub path: String,
    pub title: String,
    pub snippet: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct SearchToken {
    term: String,
    negate: bool,
    or_after: bool,
}

pub fn build_fts_query(raw: &str) -> Option<String> {
    let tokens = compile_search_tokens(raw);
    if tokens.is_empty() {
        return None;
    }

    let mut parts = Vec::new();
    for (index, token) in tokens.iter().enumerate() {
        let cleaned = token
            .term
            .trim_matches('"')
            .replace('"', "")
            .replace('*', "");
        if cleaned.is_empty() {
            continue;
        }

        let mut clause = if token.negate {
            format!("NOT {cleaned}*")
        } else {
            format!("{cleaned}*")
        };

        if index > 0 {
            let join = if tokens[index - 1].or_after { "OR" } else { "AND" };
            clause = format!("{join} {clause}");
        }

        parts.push(clause);
    }

    if parts.is_empty() {
        None
    } else {
        Some(parts.join(" "))
    }
}

fn compile_search_tokens(raw: &str) -> Vec<SearchToken> {
    let mut tokens = Vec::new();
    let mut current = String::new();
    let mut negate = false;
    let mut in_quotes = false;
    let mut pending_or = false;

    let flush = |tokens: &mut Vec<SearchToken>,
                 current: &mut String,
                 negate: &mut bool,
                 pending_or: &mut bool| {
        let term = current.trim().to_string();
        if !term.is_empty() {
            tokens.push(SearchToken {
                term,
                negate: *negate,
                or_after: false,
            });
        }
        if *pending_or {
            if let Some(last) = tokens.last_mut() {
                last.or_after = true;
            }
            *pending_or = false;
        }
        current.clear();
        *negate = false;
    };

    for ch in raw.chars() {
        match ch {
            '"' => {
                in_quotes = !in_quotes;
                current.push(ch);
            }
            '|' if !in_quotes => {
                flush(&mut tokens, &mut current, &mut negate, &mut pending_or);
                pending_or = true;
            }
            '!' if !in_quotes && current.is_empty() => {
                negate = true;
            }
            ' ' if !in_quotes => {
                flush(&mut tokens, &mut current, &mut negate, &mut pending_or);
            }
            _ => current.push(ch),
        }
    }

    flush(&mut tokens, &mut current, &mut negate, &mut pending_or);
    tokens
}

pub fn search_notes(
    cache: &IndexCache,
    vault_id: &str,
    query: &str,
    limit: u32,
) -> Result<Vec<SearchHit>, IndexerError> {
    let Some(fts_query) = build_fts_query(query) else {
        return Ok(Vec::new());
    };

    let mut statement = cache.connection().prepare(
        "SELECT note_fts.note_id, notes.path, notes.title,
                snippet(note_fts, 1, '[[', ']]', '...', 32) AS snippet
         FROM note_fts
         JOIN notes ON notes.id = note_fts.note_id
         WHERE note_fts MATCH ?1 AND notes.vault_id = ?2
         ORDER BY bm25(note_fts)
         LIMIT ?3",
    )?;

    let rows = statement.query_map(params![fts_query, vault_id, limit], |row| {
        Ok(SearchHit {
            note_id: row.get(0)?,
            path: row.get(1)?,
            title: row.get(2)?,
            snippet: row.get(3)?,
        })
    })?;

    Ok(rows.collect::<Result<Vec<_>, _>>()?)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::IndexCache;
    use crate::notes::upsert_note;
    use scriptor_vault::{metadata_from_markdown, RelativeVaultPath};
    use tempfile::tempdir;

    #[test]
    fn builds_and_or_not_query() {
        assert_eq!(
            build_fts_query("alpha beta"),
            Some("alpha* AND beta*".into())
        );
        assert_eq!(
            build_fts_query("alpha | beta"),
            Some("alpha* OR beta*".into())
        );
        assert_eq!(
            build_fts_query("!draft published"),
            Some("NOT draft* AND published*".into())
        );
    }

    #[test]
    fn finds_indexed_note_by_title() -> Result<(), Box<dyn std::error::Error>> {
        let dir = tempdir()?;
        let cache = IndexCache::open(dir.path().join("cache.sqlite"))?;
        let path = RelativeVaultPath::parse("Research Plan.md")?;
        let markdown = "# Research Plan\n\nEvaluate knowledge structure.\n";
        let metadata = metadata_from_markdown("vault-test", &path, markdown, "2026-01-01T00:00:00Z".into());

        upsert_note(&cache, &metadata, markdown)?;

        let hits = search_notes(&cache, "vault-test", "knowledge", 10)?;
        assert_eq!(hits.len(), 1);
        assert_eq!(hits[0].title, "Research Plan");
        Ok(())
    }
}
