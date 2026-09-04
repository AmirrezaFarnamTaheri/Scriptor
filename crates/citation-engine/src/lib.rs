use std::fmt::Write as _;
use std::fs;
use std::path::Path;

use biblatex::Bibliography;
use hayagriva::io::from_biblatex_str;
use hayagriva::{Entry, Library};
use serde::{Deserialize, Serialize};
use thiserror::Error;

#[derive(Debug, Error)]
pub enum CitationError {
    #[error("failed to read bibliography file: {0}")]
    Io(#[from] std::io::Error),
    #[error("failed to parse bibliography: {0}")]
    Parse(String),
    #[error("citation key not found: {0}")]
    KeyNotFound(String),
    #[error("style not supported: {0}")]
    UnsupportedStyle(String),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CitationInfo {
    pub key: String,
    pub title: Option<String>,
    pub authors: Vec<String>,
    pub year: Option<String>,
}

/// A flattened bibliography entry for indexing surfaces.
///
/// Excerpts deliberately drop citation-style detail (venues, pages, DOIs):
/// they power vault indexing and bibliography panels, not CSL rendering.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CitationEntryExcerpt {
    pub key: String,
    /// `None` when the entry has no usable title; callers fall back to the key.
    pub title: Option<String>,
    /// Rendered "Family, Given" per person, in citation order.
    pub authors: Vec<String>,
    /// Calendar year as written in the file, if present.
    pub year: Option<String>,
    /// Normalized kebab-case work type from the hayagriva taxonomy (e.g. "article").
    pub entry_type: String,
    /// Normalized work types of parent containers (e.g. ["proceedings"] for @inproceedings).
    pub parents: Vec<String>,
}

pub struct CitationEngine {
    library: Library,
}

impl CitationEngine {
    pub fn from_file(path: &Path) -> Result<Self, CitationError> {
        let content = fs::read_to_string(path)?;
        Self::from_biblatex_str(&content)
    }

    pub fn from_biblatex_str(content: &str) -> Result<Self, CitationError> {
        let library =
            from_biblatex_str(content).map_err(|e| CitationError::Parse(format!("{e:?}")))?;

        Ok(Self { library })
    }

    pub fn render_citation(&self, key: &str, style: &str) -> Result<String, CitationError> {
        let entry = self
            .library
            .get(key)
            .ok_or_else(|| CitationError::KeyNotFound(key.to_string()))?;

        let style = normalize_style(style)?;
        Ok(format_citation(entry, style))
    }

    pub fn render_bibliography(
        &self,
        keys: &[String],
        style: &str,
    ) -> Result<String, CitationError> {
        let style = normalize_style(style)?;
        let entries: Vec<&Entry> = if keys.is_empty() {
            self.library.iter().collect()
        } else {
            let mut entries = Vec::with_capacity(keys.len());
            for key in keys {
                entries.push(
                    self.library
                        .get(key)
                        .ok_or_else(|| CitationError::KeyNotFound(key.clone()))?,
                );
            }
            entries
        };

        let mut output = String::new();
        for entry in &entries {
            let _ = writeln!(output, "{}", format_bibliography_entry(entry, style));
        }
        Ok(output)
    }

    pub fn list_keys(&self) -> Vec<String> {
        self.library.keys().map(|k| k.to_string()).collect()
    }

    pub fn entry_info(&self, key: &str) -> Option<CitationInfo> {
        let entry = self.library.get(key)?;

        let title = entry.title().map(|t| t.to_string());
        let authors = entry
            .authors()
            .map(|people| people.iter().map(|p| p.name_first(false, false)).collect())
            .unwrap_or_default();
        let year = entry.date().map(|d| d.year.to_string());

        Some(CitationInfo {
            key: key.to_string(),
            title,
            authors,
            year,
        })
    }

