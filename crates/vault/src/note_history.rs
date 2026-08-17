use std::fs;
use std::path::PathBuf;

use chrono::Utc;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::error::VaultError;
use crate::fs::atomic_write;
use crate::hash::path_hash;
use crate::path::VaultRoot;

pub const DEFAULT_NOTE_HISTORY_DIR: &str = ".scriptor/history";
pub const MAX_REVISIONS_PER_NOTE: usize = 50;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct NoteHistoryEntry {
    pub id: String,
    pub saved_at: String,
    pub content_hash: String,
    pub word_count: u32,
    pub preview: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
struct NoteHistoryManifest {
    note_path: String,
    revisions: Vec<NoteHistoryEntry>,
}

fn history_key(relative_path: &str) -> String {
    path_hash(relative_path)
}

fn history_dir(root: &VaultRoot, relative_path: &str) -> PathBuf {
    root.root()
        .join(DEFAULT_NOTE_HISTORY_DIR)
        .join(history_key(relative_path))
}

fn manifest_path(root: &VaultRoot, relative_path: &str) -> PathBuf {
    history_dir(root, relative_path).join("manifest.json")
}

fn revision_path(
    root: &VaultRoot,
    relative_path: &str,
    revision_id: &str,
) -> Result<PathBuf, VaultError> {
    // Revision ids are always generated as UUIDs (see append_note_history); reject
    // anything else so a caller-supplied id can never traverse out of the history dir.
    let parsed = Uuid::parse_str(revision_id).map_err(|_| {
        VaultError::InvalidRelativePath(format!("invalid revision id: {revision_id}"))
    })?;
    Ok(history_dir(root, relative_path).join(format!("{parsed}.md")))
}

fn preview_line(markdown: &str) -> String {
    markdown
        .lines()
        .find(|line| !line.trim().is_empty())
        .unwrap_or("")
        .chars()
        .take(120)
        .collect()
}

pub fn list_note_history(
    root: &VaultRoot,
    note_path: &str,
) -> Result<Vec<NoteHistoryEntry>, VaultError> {
    let manifest_path = manifest_path(root, note_path);
    if !manifest_path.is_file() {
        return Ok(Vec::new());
    }
    let raw = fs::read_to_string(&manifest_path)
        .map_err(|source| VaultError::io(&manifest_path, source))?;
    let manifest: NoteHistoryManifest = serde_json::from_str(&raw).map_err(VaultError::from)?;
    Ok(manifest.revisions)
}

pub fn read_note_history_revision(
    root: &VaultRoot,
    note_path: &str,
    revision_id: &str,
) -> Result<String, VaultError> {
    let path = revision_path(root, note_path, revision_id)?;
    fs::read_to_string(&path).map_err(|source| VaultError::io(&path, source))
}

pub fn append_note_history(
    root: &VaultRoot,
    note_path: &str,
    markdown: &str,
    content_hash: &str,
) -> Result<NoteHistoryEntry, VaultError> {
    let dir = history_dir(root, note_path);
    fs::create_dir_all(&dir).map_err(|source| VaultError::io(&dir, source))?;

    let entry = NoteHistoryEntry {
        id: Uuid::new_v4().to_string(),
        saved_at: Utc::now().to_rfc3339(),
        content_hash: content_hash.to_string(),
        word_count: markdown.split_whitespace().count() as u32,
        preview: preview_line(markdown),
    };

    let snapshot = revision_path(root, note_path, &entry.id)?;
    atomic_write(&snapshot, markdown.as_bytes())?;

    let manifest_file = manifest_path(root, note_path);
    let mut manifest = if manifest_file.is_file() {
        let raw = fs::read_to_string(&manifest_file)
            .map_err(|source| VaultError::io(&manifest_file, source))?;
        serde_json::from_str(&raw).unwrap_or(NoteHistoryManifest {
            note_path: note_path.to_string(),
            revisions: Vec::new(),
        })
    } else {
        NoteHistoryManifest {
            note_path: note_path.to_string(),
            revisions: Vec::new(),
        }
    };

    manifest.note_path = note_path.to_string();
    manifest.revisions.insert(0, entry.clone());
    if manifest.revisions.len() > MAX_REVISIONS_PER_NOTE {
        for stale in manifest.revisions.split_off(MAX_REVISIONS_PER_NOTE) {
            if let Ok(stale_path) = revision_path(root, note_path, &stale.id) {
                let _ = fs::remove_file(stale_path);
            }
        }
    }

    let payload = serde_json::to_string_pretty(&manifest).map_err(VaultError::from)?;
    atomic_write(&manifest_file, payload.as_bytes())?;
    Ok(entry)
}

pub fn restore_note_history_revision(
    root: &VaultRoot,
    note_path: &str,
    revision_id: &str,
) -> Result<String, VaultError> {
    read_note_history_revision(root, note_path, revision_id)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::open::open_vault;
    use tempfile::tempdir;

    #[test]
    fn append_and_list_note_history() {
        let dir = tempdir().expect("tempdir");
        std::fs::write(dir.path().join("note.md"), "# One\n").expect("write");
        let session = open_vault(dir.path()).expect("open");
        append_note_history(&session.root, "note.md", "# One\n", "hash-one").expect("append");
        append_note_history(&session.root, "note.md", "# Two\n", "hash-two").expect("append");
        let history = list_note_history(&session.root, "note.md").expect("list");
        assert_eq!(history.len(), 2);
        assert_eq!(history[0].content_hash, "hash-two");
        let body =
            read_note_history_revision(&session.root, "note.md", &history[1].id).expect("read");
        assert!(body.contains("# One"));
    }

    #[test]
    fn rejects_non_uuid_revision_ids() {
        let dir = tempdir().expect("tempdir");
        std::fs::write(dir.path().join("note.md"), "# One\n").expect("write");
        let session = open_vault(dir.path()).expect("open");
        append_note_history(&session.root, "note.md", "# One\n", "hash-one").expect("append");

        for hostile in [
            "../../../etc/passwd",
            "..",
            "manifest",
            "a/b",
            "0123456789abcdef0123456789abcdef01234567", // not a uuid
        ] {
            let result = read_note_history_revision(&session.root, "note.md", hostile);
            assert!(
                matches!(result, Err(VaultError::InvalidRelativePath(_))),
                "expected rejection for revision id {hostile:?}"
            );
        }
    }
}
