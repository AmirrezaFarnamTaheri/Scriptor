use std::fs;
use std::path::Path;

use regex::Regex;
use rusqlite::params;
use serde::{Deserialize, Serialize};

use scriptor_vault::{scan_vault, ScannedEntryKind, VaultSession};

use crate::citation::register_bibliography_keys;
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

    cache
        .connection()
        .execute("DELETE FROM cache_meta WHERE key LIKE 'bib:%'", [])?;

    let key_refs: Vec<&str> = keys.iter().map(String::as_str).collect();
    register_bibliography_keys(cache, &key_refs)?;

    for entry in &entries {
        let payload = serde_json::to_string(entry)?;
        cache.connection().execute(
            "INSERT OR REPLACE INTO cache_meta(key, value) VALUES (?1, ?2)",
            params![format!("bibmeta:{}", entry.key), payload],
        )?;
    }

    entries.sort_by(|left, right| left.key.cmp(&right.key));
    Ok(entries)
}

pub fn list_bibliography_entries(cache: &IndexCache) -> Result<Vec<BibliographyEntry>, IndexerError> {
    let mut statement = cache
        .connection()
        .prepare("SELECT value FROM cache_meta WHERE key LIKE 'bibmeta:%' ORDER BY key")?;
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

fn parse_bibtex(raw: &str, source_path: &str) -> Vec<BibliographyEntry> {
    let entry_start =
        Regex::new(r#"@([A-Za-z]+)\s*\{\s*([^,\s]+)\s*,"#).expect("valid bib entry regex");
    let title_field = Regex::new(r#"title\s*=\s*\{([^}]*)\}"#).expect("valid title regex");
    let author_field = Regex::new(r#"author\s*=\s*\{([^}]*)\}"#).expect("valid author regex");
    let year_field =
        Regex::new(r#"year\s*=\s*(?:\{([^}]*)\}|(\d{4}))"#).expect("valid year regex");
    let mut entries = Vec::new();

    for capture in entry_start.captures_iter(raw) {
        let entry_type = capture.get(1).map(|value| value.as_str()).unwrap_or("misc");
        let key = capture
            .get(2)
            .map(|value| value.as_str().trim())
            .unwrap_or("")
            .to_string();
        if key.is_empty() {
            continue;
        }

        let start = capture.get(0).map(|value| value.start()).unwrap_or(0);
        let slice = &raw[start..];
        let title = title_field
            .captures(slice)
            .and_then(|title_capture| title_capture.get(1))
            .map(|value| normalize_bib_value(value.as_str()))
            .unwrap_or_else(|| key.clone());
        let author = author_field
            .captures(slice)
            .and_then(|author_capture| author_capture.get(1))
            .map(|value| normalize_bib_value(value.as_str()))
            .unwrap_or_default();
        let year = year_field
            .captures(slice)
            .and_then(|year_capture| {
                year_capture
                    .get(1)
                    .or_else(|| year_capture.get(2))
                    .map(|value| normalize_bib_value(value.as_str()))
            })
            .unwrap_or_default();

        entries.push(BibliographyEntry {
            key,
            title,
            source_path: source_path.to_string(),
            entry_type: entry_type.to_string(),
            author,
            year,
        });
    }

    entries
}

fn normalize_bib_value(value: &str) -> String {
    value.replace('{', "").replace('}', "").trim().to_string()
}

pub fn default_bibliography_paths(vault_root: &Path) -> Vec<String> {
    let mut paths = Vec::new();
    for candidate in ["references.bib", "bibliography.bib", ".scriptor/references.bib"] {
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
        assert_eq!(entries[0].title, "An Example Paper");
        assert_eq!(entries[0].author, "Smith, Jane");
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
}
