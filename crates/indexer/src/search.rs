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
    or_before: bool,
}

pub fn build_fts_query(raw: &str) -> Option<String> {
    let tokens = compile_search_tokens(raw);
    if tokens.is_empty() {
        return None;
    }

    let mut positives: Vec<(String, bool)> = Vec::new();
    let mut negatives = Vec::new();
    let mut pending_or = false;
    // The final searchable positive term keeps the prefix wildcard: it is the
    // word the user is still typing. Earlier terms stay exact matches, which
    // lets FTS5 use vocabulary statistics instead of B-tree range scans.
    let mut last_positive_quoted: Option<String> = None;

    for token in tokens {
        let cleaned = token.term.trim_matches('"');
        // Skip terms with no searchable content: a punctuation-only phrase
        // tokenizes to nothing, which FTS5 rejects. Preserve a preceding OR so
        // `alpha | ( beta` still joins the next searchable term with OR.
        if !cleaned.chars().any(char::is_alphanumeric) {
            pending_or |= token.or_before;
            continue;
        }

        // Emit each term as a quoted prefix phrase so FTS5 operators and
        // punctuation (`(`, `)`, `:`, `^`, `-`, ...) in user input are treated
        // literally instead of being parsed as MATCH syntax. Embedded quotes
        // are escaped by doubling, per SQLite string rules.
        let quoted = format!("\"{}\"", cleaned.replace('"', "\"\""));
        if token.negate {
            // FTS5 NOT is a binary operator, so exclusions are applied after a
            // finite positive expression instead of ever emitting unary NOT.
            negatives.push(quoted.clone());
            pending_or |= token.or_before;
        } else {
            last_positive_quoted = Some(quoted.clone());
            positives.push((quoted, token.or_before || pending_or));
            pending_or = false;
        }
    }

    // FTS5 has no finite universe term, so a pure-negative query cannot be
    // represented safely as MATCH syntax. Treat it like an empty query.
    if let Some(last) = last_positive_quoted
        && let Some(last_entry) = positives.last_mut()
        && last_entry.0 == last
    {
        last_entry.0.push('*');
    }
    let (first, rest) = positives.split_first()?;
    let mut query = first.0.clone();
    for (quoted, or_before) in rest {
        query.push_str(if *or_before { " OR " } else { " AND " });
        query.push_str(quoted);
    }
    if !negatives.is_empty() && positives.len() > 1 {
        query = format!("({query})");
    }
    for quoted in negatives {
        query.push_str(" NOT ");
        query.push_str(&quoted);
    }
    Some(query)
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
                or_before: *pending_or,
            });
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

    let conn = cache.connection()?;
    // v5 FTS column order is note_id(UNINDEXED), title, headings, tags, body.
    // FTS5 column indices and bm25() weights still include UNINDEXED columns,
    // so note_id receives a zero weight and body is snippet column 4.
    // `bm25()` is negated (more relevant = more negative) so ascending order
    // gives highest-relevance first.
    let mut statement = conn.prepare(
        "SELECT note_fts.note_id, notes.path, notes.title,
                snippet(note_fts, 4, '[[', ']]', '...', 32) AS snippet
         FROM note_fts
         JOIN notes ON notes.id = note_fts.note_id
         WHERE note_fts MATCH ?1 AND notes.vault_id = ?2
         ORDER BY bm25(note_fts, 0.0, 10.0, 5.0, 3.0, 1.0)
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
    use scriptor_vault::{RelativeVaultPath, metadata_from_markdown};
    use tempfile::tempdir;

    #[test]
    fn builds_and_or_not_query() {
        assert_eq!(
            build_fts_query("alpha beta"),
            Some("\"alpha\" AND \"beta\"*".into())
        );
        assert_eq!(
            build_fts_query("alpha | beta"),
            Some("\"alpha\" OR \"beta\"*".into())
        );
        assert_eq!(
            build_fts_query("alpha|beta"),
            Some("\"alpha\" OR \"beta\"*".into())
        );
        assert_eq!(
            build_fts_query("!draft published"),
            Some("\"published\"* NOT \"draft\"".into())
        );
        assert_eq!(build_fts_query("!draft"), None);
        assert_eq!(
            build_fts_query("!draft alpha | beta"),
            Some("(\"alpha\" OR \"beta\"*) NOT \"draft\"".into())
        );
    }

    #[test]
    fn quotes_terms_so_fts_operators_are_literal() {
        assert_eq!(build_fts_query("a("), Some("\"a(\"*".into()));
        assert_eq!(
            build_fts_query("body:secret"),
            Some("\"body:secret\"*".into())
        );
        // Embedded quotes are escaped by doubling inside the phrase.
        assert_eq!(build_fts_query("say\"hi"), Some("\"say\"\"hi\"*".into()));
    }

    #[test]
    fn search_with_fts_metacharacters_does_not_error() -> Result<(), Box<dyn std::error::Error>> {
        let dir = tempdir()?;
        let cache = IndexCache::open(dir.path().join("cache.sqlite"))?;

        let path = RelativeVaultPath::parse("Marker.md")?;
        let markdown = "# Marker\n\nthe body:secret marker\n";
        let metadata =
            metadata_from_markdown("vault-test", &path, markdown, "2026-01-01T00:00:00Z".into());
        upsert_note(&cache, &metadata, markdown)?;

        let other = RelativeVaultPath::parse("Other.md")?;
        let other_markdown = "# Other\n\nkeep this secret safe\n";
        let other_metadata = metadata_from_markdown(
            "vault-test",
            &other,
            other_markdown,
            "2026-01-01T00:00:00Z".into(),
        );
        upsert_note(&cache, &other_metadata, other_markdown)?;

        // Would previously be parsed as MATCH syntax (unbalanced paren / column filter).
        let hits = search_notes(&cache, "vault-test", "a(", 10)?;
        assert!(hits.len() <= 2);

        // `body:` must not act as a column filter: only the note containing the
        // literal "body:secret" text matches, not every note mentioning "secret".
        let hits = search_notes(&cache, "vault-test", "body:secret", 10)?;
        assert_eq!(hits.len(), 1);
        assert_eq!(hits[0].path, "Marker.md");

        for query in ["(", ")", "^boost", "-minus", "NEAR(", "col:val OR x"] {
            let result = search_notes(&cache, "vault-test", query, 10);
            assert!(result.is_ok(), "query {query:?} errored: {result:?}");
        }
        Ok(())
    }

    #[test]
    fn leading_negation_executes_as_a_binary_fts_not() -> Result<(), Box<dyn std::error::Error>> {
        let dir = tempdir()?;
        let cache = IndexCache::open(dir.path().join("cache.sqlite"))?;

        let published = RelativeVaultPath::parse("Published.md")?;
        let published_markdown = "# Published\n\npublished release notes\n";
        let published_metadata = metadata_from_markdown(
            "vault-test",
            &published,
            published_markdown,
            "2026-01-01T00:00:00Z".into(),
        );
        upsert_note(&cache, &published_metadata, published_markdown)?;

        let draft = RelativeVaultPath::parse("Draft.md")?;
        let draft_markdown = "# Draft\n\ndraft published release notes\n";
        let draft_metadata = metadata_from_markdown(
            "vault-test",
            &draft,
            draft_markdown,
            "2026-01-01T00:00:00Z".into(),
        );
        upsert_note(&cache, &draft_metadata, draft_markdown)?;

        let hits = search_notes(&cache, "vault-test", "!draft published", 10)?;
        assert_eq!(hits.len(), 1);
        assert_eq!(hits[0].path, "Published.md");
        Ok(())
    }

    #[test]
    fn finds_indexed_note_by_title() -> Result<(), Box<dyn std::error::Error>> {
        let dir = tempdir()?;
        let cache = IndexCache::open(dir.path().join("cache.sqlite"))?;
        let path = RelativeVaultPath::parse("Research Plan.md")?;
        let markdown = "# Research Plan\n\nEvaluate knowledge structure.\n";
        let metadata =
            metadata_from_markdown("vault-test", &path, markdown, "2026-01-01T00:00:00Z".into());

        upsert_note(&cache, &metadata, markdown)?;

        let hits = search_notes(&cache, "vault-test", "knowledge", 10)?;
        assert_eq!(hits.len(), 1);
        assert_eq!(hits[0].title, "Research Plan");
        Ok(())
    }

    #[test]
    fn body_search_returns_a_body_snippet() -> Result<(), Box<dyn std::error::Error>> {
        let dir = tempdir()?;
        let cache = IndexCache::open(dir.path().join("cache.sqlite"))?;
        let path = RelativeVaultPath::parse("Snippet.md")?;
        let markdown =
            "---\ntags: [metadata-only]\n---\n# Snippet\n\nBodyneedle lives in the prose.\n";
        let metadata =
            metadata_from_markdown("vault-test", &path, markdown, "2026-01-01T00:00:00Z".into());

        upsert_note(&cache, &metadata, markdown)?;

        let hits = search_notes(&cache, "vault-test", "bodyneedle", 10)?;
        assert_eq!(hits.len(), 1);
        assert!(
            hits[0].snippet.contains("[[Bodyneedle]]"),
            "{}",
            hits[0].snippet
        );
        assert!(!hits[0].snippet.contains("metadata-only"));

        // Frontmatter-only terms must not surface through body FTS search.
        let frontmatter_hits = search_notes(&cache, "vault-test", "metadata-only", 10)?;
        assert!(
            frontmatter_hits.is_empty(),
            "FTS body must not index frontmatter; got {} hit(s)",
            frontmatter_hits.len()
        );
        Ok(())
    }
}
