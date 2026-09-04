use std::fs;
use std::path::Path;

use crate::fs::atomic_write;
use crate::hash::{content_hash_bytes, path_hash};
use crate::note_history::append_note_history_throttled;

use serde::{Deserialize, Serialize};

use crate::error::VaultError;
use crate::note::{NoteMetadata, metadata_from_markdown, read_note};
use crate::path::{RelativeVaultPath, VaultRoot};

pub const EXPECTED_MISSING_CONTENT_HASH: &str = "<missing>";

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct SaveNoteOutput {
    pub metadata: NoteMetadata,
    pub previous_content_hash: Option<String>,
    pub dry_run: bool,
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
pub struct SaveNoteOptions {
    pub dry_run: bool,
}

/// Saves a note to the vault with default options.
pub fn save_note(
    vault_id: &str,
    root: &VaultRoot,
    path: &RelativeVaultPath,
    markdown: &str,
    expected_content_hash: Option<&str>,
) -> Result<SaveNoteOutput, VaultError> {
    save_note_with_options(
        vault_id,
        root,
        path,
        markdown,
        expected_content_hash,
        SaveNoteOptions::default(),
    )
}

/// Saves a note with explicit options (e.g., dry-run mode).
pub fn save_note_with_options(
    vault_id: &str,
    root: &VaultRoot,
    path: &RelativeVaultPath,
    markdown: &str,
    expected_content_hash: Option<&str>,
    options: SaveNoteOptions,
) -> Result<SaveNoteOutput, VaultError> {
    let absolute = root.resolve_relative(path)?;

    // A blank/whitespace expected hash means the caller is not asserting a CAS
    // precondition at all (for example a frontend sends an empty string when it
    // is creating a brand-new note and has no prior hash). Normalize it to `None`
    // so genuine create-new flows do not trip a spurious HashMismatch. Callers
    // that genuinely require the note to be absent use
    // `EXPECTED_MISSING_CONTENT_HASH` ("<missing>").
    let expected_content_hash = expected_content_hash
        .map(str::trim)
        .filter(|value| !value.is_empty());

    // Snapshot the existing file once as raw bytes.  CAS and recovery must work
    // even for a legacy/non-UTF-8 `.md`; history is recorded only when the old
    // bytes are valid UTF-8.
    let existing_metadata = fs::metadata(&absolute).ok().filter(|meta| meta.is_file());
    let existing_bytes = if existing_metadata.is_some() {
        Some(fs::read(&absolute).map_err(|source| VaultError::io(&absolute, source))?)
    } else {
        None
    };
    let previous_content_hash = existing_bytes.as_deref().map(content_hash_bytes);

    match (expected_content_hash, previous_content_hash.as_deref()) {
        (Some(EXPECTED_MISSING_CONTENT_HASH), None) => {}
        (Some(EXPECTED_MISSING_CONTENT_HASH), Some(found)) => {
            return Err(VaultError::HashMismatch {
                path: path.to_string(),
                expected: EXPECTED_MISSING_CONTENT_HASH.to_string(),
                found: found.to_string(),
            });
        }
        (Some(expected), Some(found)) if expected != found => {
            return Err(VaultError::HashMismatch {
                path: path.to_string(),
                expected: expected.to_string(),
                found: found.to_string(),
            });
        }
        (Some(expected), None) => {
            return Err(VaultError::HashMismatch {
                path: path.to_string(),
                expected: expected.to_string(),
                found: "<missing>".into(),
            });
        }
        _ => {}
    }

    let observed_modified_at = existing_metadata
        .as_ref()
        .and_then(|metadata| metadata.modified().ok())
        .map(|modified| chrono::DateTime::<chrono::Utc>::from(modified).to_rfc3339())
        .unwrap_or_else(|| chrono::Utc::now().to_rfc3339());
    let metadata = metadata_from_markdown(vault_id, path, markdown, observed_modified_at);

    if options.dry_run {
        return Ok(SaveNoteOutput {
            metadata,
            previous_content_hash,
            dry_run: true,
        });
    }

    if let Some(parent) = absolute.parent() {
        fs::create_dir_all(parent).map_err(|source| VaultError::io(parent, source))?;
    }

    if let Some(existing) = existing_bytes.as_deref() {
        backup_for_recovery(root, path.as_str(), existing)?;
        if let Ok(previous_markdown) = std::str::from_utf8(existing) {
            if let Err(error) = append_note_history_throttled(
                root,
                path.as_str(),
                previous_markdown,
                previous_content_hash.as_deref().unwrap_or_default(),
                Some(markdown),
            ) {
                tracing::warn!(
                    target: "scriptor_vault::write",
                    vault_id,
                    note_path = %path.as_str(),
                    error = %error,
                    "failed to append note history before overwrite; save continues",
                );
            }
        }
    }

    atomic_write(&absolute, markdown.as_bytes())?;

    let modified_system = fs::metadata(&absolute)
        .map_err(|source| VaultError::io(&absolute, source))?
        .modified()
        .map_err(|source| VaultError::io(&absolute, source))?;

    let metadata = metadata_from_markdown(
        vault_id,
        path,
        markdown,
        chrono::DateTime::<chrono::Utc>::from(modified_system).to_rfc3339(),
    );

    Ok(SaveNoteOutput {
        metadata,
        previous_content_hash,
        dry_run: false,
    })
}

fn recovery_backup_path(root: &VaultRoot, relative_path: &str) -> std::path::PathBuf {
    let hash = path_hash(relative_path);
    let name = format!("{}.md", &hash[..16]);
    root.root().join(".scriptor").join("recovery").join(name)
}

fn backup_for_recovery(
    root: &VaultRoot,
    relative_path: &str,
    content: &[u8],
) -> Result<(), VaultError> {
    let backup_path = recovery_backup_path(root, relative_path);
    if let Some(parent) = backup_path.parent() {
        fs::create_dir_all(parent).map_err(|source| VaultError::io(parent, source))?;
    }
    atomic_write(&backup_path, content)
}

/// Restores disk state after a failed post-save index update.
pub fn rollback_save_note(
    vault_id: &str,
    root: &VaultRoot,
    path: &RelativeVaultPath,
    previous_content_hash: Option<&str>,
) -> Result<(), VaultError> {
    let absolute = root.resolve_relative(path)?;
    match previous_content_hash {
        None => {
            if absolute.exists() {
                fs::remove_file(&absolute).map_err(|source| VaultError::io(&absolute, source))?;
            }
            Ok(())
        }
        Some(expected_hash) => {
            let backup_path = recovery_backup_path(root, path.as_str());
            let markdown =
                fs::read(&backup_path).map_err(|source| VaultError::io(&backup_path, source))?;
            atomic_write(&absolute, &markdown)?;
            let restored = read_note(vault_id, root, path)?;
            if restored.metadata.content_hash != expected_hash {
                return Err(VaultError::InvalidConfig {
                    message: format!(
                        "rollback hash mismatch for {}: expected {expected_hash}, found {}",
                        path, restored.metadata.content_hash
                    ),
                });
            }
            Ok(())
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::open::open_vault;
    use tempfile::tempdir;

    #[test]
    fn atomic_save_creates_note() {
        let dir = tempdir().unwrap();
        let session = open_vault(dir.path()).unwrap();
        let path = RelativeVaultPath::parse("notes/new-note.md").unwrap();
        let output = save_note(
            &session.descriptor.id,
            &session.root,
            &path,
            "# New\n\nBody",
            None,
        )
        .unwrap();

        assert_eq!(output.metadata.title, "New");
        assert!(!output.dry_run);
        assert!(dir.path().join("notes/new-note.md").exists());
    }

    #[test]
    fn empty_expected_hash_is_treated_as_no_cas() {
        let dir = tempdir().unwrap();
        let session = open_vault(dir.path()).unwrap();
        let path = RelativeVaultPath::parse("new-empty.md").unwrap();
        // An empty (or blank) expected hash must not fail a create-new save.
        for blank in ["", "   "] {
            let output = save_note(
                &session.descriptor.id,
                &session.root,
                &path,
                "# Created\n",
                Some(blank),
            )
            .unwrap();
            assert!(!output.dry_run);
        }
        assert!(dir.path().join("new-empty.md").exists());
    }

    #[test]
    fn cas_rejects_when_expected_hash_targets_a_missing_file() {
        let dir = tempdir().unwrap();
        let session = open_vault(dir.path()).unwrap();
        let path = RelativeVaultPath::parse("must-exist.md").unwrap();
        // A real expected hash implies the caller believes the file already
        // exists with that content; if it is absent the save must not silently
        // create it (that would mask a concurrent delete).
        let err = save_note(
            &session.descriptor.id,
            &session.root,
            &path,
            "# Nope\n",
            Some("0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"),
        )
        .unwrap_err();
        assert!(matches!(err, VaultError::HashMismatch { .. }));
        assert!(!dir.path().join("must-exist.md").exists());
    }

    #[test]
    fn missing_sentinel_requires_file_to_be_absent() {
        let dir = tempdir().unwrap();
        let session = open_vault(dir.path()).unwrap();
        let path = RelativeVaultPath::parse("only-once.md").unwrap();
        // "<missing>" permits creating an absent note...
        save_note(
            &session.descriptor.id,
            &session.root,
            &path,
            "# First\n",
            Some(EXPECTED_MISSING_CONTENT_HASH),
        )
        .unwrap();
        // ...but rejects overwriting an existing one (avoids clobbering).
        let err = save_note(
            &session.descriptor.id,
            &session.root,
            &path,
            "# Second\n",
            Some(EXPECTED_MISSING_CONTENT_HASH),
        )
        .unwrap_err();
        assert!(matches!(err, VaultError::HashMismatch { .. }));
    }

    #[test]
    fn dry_run_does_not_write_file() {
        let dir = tempdir().unwrap();
        let session = open_vault(dir.path()).unwrap();
        let path = RelativeVaultPath::parse("dry-run.md").unwrap();
        let output = save_note_with_options(
            &session.descriptor.id,
            &session.root,
            &path,
            "# Dry\n",
            None,
            SaveNoteOptions { dry_run: true },
        )
        .unwrap();
        assert!(output.dry_run);
        assert!(!dir.path().join("dry-run.md").exists());
    }

    #[test]
    fn recovery_backup_written_before_overwrite() {
        let dir = tempdir().unwrap();
        let session = open_vault(dir.path()).unwrap();
        let path = RelativeVaultPath::parse("note.md").unwrap();
        save_note(
            &session.descriptor.id,
            &session.root,
            &path,
            "# One\n",
            None,
        )
        .unwrap();
        save_note(
            &session.descriptor.id,
            &session.root,
            &path,
            "# Two\n",
            None,
        )
        .unwrap();
        let recovery_dir = dir.path().join(".scriptor/recovery");
        assert!(recovery_dir.exists());
        assert!(fs::read_dir(recovery_dir).unwrap().count() >= 1);
    }

    #[test]
    fn rollback_save_note_restores_overwritten_content() {
        let dir = tempdir().unwrap();
        let session = open_vault(dir.path()).unwrap();
        let path = RelativeVaultPath::parse("note.md").unwrap();
        let first = save_note(
            &session.descriptor.id,
            &session.root,
            &path,
            "# One\n\nBody\n",
            None,
        )
        .unwrap();
        save_note(
            &session.descriptor.id,
            &session.root,
            &path,
            "# Two\n\nChanged\n",
            None,
        )
        .unwrap();
        rollback_save_note(
            &session.descriptor.id,
            &session.root,
            &path,
            Some(first.metadata.content_hash.as_str()),
        )
        .unwrap();
        let restored = read_note(&session.descriptor.id, &session.root, &path).unwrap();
        assert_eq!(restored.metadata.content_hash, first.metadata.content_hash);
        assert!(restored.markdown.contains("# One"));
    }

    #[test]
    fn rollback_save_note_rejects_noncanonical_recovery_backup() {
        let dir = tempdir().unwrap();
        let session = open_vault(dir.path()).unwrap();
        let path = RelativeVaultPath::parse("legacy.md").unwrap();
        let first = save_note(
            &session.descriptor.id,
            &session.root,
            &path,
            "# Original\n",
            None,
        )
        .unwrap();
        save_note(
            &session.descriptor.id,
            &session.root,
            &path,
            "# Changed\n",
            None,
        )
        .unwrap();

        let current = recovery_backup_path(&session.root, path.as_str());
        let noncanonical = current.with_file_name(format!("{}.md", &path_hash(path.as_str())[..8]));
        fs::rename(&current, &noncanonical).unwrap();

        assert!(
            rollback_save_note(
                &session.descriptor.id,
                &session.root,
                &path,
                Some(first.metadata.content_hash.as_str()),
            )
            .is_err()
        );
    }

    #[test]
    fn rollback_save_note_removes_new_file() {
        let dir = tempdir().unwrap();
        let session = open_vault(dir.path()).unwrap();
        let path = RelativeVaultPath::parse("new.md").unwrap();
        save_note(
            &session.descriptor.id,
            &session.root,
            &path,
            "# New\n",
            None,
        )
        .unwrap();
        assert!(dir.path().join("new.md").exists());
        rollback_save_note(&session.descriptor.id, &session.root, &path, None).unwrap();
        assert!(!dir.path().join("new.md").exists());
    }
}
