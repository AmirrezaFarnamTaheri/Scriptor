use std::fs;
use std::path::Path;

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

use crate::error::VaultError;
use crate::hash::{content_hash, reading_time_minutes, word_count};
use crate::link_rewrite::split_frontmatter;
use crate::path::{RelativeVaultPath, VaultRoot};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct NoteMetadata {
    pub id: String,
    pub vault_id: String,
    pub path: String,
    pub title: String,
    pub content_hash: String,
    pub modified_at: String,
    pub word_count: u32,
    pub reading_time_minutes: u32,
    pub tags: Vec<String>,
    #[serde(default)]
    pub note_type: Option<String>,
    #[serde(default)]
    pub organized: bool,
    #[serde(default)]
    pub archived: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct NoteDocument {
    pub metadata: NoteMetadata,
    pub markdown: String,
}

/// Reads a note from the vault, returning its markdown content and metadata.
pub fn read_note(
    vault_id: &str,
    root: &VaultRoot,
    path: &RelativeVaultPath,
) -> Result<NoteDocument, VaultError> {
    let absolute = root.resolve_relative(path)?;
    if !absolute.is_file() {
        return Err(VaultError::NoteNotFound(path.to_string()));
    }

    let markdown =
        fs::read_to_string(&absolute).map_err(|source| VaultError::io(&absolute, source))?;
    let metadata = metadata_from_markdown(vault_id, path, &markdown, modified_at(&absolute)?);

    Ok(NoteDocument { metadata, markdown })
}

/// Extracts metadata from raw markdown content.
pub fn metadata_from_markdown(
    vault_id: &str,
    path: &RelativeVaultPath,
    markdown: &str,
    modified_at: String,
) -> NoteMetadata {
    let (frontmatter, body) = split_frontmatter(markdown);
    let body_for_metrics = body.as_str();
    let note_type = frontmatter
        .as_deref()
        .and_then(|_| crate::frontmatter_ops::get_frontmatter_field(markdown, "type"));
    let organized = frontmatter_bool(markdown, &["_organized", "organized"]);
    let archived = frontmatter_bool(markdown, &["_archived", "archived"]);
    let tags = parse_frontmatter_tags(markdown);

    NoteMetadata {
        id: note_id(vault_id, path),
        vault_id: vault_id.to_string(),
        path: path.to_string(),
        title: extract_title(body_for_metrics, path),
        content_hash: content_hash(markdown),
        modified_at,
        word_count: word_count(body_for_metrics),
        reading_time_minutes: reading_time_minutes(body_for_metrics),
        tags,
        note_type,
        organized,
        archived,
    }
}

fn frontmatter_bool(markdown: &str, keys: &[&str]) -> bool {
    keys.iter().find_map(|key| {
        crate::frontmatter_ops::get_frontmatter_field(markdown, key).map(|value| {
            matches!(value.trim().to_ascii_lowercase().as_str(), "true" | "yes" | "1")
        })
    }).unwrap_or(false)
}

fn parse_frontmatter_tags(markdown: &str) -> Vec<String> {
    let Some(value) = crate::frontmatter_ops::get_frontmatter_field(markdown, "tags") else {
        return Vec::new();
    };
    let value = value.trim();
    let raw = value
        .strip_prefix('[')
        .and_then(|inner| inner.strip_suffix(']'))
        .unwrap_or(value);
    let mut tags: Vec<String> = raw
        .split(',')
        .map(|tag| tag.trim().trim_matches('"').trim_matches('\'').trim_start_matches('#'))
        .filter(|tag| !tag.is_empty())
        .map(str::to_string)
        .collect();
    tags.sort();
    tags.dedup();
    tags
}

/// Generates a unique note ID from vault ID and path.
pub fn note_id(vault_id: &str, path: &RelativeVaultPath) -> String {
    format!("{vault_id}:{}", path.as_str())
}

fn extract_title(markdown: &str, path: &RelativeVaultPath) -> String {
    for line in markdown.lines() {
        if let Some(title) = line.strip_prefix("# ") {
            let trimmed = title.trim();
            if !trimmed.is_empty() {
                return trimmed.to_string();
            }
        }
    }

    Path::new(path.as_str())
        .file_stem()
        .and_then(|stem| stem.to_str())
        .unwrap_or(path.as_str())
        .to_string()
}

fn modified_at(path: &Path) -> Result<String, VaultError> {
    let modified = fs::metadata(path)
        .map_err(|source| VaultError::io(path, source))?
        .modified()
        .map_err(|source| VaultError::io(path, source))?;

    let datetime: DateTime<Utc> = modified.into();
    Ok(datetime.to_rfc3339())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn metadata_uses_body_metrics_and_frontmatter_fields() {
        let path = RelativeVaultPath::parse("notes/test.md").unwrap();
        let markdown = "---\ntype: Project\n_organized: true\narchived: yes\ntags: [one, '#two']\nsecret: words do not count\n---\n\n# Body\n\none two three\n";
        let metadata = metadata_from_markdown("vault", &path, markdown, "now".into());
        assert_eq!(metadata.title, "Body");
        assert_eq!(metadata.note_type.as_deref(), Some("Project"));
        assert!(metadata.organized);
        assert!(metadata.archived);
        assert_eq!(metadata.tags, vec!["one", "two"]);
        assert_eq!(metadata.word_count, 5);
        assert_eq!(metadata.reading_time_minutes, 1);
    }
}
