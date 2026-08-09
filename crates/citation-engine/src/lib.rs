use std::fmt::Write as _;
use std::fs;
use std::path::Path;

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

        Ok(format_citation(entry, style))
    }

    pub fn render_bibliography(
        &self,
        keys: &[String],
        style: &str,
    ) -> Result<String, CitationError> {
        let entries: Vec<&Entry> = if keys.is_empty() {
            self.library.iter().collect()
        } else {
            keys.iter().filter_map(|k| self.library.get(k)).collect()
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
        "ieee" => format!("{authors}, \"{title},\" {year}."),
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
