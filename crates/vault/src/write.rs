use std::fs;
use std::io::Write;
use std::path::Path;

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

use crate::error::VaultError;
use crate::note::{metadata_from_markdown, read_note, NoteMetadata};
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

pub fn save_note_with_options(
    vault_id: &str,
    root: &VaultRoot,
    path: &RelativeVaultPath,
    markdown: &str,
    expected_content_hash: Option<&str>,
    options: SaveNoteOptions,
) -> Result<SaveNoteOutput, VaultError> {
    if let Some(expected) = expected_content_hash {
        if root.resolve_relative(path)?.exists() {
            let existing = read_note(vault_id, root, path)?;
            if existing.metadata.content_hash != expected {
                return Err(VaultError::HashMismatch {
                    path: path.to_string(),
                    expected: expected.to_string(),
                    found: existing.metadata.content_hash,
                });
            }
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
        metadata_from_markdown(
            vault_id,
            path,
            markdown,
            chrono::Utc::now().to_rfc3339(),
        )
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

fn backup_for_recovery(root: &VaultRoot, absolute: &Path, relative_path: &str) -> Result<(), VaultError> {
    let content = fs::read_to_string(absolute).map_err(|source| VaultError::io(absolute, source))?;
    let digest = Sha256::digest(relative_path.as_bytes());
    let name = format!("{}.md", hex::encode(&digest[..8]));
    let backup_dir = root.root().join(".scriptor").join("recovery");
    fs::create_dir_all(&backup_dir).map_err(|source| VaultError::io(&backup_dir, source))?;
    let backup_path = backup_dir.join(name);
    fs::write(&backup_path, content).map_err(|source| VaultError::io(&backup_path, source))
}

fn atomic_write(path: &Path, bytes: &[u8]) -> Result<(), VaultError> {
    let parent = path
        .parent()
        .ok_or_else(|| VaultError::InvalidRelativePath(path.display().to_string()))?;

    let temp_name = format!(".scriptor-{}.tmp", uuid::Uuid::new_v4());
    let temp_path = parent.join(temp_name);

    {
        let mut file = fs::File::create(&temp_path).map_err(|source| VaultError::io(&temp_path, source))?;
        file.write_all(bytes)
            .map_err(|source| VaultError::io(&temp_path, source))?;
        file.sync_all()
            .map_err(|source| VaultError::io(&temp_path, source))?;
    }

    if let Err(source) = fs::rename(&temp_path, path) {
        let recovery = parent.join(format!(".scriptor-failed-{}.tmp", uuid::Uuid::new_v4()));
        let _ = fs::rename(&temp_path, &recovery);
        return Err(VaultError::io(path, source));
    }

    Ok(())
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
        save_note(&session.descriptor.id, &session.root, &path, "# One\n", None).unwrap();
        save_note(&session.descriptor.id, &session.root, &path, "# Two\n", None).unwrap();
        let recovery_dir = dir.path().join(".scriptor/recovery");
        assert!(recovery_dir.exists());
        assert!(fs::read_dir(recovery_dir).unwrap().count() >= 1);
    }
}