    /// Excerpt every entry in the library, in library iteration order.
    pub fn entries(&self) -> Vec<CitationEntryExcerpt> {
        self.library.iter().map(entry_excerpt).collect()
    }
}

/// Excerpt a single hayagriva entry.
fn entry_excerpt(entry: &Entry) -> CitationEntryExcerpt {
    CitationEntryExcerpt {
        key: entry.key().to_string(),
        title: entry.title().map(|title| title.to_string()),
        authors: entry
            .authors()
            .map(|people| people.iter().map(|p| p.name_first(false, false)).collect())
            .unwrap_or_default(),
        year: entry.date().map(|date| date.year.to_string()),
        entry_type: type_label(entry.entry_type()),
        parents: entry
            .parents()
            .iter()
            .map(|parent| type_label(parent.entry_type()))
            .collect(),
    }
}

/// hayagriva's work types serialize as kebab-case strings ("article", "book", ...).
fn type_label(entry_type: &hayagriva::types::EntryType) -> String {
    serde_json::to_string(entry_type)
        .ok()
        .map(|json| json.trim_matches('"').to_string())
        .filter(|label| !label.is_empty())
        .unwrap_or_else(|| "misc".to_string())
}

/// Parse a BibLaTeX document, keeping the entries that survive.
///
/// [`CitationEngine::from_biblatex_str`] is all-or-nothing: one bad field drops
/// the whole library. Vault bibliographies are user-authored, so recovery
/// matters: this parses the file with the same underlying parser, converts
/// entries one by one, and skips only the entries that fail conversion. An
/// error is returned only when the document cannot be parsed at all.
pub fn parse_lenient(content: &str) -> Result<Vec<CitationEntryExcerpt>, CitationError> {
    let bibliography =
        Bibliography::parse(content).map_err(|error| CitationError::Parse(format!("{error:?}")))?;

    let mut excerpts = Vec::new();
    for raw in bibliography.iter() {
        match Entry::try_from(raw) {
            Ok(entry) => excerpts.push(entry_excerpt(&entry)),
            Err(error) => tracing::warn!(
                key = %raw.key,
                error = %error,
                "skipping bibliography entry that failed to convert"
            ),
        }
    }
    Ok(excerpts)
}

fn normalize_style(style: &str) -> Result<&'static str, CitationError> {
    match style.trim().to_ascii_lowercase().as_str() {
        "apa" | "apa7" => Ok("apa"),
        "mla" => Ok("mla"),
        "ieee" => Ok("ieee"),
        "vancouver" => Ok("vancouver"),
        "chicago" | "chicago-author-date" => Ok("chicago"),
        "harvard" => Ok("harvard"),
        _ => Err(CitationError::UnsupportedStyle(style.to_string())),
    }
}

fn format_citation(entry: &Entry, style: &str) -> String {
    let authors = entry
        .authors()
        .map(|people| {
            let names: Vec<String> = people.iter().map(|p| p.name_first(false, false)).collect();
            names.join(", ")
        })
        .unwrap_or_else(|| "Unknown".to_string());
    let year = entry
        .date()
        .map(|d| d.year.to_string())
        .unwrap_or_else(|| "n.d.".to_string());

    match style.to_lowercase().as_str() {
        "apa" | "apa7" => format!("({authors}, {year})"),
        "mla" => format!("({authors})"),
        "ieee" | "vancouver" => format!("[{key}]", key = entry.key()),
        "chicago" | "chicago-author-date" | "harvard" => format!("({authors} {year})"),
        _ => format!("({authors}, {year})"),
    }
}

