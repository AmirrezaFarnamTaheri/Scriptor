use std::fs;
use std::path::Path;

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use walkdir::WalkDir;

use crate::error::VaultError;
use crate::hash::content_hash;
use crate::path::{RelativeVaultPath, VaultRoot};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum ScannedEntryKind {
    Note,
    Asset,
    Directory,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ScannedEntry {
    pub path: String,
    pub kind: ScannedEntryKind,
    pub content_hash: Option<String>,
    pub modified_at: Option<String>,
    pub size_bytes: u64,
}

pub fn scan_vault(root: &VaultRoot) -> Result<Vec<ScannedEntry>, VaultError> {
    scan_vault_with_roots(root, &[])
}

pub fn scan_vault_with_roots(
    root: &VaultRoot,
    extra_roots: &[String],
) -> Result<Vec<ScannedEntry>, VaultError> {
    let mut entries = scan_directory(root, root.root(), "")?;

    for extra in extra_roots {
        let trimmed = extra.trim();
        if trimmed.is_empty() {
            continue;
        }
        let relative = RelativeVaultPath::parse(trimmed)?;
        let absolute = root.resolve_relative(&relative)?;
        if absolute.is_dir() {
            entries.extend(scan_directory(root, &absolute, trimmed)?);
        }
    }

    entries.sort_by(|left, right| left.path.cmp(&right.path));
    Ok(entries)
}

fn scan_directory(
    root: &VaultRoot,
    directory: &Path,
    path_prefix: &str,
) -> Result<Vec<ScannedEntry>, VaultError> {
    let mut entries = Vec::new();

    for entry in WalkDir::new(directory)
        .follow_links(false)
        .into_iter()
        .filter_map(|entry| entry.ok())
    {
        let absolute = entry.path();
        if absolute == directory && path_prefix.is_empty() {
            continue;
        }

        let relative_suffix = if path_prefix.is_empty() {
            root.relative_path(absolute)?.as_str().to_string()
        } else if absolute == directory {
            continue;
        } else {
            let suffix = absolute
                .strip_prefix(directory)
                .map_err(|_| VaultError::InvalidRelativePath(absolute.display().to_string()))?;
            format!(
                "{}/{}",
                path_prefix.trim_end_matches('/'),
                format_path(suffix)
            )
        };

        if relative_suffix == ".scriptor" || relative_suffix.starts_with(".scriptor/") {
            continue;
        }

        let metadata = entry
            .metadata()
            .map_err(|source| VaultError::io(absolute, source.into()))?;

        if metadata.is_dir() {
            entries.push(ScannedEntry {
                path: relative_suffix,
                kind: ScannedEntryKind::Directory,
                content_hash: None,
                modified_at: modified_at(absolute).ok(),
                size_bytes: 0,
            });
            continue;
        }

        let is_note = relative_suffix.ends_with(".md");
        let kind = if is_note {
            ScannedEntryKind::Note
        } else {
            ScannedEntryKind::Asset
        };

        let content = if is_note {
            Some(fs::read_to_string(absolute).map_err(|source| VaultError::io(absolute, source))?)
        } else {
            None
        };

        entries.push(ScannedEntry {
            path: relative_suffix,
            kind,
            content_hash: content.as_deref().map(content_hash),
            modified_at: modified_at(absolute).ok(),
            size_bytes: metadata.len(),
        });
    }

    Ok(entries)
}

fn format_path(path: &Path) -> String {
    path.components()
        .filter_map(|component| match component {
            std::path::Component::Normal(part) => Some(part.to_string_lossy().into_owned()),
            _ => None,
        })
        .collect::<Vec<_>>()
        .join("/")
}

pub fn list_notes(root: &VaultRoot) -> Result<Vec<RelativeVaultPath>, VaultError> {
    scan_vault(root)?
        .into_iter()
        .filter(|entry| entry.kind == ScannedEntryKind::Note)
        .map(|entry| RelativeVaultPath::parse(&entry.path))
        .collect()
}

fn modified_at(path: &Path) -> Result<String, VaultError> {
    let modified = fs::metadata(path)
        .map_err(|source| VaultError::io(path, source))?
        .modified()
        .map_err(|source| VaultError::io(path, source))?;

    let datetime: DateTime<Utc> = modified.into();
    Ok(datetime.to_rfc3339())
}
