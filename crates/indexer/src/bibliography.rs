use std::fs;
use std::path::Path;

use rusqlite::{TransactionBehavior, params};
use scriptor_citation_engine::CitationEntryExcerpt;
use serde::{Deserialize, Serialize};

use scriptor_vault::{ScannedEntryKind, VaultSession, scan_vault};

use crate::citation::register_bibliography_keys_on;
use crate::db::IndexCache;
use crate::error::IndexerError;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct BibliographyEntry {
    pub key: String,
    pub title: String,
    pub source_path: String,
    pub entry_type: String,
    #[serde(default)]
    pub author: String,
    #[serde(default)]
    pub year: String,
}

pub fn sync_vault_bibliography(
    cache: &IndexCache,
    session: &VaultSession,
) -> Result<Vec<BibliographyEntry>, IndexerError> {
    let mut entries = Vec::new();
    let mut keys = Vec::new();

    for scanned in scan_vault(&session.root)? {
        if scanned.kind != ScannedEntryKind::Asset {
            continue;
        }
        if !scanned.path.to_ascii_lowercase().ends_with(".bib") {
            continue;
        }

        let absolute = session.root.root().join(&scanned.path);
        let raw = fs::read_to_string(&absolute).map_err(|source| IndexerError::Io {
            path: absolute.clone(),
            source,
        })?;
        let parsed = parse_bibtex(&raw, &scanned.path);
        for entry in parsed {
            keys.push(entry.key.clone());
            entries.push(entry);
        }
    }

    // Delete + re-insert must be atomic on a single connection. Splitting them across two pooled
    // connections without a transaction leaves the cache with zero `bib:` keys whenever anything
    // fails in between, which makes every citation in the vault report as unresolved.
    let mut conn = cache.connection()?;
    let transaction = conn.transaction_with_behavior(TransactionBehavior::Immediate)?;
    transaction.execute(
        "DELETE FROM cache_meta WHERE key >= 'bib:' AND key < 'bib;'",
        [],
    )?;
    transaction.execute(
        "DELETE FROM cache_meta WHERE key >= 'bibmeta:' AND key < 'bibmeta;'",
        [],
    )?;

    let key_refs: Vec<&str> = keys.iter().map(String::as_str).collect();
    register_bibliography_keys_on(&transaction, &key_refs)?;

    for entry in &entries {
        let payload = serde_json::to_string(entry)?;
        transaction.execute(
            "INSERT OR REPLACE INTO cache_meta(key, value) VALUES (?1, ?2)",
            params![format!("bibmeta:{}", entry.key), payload],
        )?;
    }
    transaction.commit()?;

    entries.sort_by(|left, right| left.key.cmp(&right.key));
    Ok(entries)
}

pub fn list_bibliography_entries(
    cache: &IndexCache,
) -> Result<Vec<BibliographyEntry>, IndexerError> {
    let conn = cache.connection()?;
    let mut statement =
        conn.prepare_cached(
            "SELECT value FROM cache_meta WHERE key >= 'bibmeta:' AND key < 'bibmeta;' ORDER BY key",
        )?;
    let rows = statement.query_map([], |row| {
        let payload: String = row.get(0)?;
        Ok(payload)
    })?;

    let mut entries = Vec::new();
    for row in rows {
        let payload = row?;
        if let Ok(entry) = serde_json::from_str::<BibliographyEntry>(&payload) {
            entries.push(entry);
        }
    }
    Ok(entries)
}

/// Parse `.bib` content into bibliography rows.
///
/// Parsing is delegated to `scriptor-citation-engine` (Hayagriva's BibLaTeX
/// grammar), replacing the hand-rolled regex scan: quoted values, nested
/// braces, `@string` macros, and entry boundaries are now handled by the
/// grammar instead of field-slicing heuristics, and a field can no longer
/// leak from one entry into the next.
///
/// A file that cannot be parsed at all degrades to an empty row set with a
/// warning: one broken `.bib` must not fail the whole vault rebuild.
fn parse_bibtex(raw: &str, source_path: &str) -> Vec<BibliographyEntry> {
    match scriptor_citation_engine::parse_lenient(raw) {
        Ok(excerpts) => excerpts
            .into_iter()
            .map(|excerpt| bibliography_entry_from_excerpt(excerpt, source_path))
            .collect(),
        Err(error) => {
            tracing::warn!(
                source_path = %source_path,
                error = %error,
                "skipping unparseable bibliography file"
            );
            Vec::new()
        }
    }
}

