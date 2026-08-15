use std::fs;
use std::path::Path;

use crate::fs::atomic_write;
use crate::note_history::append_note_history;

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

use crate::error::VaultError;
use crate::note::{NoteMetadata, metadata_from_markdown, read_note};
use crate::path::{RelativeVaultPath, VaultRoot};

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
    if let Some(expected) = expected_content_hash
        && root.resolve_relative(path)?.exists()
    {
        let existing = read_note(vault_id, root, path)?;
        if existing.metadata.content_hash != expected {
            return Err(VaultError::HashMismatch {
                path: path.to_string(),
                expected: expected.to_string(),
                found: existing.metadata.content_hash,
            });
        }
    }

    let absolute = root.resolve_relative(path)?;
    let previous_content_hash = if absolute.exists() {
        Some(read_note(vault_id, root, path)?.metadata.content_hash)
    } else {
        None
    };

    let metadata = if absolute.exists() {
        let modified_system = fs::metadata(&absolute)
            .map_err(|source| VaultError::io(&absolute, source))?
            .modified()
            .map_err(|source| VaultError::io(&absolute, source))?;
        metadata_from_markdown(
            vault_id,
            path,
            markdown,
            chrono::DateTime::<chrono::Utc>::from(modified_system).to_rfc3339(),
        )
    } else {
        metadata_from_markdown(vault_id, path, markdown, chrono::Utc::now().to_rfc3339())
    };

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

    if absolute.exists() {
        backup_for_recovery(root, &absolute, path.as_str())?;
        if let Ok(existing) = read_note(vault_id, root, path)
            && let Err(error) = append_note_history(
                root,
                path.as_str(),
                &existing.markdown,
                &existing.metadata.content_hash,
            )
        {
            // History is a best-effort safety net; the primary save must still
            // succeed. Surface the failure via structured tracing so the daemon
            // telemetry (and operators) can see it, rather than swallowing it.
            tracing::warn!(
                target: "scriptor_vault::write",
                vault_id,
                note_path = %path.as_str(),
                error = %error,
                "failed to append note history before overwrite; save continues",
            );
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
    let digest = Sha256::digest(relative_path.as_bytes());
    let name = format!("{}.md", hex::encode(&digest[..8]));
    root.root().join(".scriptor").join("recovery").join(name)
}

fn backup_for_recovery(
    root: &VaultRoot,
    absolute: &Path,
    relative_path: &str,
) -> Result<(), VaultError> {
    // Read bytes, not a String: a note that is not valid UTF-8 must still be
    // saveable, and the backup must be a faithful copy either way.
    let content = fs::read(absolute).map_err(|source| VaultError::io(absolute, source))?;
    let backup_path = recovery_backup_path(root, relative_path);
    if let Some(parent) = backup_path.parent() {
        fs::create_dir_all(parent).map_err(|source| VaultError::io(parent, source))?;
    }
    // Atomic, not a plain write: a crash mid-backup would otherwise leave a
    // truncated file that rollback would happily restore over the real note.
    atomic_write(&backup_path, &content)
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
