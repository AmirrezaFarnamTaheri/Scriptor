use std::fs;
use std::path::Path;

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use walkdir::WalkDir;

use crate::error::VaultError;
use crate::hash::content_hash;
use crate::path::{RelativeVaultPath, VaultRoot};

pub const MAX_SCAN_ENTRIES: usize = 250_000;
pub const MAX_INDEXED_NOTE_BYTES: u64 = 16 * 1024 * 1024;

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
    /// Note content is present only for explicit indexing scans. Directory and
    /// user-interface inventory scans are metadata-only and never retain every
    /// note body in one large result vector.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub content: Option<String>,
    #[serde(default, skip_serializing_if = "is_false")]
    pub content_omitted: bool,
}

#[derive(Debug, Clone, Copy)]
struct ScanOptions {
    include_note_content: bool,
    max_note_bytes: u64,
    max_entries: usize,
}

impl ScanOptions {
    const METADATA: Self = Self {
        include_note_content: false,
        max_note_bytes: 0,
        max_entries: MAX_SCAN_ENTRIES,
    };

    const INDEX: Self = Self {
        include_note_content: true,
        max_note_bytes: MAX_INDEXED_NOTE_BYTES,
        max_entries: MAX_SCAN_ENTRIES,
    };
}

fn is_false(value: &bool) -> bool {
    !*value
}

/// Metadata-only vault inventory. Note bodies are loaded lazily by consumers.
pub fn scan_vault(root: &VaultRoot) -> Result<Vec<ScannedEntry>, VaultError> {
    scan_vault_with_roots(root, &[])
}

/// Metadata-only inventory of the vault root and configured extra roots.
pub fn scan_vault_with_roots(
    root: &VaultRoot,
    extra_roots: &[String],
) -> Result<Vec<ScannedEntry>, VaultError> {
    scan_with_options(root, extra_roots, ScanOptions::METADATA)
}

/// Indexing scan that captures bounded note bodies once so rebuild can avoid a
/// second read. Notes above `MAX_INDEXED_NOTE_BYTES` remain metadata-only and
/// are reported with `content_omitted = true`.
pub fn scan_vault_for_index(root: &VaultRoot) -> Result<Vec<ScannedEntry>, VaultError> {
    scan_vault_with_roots_for_index(root, &[])
}

pub fn scan_vault_with_roots_for_index(
    root: &VaultRoot,
    extra_roots: &[String],
) -> Result<Vec<ScannedEntry>, VaultError> {
    scan_with_options(root, extra_roots, ScanOptions::INDEX)
}

fn scan_with_options(
    root: &VaultRoot,
    extra_roots: &[String],
    options: ScanOptions,
) -> Result<Vec<ScannedEntry>, VaultError> {
    let mut entries = scan_directory(root, root.root(), "", options)?;

    for extra in extra_roots {
        let trimmed = extra.trim();
        if trimmed.is_empty() {
            continue;
        }
        let relative = RelativeVaultPath::parse(trimmed)?;
        let absolute = root.resolve_relative(&relative)?;
        if absolute.is_dir() {
            let remaining = options.max_entries.saturating_sub(entries.len());
            if remaining == 0 {
                return Err(VaultError::ScanLimitExceeded {
                    limit: options.max_entries,
                });
            }
            entries.extend(scan_directory(
                root,
                &absolute,
                trimmed,
                ScanOptions {
                    max_entries: remaining,
                    ..options
                },
            )?);
        }
    }

    entries.sort_by(|left, right| left.path.cmp(&right.path));
    Ok(entries)
}

fn scan_directory(
    root: &VaultRoot,
    directory: &Path,
    path_prefix: &str,
    options: ScanOptions,
) -> Result<Vec<ScannedEntry>, VaultError> {
    let mut entries = Vec::new();
    let walker = WalkDir::new(directory)
        .follow_links(false)
        .into_iter()
        .filter_entry(|entry| {
            entry.depth() == 0 || entry.file_name() != std::ffi::OsStr::new(".scriptor")
        });

    for entry in walker {
        let entry = entry.map_err(|error| {
            let path = error
                .path()
                .map(Path::to_path_buf)
                .unwrap_or_else(|| directory.to_path_buf());
            VaultError::io(path, error.into_io_error().unwrap_or_else(|| {
                std::io::Error::other("failed to enumerate vault entry")
            }))
        })?;
        let absolute = entry.path();
        if absolute == directory && path_prefix.is_empty() {
            continue;
        }
        if entries.len() >= options.max_entries {
            return Err(VaultError::ScanLimitExceeded {
                limit: options.max_entries,
            });
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
        let modified_at = modified_from_metadata(&metadata);

        if metadata.is_dir() {
            entries.push(ScannedEntry {
                path: relative_suffix,
                kind: ScannedEntryKind::Directory,
                content_hash: None,
                modified_at,
                size_bytes: 0,
                content: None,
                content_omitted: false,
            });
            continue;
        }

        let is_note = relative_suffix.ends_with(".md");
        let kind = if is_note {
            ScannedEntryKind::Note
        } else {
            ScannedEntryKind::Asset
        };
        let should_capture = is_note
            && options.include_note_content
            && metadata.len() <= options.max_note_bytes;
        let content = if should_capture {
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
            content_omitted: is_note && options.include_note_content && !should_capture,
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
    fn metadata_scan_does_not_retain_note_bodies() {
        let tmp = tempfile::tempdir().unwrap();
        std::fs::write(tmp.path().join("note.md"), "# Note").unwrap();
        let root = VaultRoot::open(tmp.path()).unwrap();
        let note = scan_vault(&root)
            .unwrap()
            .into_iter()
            .find(|entry| entry.path == "note.md")
            .unwrap();
        assert!(note.content.is_none());
        assert!(note.content_hash.is_none());
        assert!(!note.content_omitted);
    }

    #[test]
    fn index_scan_tolerates_invalid_utf8_note() {
        let tmp = tempfile::tempdir().unwrap();
        std::fs::write(tmp.path().join("bad.md"), [0x66, 0x6f, 0xff, 0xfe, 0x6f]).unwrap();
        std::fs::write(tmp.path().join("good.md"), "# Good").unwrap();

        let root = VaultRoot::open(tmp.path()).unwrap();
        let entries = scan_vault_for_index(&root).unwrap();
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
    fn scan_prunes_scriptor_dir() {
        let tmp = tempfile::tempdir().unwrap();
        std::fs::create_dir_all(tmp.path().join(".scriptor/exports")).unwrap();
        std::fs::write(tmp.path().join(".scriptor/exports/x.md"), "hidden").unwrap();
        std::fs::write(tmp.path().join("note.md"), "# Note").unwrap();
        let root = VaultRoot::open(tmp.path()).unwrap();
        let entries = scan_vault(&root).unwrap();
        assert!(entries.iter().all(|entry| !entry.path.starts_with(".scriptor")));
    }

    #[test]
    fn oversized_index_note_is_metadata_only() {
        let tmp = tempfile::tempdir().unwrap();
        let path = tmp.path().join("large.md");
        let file = std::fs::File::create(&path).unwrap();
        file.set_len(MAX_INDEXED_NOTE_BYTES + 1).unwrap();
        let root = VaultRoot::open(tmp.path()).unwrap();
        let note = scan_vault_for_index(&root)
            .unwrap()
            .into_iter()
            .find(|entry| entry.path == "large.md")
            .unwrap();
        assert!(note.content.is_none());
        assert!(note.content_omitted);
    }
}
