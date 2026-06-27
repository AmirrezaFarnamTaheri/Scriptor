use std::collections::HashMap;
use std::fs;
use std::path::Path;

use hayagriva::io::from_biblatex_str;
use hayagriva::style::{BibliographyStyle, CitationStyle};
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
    #[error("render error: {0}")]
    Render(String),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CitationInfo {
    pub key: String,
    pub title: Option<String>,
    pub authors: Vec<String>,
    pub year: Option<String>,
}

pub struct CitationEngine {
    entries: Vec<hayagriva::Entry>,
    key_index: HashMap<String, usize>,
}

impl CitationEngine {
    pub fn from_file(path: &Path) -> Result<Self, CitationError> {
        let content = fs::read_to_string(path)?;
        Self::from_biblatex_str(&content)
    }

    pub fn from_biblatex_str(content: &str) -> Result<Self, CitationError> {
        let entries = from_biblatex_str(content)
            .map_err(|e| CitationError::Parse(format!("{e:?}")))?;

        let mut key_index = HashMap::new();
        for (i, entry) in entries.iter().enumerate() {
            key_index.insert(entry.key().to_string(), i);
        }

        Ok(Self { entries, key_index })
    }

    pub fn render_citation(&self, key: &str, style: &str) -> Result<String, CitationError> {
        let _index = self.key_index.get(key).ok_or_else(|| {
            CitationError::KeyNotFound(key.to_string())
        })?;

        let bibliography_style = Self::resolve_style(style)?;
        let mut driver = bibliography_style.driver();
        driver.assume_resolved();

        let citation = driver.cite(&self.entries.iter().collect::<Vec<_>>());
        Ok(citation)
    }

    pub fn render_bibliography(&self, keys: &[String], style: &str) -> Result<String, CitationError> {
        let bibliography_style = Self::resolve_style(style)?;
        let mut driver = bibliography_style.driver();
        driver.assume_resolved();

        let selected: Vec<&hayagriva::Entry> = if keys.is_empty() {
            self.entries.iter().collect()
        } else {
            keys.iter()
                .filter_map(|k| {
                    self.key_index.get(k).map(|&i| &self.entries[i])
                })
                .collect()
        };

        let bibliography = driver.render(&selected);
        Ok(bibliography)
    }

    pub fn list_keys(&self) -> Vec<String> {
        self.entries
            .iter()
            .map(|entry| entry.key().to_string())
            .collect()
    }

    pub fn entry_info(&self, key: &str) -> Option<CitationInfo> {
        let index = self.key_index.get(key)?;
        let entry = &self.entries[*index];

        let title = entry.title().map(|t| t.to_string());
        let authors = entry
            .authors()
            .map(|people| {
                people
                    .iter()
                    .map(|p| p.to_string())
                    .collect()
            })
            .unwrap_or_default();
        let year = entry.date().map(|d| d.year.to_string());

        Some(CitationInfo {
            key: key.to_string(),
            title,
            authors,
            year,
        })
    }

    fn resolve_style(style: &str) -> Result<BibliographyStyle, CitationError> {
        match style.to_lowercase().as_str() {
            "apa" | "apa7" => Ok(BibliographyStyle::Apa),
            "mla" => Ok(BibliographyStyle::Mla),
            "chicago" | "chicago-author-date" => Ok(BibliographyStyle::ChicagoAuthorDate),
            "ieee" => Ok(BibliographyStyle::Ieee),
            "harvard" => Ok(BibliographyStyle::Harvard),
            "vancouver" => Ok(BibliographyStyle::Vancouver),
            "turabian" => Ok(BibliographyStyle::Turabian),
            "nature" => Ok(BibliographyStyle::Nature),
            _ => Err(CitationError::UnsupportedStyle(style.to_string())),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_resolve_known_styles() {
        assert!(CitationEngine::resolve_style("apa").is_ok());
        assert!(CitationEngine::resolve_style("mla").is_ok());
        assert!(CitationEngine::resolve_style("ieee").is_ok());
        assert!(CitationEngine::resolve_style("chicago").is_ok());
        assert!(CitationEngine::resolve_style("unknown-style").is_err());
    }

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
    }
}