fn bibliography_entry_from_excerpt(
    excerpt: CitationEntryExcerpt,
    source_path: &str,
) -> BibliographyEntry {
    let mut entry_type = excerpt.entry_type;
    // Hayagriva models @inproceedings as an article inside proceedings; the
    // bibliography CSL mapper still keys on the classic label.
    if entry_type == "article" && excerpt.parents.iter().any(|parent| parent == "proceedings") {
        entry_type = "inproceedings".to_string();
    }

    BibliographyEntry {
        title: excerpt.title.unwrap_or_else(|| excerpt.key.clone()),
        source_path: source_path.to_string(),
        entry_type,
        author: excerpt.authors.join("; "),
        year: excerpt.year.unwrap_or_default(),
        key: excerpt.key,
    }
}

pub fn default_bibliography_paths(vault_root: &Path) -> Vec<String> {
    let mut paths = Vec::new();
    for candidate in [
        "references.bib",
        "bibliography.bib",
        ".scriptor/references.bib",
    ] {
        if vault_root.join(candidate).exists() {
            paths.push(candidate.to_string());
        }
    }
    paths
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_bibtex_keys_and_titles() {
        let raw = r#"
@article{smith2024,
  title = {An Example Paper},
  author = {Smith, Jane}
}
@book{doe2023,
  title = {Handbook},
}
"#;
        let entries = parse_bibtex(raw, "refs.bib");
        assert_eq!(entries.len(), 2);
        assert_eq!(entries[0].key, "smith2024");
        assert_eq!(entries[0].entry_type, "article");
        assert_eq!(entries[0].title, "An Example Paper");
        assert_eq!(entries[0].author, "Smith, Jane");
        assert_eq!(entries[1].key, "doe2023");
        assert_eq!(entries[1].entry_type, "book");
    }

    #[test]
    fn parses_year_with_and_without_braces() {
        let raw = r#"
@article{a, title = {T}, year = 2024}
@article{b, title = {T}, year = {2023}}
"#;
        let entries = parse_bibtex(raw, "refs.bib");
        assert_eq!(entries[0].year, "2024");
        assert_eq!(entries[1].year, "2023");
    }

    #[test]
    fn fields_do_not_bleed_from_a_later_entry() {
        let raw = r#"
@book{a,
  author = {Author A}
}
@book{b,
  title = {Only B Has A Title},
  author = {Author B},
  year = {2001}
}
"#;
        let entries = parse_bibtex(raw, "refs.bib");
        assert_eq!(entries.len(), 2);
        // `a` has no title/year of its own: it must fall back, not borrow `b`'s values.
        assert_eq!(entries[0].key, "a");
        assert_eq!(entries[0].title, "a");
        // BibLaTeX "Given Family" word order normalizes to "Family, Given".
        assert_eq!(entries[0].author, "A, Author");
        assert_eq!(entries[0].year, "");
        assert_eq!(entries[1].title, "Only B Has A Title");
        assert_eq!(entries[1].year, "2001");
    }

    #[test]
    fn inproceedings_keeps_the_classic_label() {
        let raw = r#"
@inproceedings{conf2024,
  title = {A Conference Paper},
  booktitle = {Proceedings of Testing},
  year = {2024}
}
"#;
        let entries = parse_bibtex(raw, "refs.bib");
        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].entry_type, "inproceedings");
    }

    #[test]
    fn unparseable_files_yield_no_entries_instead_of_failing_the_sync() {
        let entries = parse_bibtex("@article{key, author = {unclosed brace", "refs.bib");
        assert!(entries.is_empty());
    }

    #[test]
    fn parses_the_minimal_fixture() {
        let raw = include_str!("../../../packages/test-fixtures/vaults/minimal/references.bib");
        let entries = parse_bibtex(raw, "references.bib");
        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].key, "smith2024");
        assert_eq!(entries[0].title, "Research Methods");
        assert_eq!(entries[0].author, "Smith, Jane");
        assert_eq!(entries[0].year, "2024");
        assert_eq!(entries[0].entry_type, "article");
        assert_eq!(entries[0].source_path, "references.bib");
    }
}
