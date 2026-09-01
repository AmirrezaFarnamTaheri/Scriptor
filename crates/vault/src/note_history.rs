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

/// Minimum seconds between history snapshots for the same note. Autosave
/// fires roughly every 700ms while typing; without a throttle that is six
/// filesystem mutations per second of typing for one throwaway revision.
/// Meaningful edits (> MIN_CHARS_FOR_IMMEDIATE_SNAPSHOT chars delta) still
/// snapshot immediately.
const MIN_SECONDS_BETWEEN_SNAPSHOTS: u64 = 180;
const MIN_CHARS_FOR_IMMEDIATE_SNAPSHOT: usize = 50;

/// History append with a time+size throttle. `previous_markdown` is the
/// body the snapshot would capture; when the newest revision is younger than
/// the throttle window AND the delta is small, the append is skipped (the
/// note body itself is already persisted by the save).
pub fn append_note_history_throttled(
    root: &VaultRoot,
    note_path: &str,
    markdown: &str,
    content_hash: &str,
    previous_markdown: Option<&str>,
) -> Result<NoteHistoryEntry, VaultError> {
    if let Some(previous) = previous_markdown
        && should_skip_snapshot(root, note_path, previous, markdown)
    {
        // Return the newest existing revision so callers cannot tell the
        // difference without re-reading the manifest.
        let manifest_file = manifest_path(root, note_path);
        if let Ok(raw) = fs::read_to_string(&manifest_file)
            && let Ok(manifest) = serde_json::from_str::<NoteHistoryManifest>(&raw)
            && let Some(latest) = manifest.revisions.first()
        {
            return Ok(latest.clone());
        }
        // Manifest unreadable: fall through and snapshot normally.
        return append_note_history(root, note_path, markdown, content_hash);
    }
    append_note_history(root, note_path, markdown, content_hash)
}

/// True when the newest snapshot is recent AND the edit is small enough to
/// fold into the next snapshot window.
fn should_skip_snapshot(
    root: &VaultRoot,
    note_path: &str,
    previous_markdown: &str,
    markdown: &str,
) -> bool {
    let delta = previous_markdown.len().abs_diff(markdown.len());
    if delta > MIN_CHARS_FOR_IMMEDIATE_SNAPSHOT {
        return false;
    }
    let manifest_file = manifest_path(root, note_path);
    let Ok(raw) = fs::read_to_string(&manifest_file) else {
        return false;
    };
    let Ok(manifest) = serde_json::from_str::<NoteHistoryManifest>(&raw) else {
        return false;
    };
    let Some(latest) = manifest.revisions.first() else {
        return false;
    };
    let Ok(saved_at) = chrono::DateTime::parse_from_rfc3339(&latest.saved_at) else {
        return false;
    };
    saved_at
        .signed_duration_since(chrono::Utc::now())
        .num_seconds()
        .unsigned_abs()
        < MIN_SECONDS_BETWEEN_SNAPSHOTS
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

    fn write_note(dir: &std::path::Path, body: &str) {
        std::fs::write(dir.join("note.md"), body).unwrap();
    }

    #[test]
    fn small_rapid_edits_are_folded_into_one_snapshot() {
        let dir = tempfile::tempdir().unwrap();
        write_note(dir.path(), "# Note\n\noriginal body\n");
        let root = VaultRoot::open(dir.path()).unwrap();

        let first = append_note_history(&root, "note.md", "original body", "h1").unwrap();
        // A tiny edit within the throttle window folds in: no new revision.
        let folded = append_note_history_throttled(
            &root,
            "note.md",
            "original body!",
            "h2",
            Some("original body"),
        )
        .unwrap();
        assert_eq!(
            folded.id, first.id,
            "small rapid edit must reuse the newest snapshot"
        );
        let listed = list_note_history(&root, "note.md").unwrap();
        assert_eq!(listed.len(), 1);
    }

    #[test]
    fn large_edits_snapshot_immediately() {
        let dir = tempfile::tempdir().unwrap();
        write_note(dir.path(), "# Note\n\noriginal body\n");
        let root = VaultRoot::open(dir.path()).unwrap();

        let first = append_note_history(&root, "note.md", "original body", "h1").unwrap();
        let rewritten = format!("# Note\n\n{}\n", "x".repeat(400));
        let second = append_note_history_throttled(
            &root,
            "note.md",
            &rewritten,
            "h2",
            Some("original body"),
        )
        .unwrap();
        assert_ne!(
            second.id, first.id,
            "a large edit must snapshot immediately"
        );
        let listed = list_note_history(&root, "note.md").unwrap();
        assert_eq!(listed.len(), 2);
    }

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
