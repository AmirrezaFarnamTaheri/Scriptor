use std::fs;
use std::path::Path;

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

use crate::error::VaultError;
use crate::hash::{content_hash, reading_time_minutes, word_count};
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

pub fn read_note(
    vault_id: &str,
    root: &VaultRoot,
    path: &RelativeVaultPath,
) -> Result<NoteDocument, VaultError> {
    let absolute = root.resolve_relative(path)?;
    if !absolute.is_file() {
        return Err(VaultError::NoteNotFound(path.to_string()));
    }

    let markdown = fs::read_to_string(&absolute).map_err(|source| VaultError::io(&absolute, source))?;
    let metadata = metadata_from_markdown(vault_id, path, &markdown, modified_at(&absolute)?);

    Ok(NoteDocument { metadata, markdown })
}

pub fn metadata_from_markdown(
    vault_id: &str,
    path: &RelativeVaultPath,
    markdown: &str,
    modified_at: String,
) -> NoteMetadata {
    NoteMetadata {
        id: note_id(vault_id, path),
        vault_id: vault_id.to_string(),
        path: path.to_string(),
        title: extract_title(markdown, path),
        content_hash: content_hash(markdown),
        modified_at,
        word_count: word_count(markdown),
        reading_time_minutes: reading_time_minutes(markdown),
        tags: Vec::new(),
        note_type: None,
        organized: false,
        archived: false,
    }
}

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
