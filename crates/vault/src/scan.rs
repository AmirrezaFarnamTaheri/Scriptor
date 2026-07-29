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
    /// Note markdown captured during the scan (already read to compute the
    /// content hash), so consumers such as the index rebuild can avoid a
    /// second read of every file. `None` for assets and directories.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub content: Option<String>,
}

/// Scans the vault root for all entries (notes, assets, directories).
pub fn scan_vault(root: &VaultRoot) -> Result<Vec<ScannedEntry>, VaultError> {
    scan_vault_with_roots(root, &[])
}

/// Scans the vault root and any extra root directories for entries.
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
        // Prune internal `.scriptor` directories at the walker level instead of
        // descending into them and discarding entries afterwards.
        .filter_entry(|entry| {
            entry.depth() == 0 || entry.file_name() != std::ffi::OsStr::new(".scriptor")
        })
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

        let metadata = entry
            .metadata()
            .map_err(|source| VaultError::io(absolute, source.into()))?;
        // Derive the modified time from the metadata already in hand instead of
        // re-statting the path.
        let modified_at = modified_from_metadata(&metadata);

        if metadata.is_dir() {
            entries.push(ScannedEntry {
                path: relative_suffix,
                kind: ScannedEntryKind::Directory,
                content_hash: None,
                modified_at,
                size_bytes: 0,
                content: None,
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
            // Read raw bytes and convert lossily: a single note with invalid
            // UTF-8 must not abort the whole vault scan.
            let bytes = fs::read(absolute).map_err(|source| VaultError::io(absolute, source))?;
            Some(String::from_utf8_lossy(&bytes).into_owned())
        } else {
            None
        };

        entries.push(ScannedEntry {
            path: relative_suffix,
            kind,
            content_hash: content.as_deref().map(content_hash),
            modified_at,
            size_bytes: metadata.len(),
            content,
        });
    }

    Ok(entries)
}

fn modified_from_metadata(metadata: &fs::Metadata) -> Option<String> {
    metadata.modified().ok().map(|modified| {
        let datetime: DateTime<Utc> = modified.into();
        datetime.to_rfc3339()
    })
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

/// Lists all note paths in the vault.
pub fn list_notes(root: &VaultRoot) -> Result<Vec<RelativeVaultPath>, VaultError> {
    scan_vault(root)?
        .into_iter()
        .filter(|entry| entry.kind == ScannedEntryKind::Note)
        .map(|entry| RelativeVaultPath::parse(&entry.path))
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn scan_tolerates_invalid_utf8_note() {
        let tmp = tempfile::tempdir().unwrap();
        std::fs::write(tmp.path().join("bad.md"), [0x66, 0x6f, 0xff, 0xfe, 0x6f]).unwrap();
        std::fs::write(tmp.path().join("good.md"), "# Good").unwrap();

        let root = VaultRoot::open(tmp.path()).unwrap();
        let entries = scan_vault(&root).unwrap();
        let notes: Vec<_> = entries
            .iter()
            .filter(|entry| entry.kind == ScannedEntryKind::Note)
            .collect();
        assert_eq!(notes.len(), 2);

        let bad = notes.iter().find(|entry| entry.path == "bad.md").unwrap();
        assert!(bad.content.as_deref().unwrap().contains('\u{FFFD}'));
        assert!(bad.content_hash.is_some());
    }

    #[test]
    fn scan_prunes_scriptor_dir_and_captures_note_content() {
        let tmp = tempfile::tempdir().unwrap();
        std::fs::create_dir_all(tmp.path().join(".scriptor/exports")).unwrap();
        std::fs::write(tmp.path().join(".scriptor/exports/x.md"), "hidden").unwrap();
        std::fs::write(tmp.path().join("note.md"), "# Note").unwrap();

        let root = VaultRoot::open(tmp.path()).unwrap();
        let entries = scan_vault(&root).unwrap();
        assert!(entries.iter().all(|entry| !entry.path.starts_with(".scriptor")));

        let note = entries.iter().find(|entry| entry.path == "note.md").unwrap();
        assert_eq!(note.content.as_deref(), Some("# Note"));
        assert!(note.modified_at.is_some());
        assert!(note.content_hash.is_some());
    }
}