fn format_bibliography_entry(entry: &Entry, style: &str) -> String {
    let authors = entry
        .authors()
        .map(|people| {
            let names: Vec<String> = people.iter().map(|p| p.name_first(false, false)).collect();
            names.join(", ")
        })
        .unwrap_or_else(|| "Unknown".to_string());
    let year = entry
        .date()
        .map(|d| d.year.to_string())
        .unwrap_or_else(|| "n.d.".to_string());
    let title = entry
        .title()
        .map(|t| t.to_string())
        .unwrap_or_else(|| "Untitled".to_string());

    match style.to_lowercase().as_str() {
        "apa" | "apa7" => format!("{authors} ({year}). {title}."),
        "mla" => format!("{authors}. \"{title}.\""),
        "ieee" | "vancouver" => format!("{authors}, \"{title},\" {year}."),
        "chicago" | "chicago-author-date" => format!("{authors}. {year}. \"{title}.\""),
        "harvard" => format!("{authors} ({year}) '{title}'."),
        _ => format!("{authors} ({year}). {title}."),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_empty_bibliography() {
        let engine = CitationEngine::from_biblatex_str("").unwrap();
        assert!(engine.list_keys().is_empty());
    }

    #[test]
    fn test_parse_simple_entry() {
        let bib = r#"@article{doe2024,
            author = {Doe, John},
            title = {A Test Article},
            year = {2024},
            journal = {Test Journal},
        }"#;
        let engine = CitationEngine::from_biblatex_str(bib).unwrap();
        let keys = engine.list_keys();
        assert_eq!(keys.len(), 1);
        assert_eq!(keys[0], "doe2024");

        let info = engine.entry_info("doe2024").unwrap();
        assert_eq!(info.title, Some("A Test Article".to_string()));
        assert_eq!(info.year, Some("2024".to_string()));
        assert_eq!(info.authors, vec!["Doe, John".to_string()]);
    }

    #[test]
    fn unknown_style_is_rejected() {
        let bib = r#"@article{doe2024, author = {Doe, John}, title = {A}, year = {2024}}"#;
        let engine = CitationEngine::from_biblatex_str(bib).unwrap();
        assert!(matches!(
            engine.render_citation("doe2024", "made-up-style"),
            Err(CitationError::UnsupportedStyle(_))
        ));
    }

    #[test]
    fn requested_missing_bibliography_key_is_an_error() {
        let bib = r#"@article{doe2024, author = {Doe, John}, title = {A}, year = {2024}}"#;
        let engine = CitationEngine::from_biblatex_str(bib).unwrap();
        assert!(matches!(
            engine.render_bibliography(&["missing".to_string()], "apa"),
            Err(CitationError::KeyNotFound(key)) if key == "missing"
        ));
    }

    #[test]
    fn test_render_citation_apa() {
        let bib = r#"@article{doe2024,
            author = {Doe, John},
            title = {A Test Article},
            year = {2024},
        }"#;
        let engine = CitationEngine::from_biblatex_str(bib).unwrap();
        let citation = engine.render_citation("doe2024", "apa").unwrap();
        assert_eq!(citation, "(Doe, John, 2024)");
    }

    #[test]
    fn test_render_citation_unknown_key() {
        let bib = r#"@article{doe2024,
            author = {Doe, John},
            title = {A Test Article},
            year = {2024},
        }"#;
        let engine = CitationEngine::from_biblatex_str(bib).unwrap();
        assert!(engine.render_citation("nonexistent", "apa").is_err());
    }

    #[test]
    fn test_render_bibliography() {
        let bib = r#"@article{doe2024,
            author = {Doe, John},
            title = {A Test Article},
            year = {2024},
        }"#;
        let engine = CitationEngine::from_biblatex_str(bib).unwrap();
        let bib_output = engine.render_bibliography(&[], "apa").unwrap();
        assert!(bib_output.contains("Doe"));
        assert!(bib_output.contains("2024"));
    }

    #[test]
    fn test_multi_author_entry() {
        let bib = r#"@article{smith2023,
            author = {Smith, Alice and Jones, Bob and Lee, Carol},
            title = {Collaborative Research},
            year = {2023},
        }"#;
        let engine = CitationEngine::from_biblatex_str(bib).unwrap();
        let info = engine.entry_info("smith2023").unwrap();
        assert!(info.authors.len() >= 2, "should parse multiple authors");
        let citation = engine.render_citation("smith2023", "apa").unwrap();
        assert!(citation.contains("2023"));
    }

    #[test]
    fn test_special_characters_in_title() {
        let bib = r#"@article{accent2024,
            author = {Müller, Hans},
            title = {Über die Änderungen in der Ökologie},
            year = {2024},
        }"#;
        let engine = CitationEngine::from_biblatex_str(bib).unwrap();
        let info = engine.entry_info("accent2024").unwrap();
        assert!(info.title.is_some());
        assert!(info.title.unwrap().contains("Ökologie"));
    }

    #[test]
    fn test_missing_year_renders_nd() {
        let bib = r#"@article{noyear,
            author = {Doe, Jane},
            title = {No Year Article},
        }"#;
        let engine = CitationEngine::from_biblatex_str(bib).unwrap();
        let citation = engine.render_citation("noyear", "apa").unwrap();
        assert!(citation.contains("n.d."));
    }

    #[test]
    fn test_missing_author_renders_unknown() {
        let bib = r#"@article{noauthor,
            title = {Anonymous Article},
            year = {2020},
        }"#;
        let engine = CitationEngine::from_biblatex_str(bib).unwrap();
        let citation = engine.render_citation("noauthor", "apa").unwrap();
        assert!(citation.contains("Unknown"));
    }

    #[test]
    fn test_ieee_style_uses_key() {
        let bib = r#"@article{key2024,
            author = {Doe, John},
            title = {IEEE Article},
            year = {2024},
        }"#;
        let engine = CitationEngine::from_biblatex_str(bib).unwrap();
        let citation = engine.render_citation("key2024", "ieee").unwrap();
        assert_eq!(citation, "[key2024]");
    }

    #[test]
    fn test_render_bibliography_with_specific_keys() {
        let bib = r#"@article{a2024,
            author = {A, Author},
            title = {First},
            year = {2024},
        }
        @article{b2024,
            author = {B, Author},
            title = {Second},
            year = {2024},
        }"#;
        let engine = CitationEngine::from_biblatex_str(bib).unwrap();
        let bib_output = engine
            .render_bibliography(&["a2024".to_string()], "apa")
            .unwrap();
        assert!(bib_output.contains("First"));
        assert!(!bib_output.contains("Second"));
    }

    #[test]
    fn test_malformed_bibtex_returns_error() {
        let bib = "@article{key, author = {unclosed brace";
        let result = CitationEngine::from_biblatex_str(bib);
        assert!(result.is_err());
    }

    #[test]
    fn test_empty_key_lookup_returns_error() {
        let bib = r#"@article{x,
            author = {Doe, John},
            title = {Test},
            year = {2024},
        }"#;
        let engine = CitationEngine::from_biblatex_str(bib).unwrap();
        assert!(engine.entry_info("").is_none());
    }

    #[test]
    fn test_multiple_entries_listed() {
        let bib = r#"@article{a1, author={A}, title={T1}, year={2020}}
        @book{b1, author={B}, title={T2}, year={2021}}
        @inproceedings{c1, author={C}, title={T3}, year={2022}}"#;
        let engine = CitationEngine::from_biblatex_str(bib).unwrap();
        let keys = engine.list_keys();
        assert_eq!(keys.len(), 3);
        assert!(keys.contains(&"a1".to_string()));
        assert!(keys.contains(&"b1".to_string()));
        assert!(keys.contains(&"c1".to_string()));
    }

    #[test]
    fn test_render_bibliography_empty_keys_shows_all() {
        let bib = r#"@article{x, author={A}, title={T}, year={2020}}
        @article{y, author={B}, title={U}, year={2021}}"#;
        let engine = CitationEngine::from_biblatex_str(bib).unwrap();
        let output = engine.render_bibliography(&[], "apa").unwrap();
        assert!(output.contains("T"));
        assert!(output.contains("U"));
    }

    #[test]
    fn parse_lenient_excerpts_entries() {
        let bib = r#"
@article{smith2024, author = {Smith, Jane}, title = {Research Methods}, year = {2024}}
@book{doe2023, author = {Doe, John}, title = {Handbook}}
"#;
        let excerpts = parse_lenient(bib).unwrap();
        assert_eq!(excerpts.len(), 2);
        assert_eq!(excerpts[0].key, "smith2024");
        assert_eq!(excerpts[0].entry_type, "article");
        assert_eq!(excerpts[0].authors, vec!["Smith, Jane".to_string()]);
        assert_eq!(excerpts[0].year.as_deref(), Some("2024"));
        assert_eq!(excerpts[1].entry_type, "book");
        assert!(excerpts[1].parents.is_empty());
    }

    #[test]
    fn parse_lenient_records_proceedings_parent() {
        let bib = r#"@inproceedings{conf2024, title = {A Conference Paper}, year = {2024}}"#;
        let excerpts = parse_lenient(bib).unwrap();
        assert_eq!(excerpts.len(), 1);
        assert_eq!(excerpts[0].entry_type, "article");
        assert_eq!(excerpts[0].parents, vec!["proceedings".to_string()]);
    }

    #[test]
    fn parse_lenient_reports_fatal_parse_errors() {
        let result = parse_lenient("@article{key, author = {unclosed brace");
        assert!(result.is_err());
    }

    #[test]
    fn entries_excerpts_the_whole_library() {
        let bib = r#"
@article{a2024, author = {A, Author}, title = {First}, year = {2024}}
@misc{m2023, title = {Miscellaneous}}
"#;
        let engine = CitationEngine::from_biblatex_str(bib).unwrap();
        let entries = engine.entries();
        assert_eq!(entries.len(), 2);
        assert_eq!(entries[1].key, "m2023");
        assert_eq!(entries[1].entry_type, "misc");
        assert_eq!(entries[1].title, Some("Miscellaneous".to_string()));
    }

    #[test]
    fn test_chicago_style_format() {
        let bib = r#"@article{doe2024,
            author = {Doe, John},
            title = {Chicago Article},
            year = {2024},
        }"#;
        let engine = CitationEngine::from_biblatex_str(bib).unwrap();
        let citation = engine.render_citation("doe2024", "chicago").unwrap();
        assert!(citation.contains("Doe"));
        assert!(citation.contains("2024"));
    }
}
