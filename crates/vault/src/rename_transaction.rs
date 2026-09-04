use std::collections::BTreeMap;
use std::fs;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};

use crate::error::VaultError;
use crate::fs::atomic_write;
use crate::hash::{content_hash_bytes, path_hash};
use crate::path::{RelativeVaultPath, VaultRoot};

const TXN_DIR_NAME: &str = "rename-txn";
const TXN_MANIFEST: &str = "rename-txn.json";

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Default)]
#[serde(rename_all = "snake_case")]
pub enum RenamePhase {
    #[default]
    Staged,
    LinkWritesDone,
    FileMoveDone,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Default)]
pub struct RenameTransactionManifest {
    pub version: u32,
    #[serde(default)]
    pub phase: RenamePhase,
    pub from_path: String,
    pub to_path: String,
    pub source_backup: String,
    #[serde(default)]
    pub source_original_hash: String,
    #[serde(default)]
    pub affected_backups: BTreeMap<String, String>,
    #[serde(default)]
    pub affected_original_hashes: BTreeMap<String, String>,
    #[serde(default)]
    pub affected_intended_hashes: BTreeMap<String, String>,
    #[serde(default)]
    pub affected_files: Vec<String>,
}

#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct RenameRecoveryOutcome {
    pub reindex_paths: Vec<String>,
}

pub fn scriptor_meta_dir(root: &VaultRoot) -> PathBuf {
    root.root().join(".scriptor")
}

fn txn_dir(root: &VaultRoot) -> PathBuf {
    scriptor_meta_dir(root).join(TXN_DIR_NAME)
}

fn manifest_path(root: &VaultRoot) -> PathBuf {
    scriptor_meta_dir(root).join(TXN_MANIFEST)
}

pub fn recover_pending_rename_transactions(
    root: &VaultRoot,
) -> Result<RenameRecoveryOutcome, VaultError> {
    let manifest_file = manifest_path(root);
    if !manifest_file.is_file() {
        return Ok(RenameRecoveryOutcome::default());
    }

    let data = fs::read_to_string(&manifest_file)
        .map_err(|source| VaultError::io(&manifest_file, source))?;
    let txn: RenameTransactionManifest = match serde_json::from_str(&data) {
        Ok(value) => value,
        Err(_) => {
            let _ = fs::remove_file(&manifest_file);
            return Ok(RenameRecoveryOutcome::default());
        }
    };

    let outcome = match txn.phase {
        RenamePhase::FileMoveDone => {
            let reindex_paths = build_reindex_paths(&txn);
            cleanup_transaction(root, &txn)?;
            RenameRecoveryOutcome { reindex_paths }
        }
        RenamePhase::LinkWritesDone => {
            rollback_link_writes(root, &txn)?;
            RenameRecoveryOutcome::default()
        }
        RenamePhase::Staged => {
            recover_staged_transaction(root, &txn)?;
            cleanup_transaction(root, &txn)?;
            RenameRecoveryOutcome::default()
        }
    };

    Ok(outcome)
}

fn build_reindex_paths(txn: &RenameTransactionManifest) -> Vec<String> {
    let mut paths: Vec<String> = txn
        .affected_files
        .iter()
        .map(|path| {
            if path == &txn.from_path {
                txn.to_path.clone()
            } else {
                path.clone()
            }
        })
        .collect();
    if !paths.iter().any(|path| path == &txn.to_path) {
        paths.push(txn.to_path.clone());
    }
    paths.sort();
    paths.dedup();
    paths
}

/// Rolls a `Staged` transaction back.
///
/// A crash can land anywhere inside the link-rewrite loop, so some affected
/// notes may already have been rewritten to point at a filename that was never
/// created. Restoring their backups — not just the source note — is what makes
/// a partially-applied rename recoverable.
fn recover_staged_transaction(
    root: &VaultRoot,
    txn: &RenameTransactionManifest,
) -> Result<(), VaultError> {
    restore_affected_backups(root, txn)?;

    let from = RelativeVaultPath::parse(&txn.from_path)?;
    let to = RelativeVaultPath::parse(&txn.to_path)?;
    let from_abs = root.resolve_relative(&from)?;
    let to_abs = root.resolve_relative(&to)?;
    let source_backup = root.root().join(&txn.source_backup);

    if source_backup.is_file() && !from_abs.exists() && !to_abs.exists() {
        if let Some(parent) = from_abs.parent() {
            fs::create_dir_all(parent).map_err(|source| VaultError::io(parent, source))?;
        }
        fs::rename(&source_backup, &from_abs)
            .map_err(|source| VaultError::io(&from_abs, source))?;
    }

    Ok(())
}

fn restore_affected_backups(
    root: &VaultRoot,
    txn: &RenameTransactionManifest,
) -> Result<(), VaultError> {
    for (note_path, backup_rel) in &txn.affected_backups {
        let note_abs = root.resolve_relative(&RelativeVaultPath::parse(note_path)?)?;
        let backup_abs = root.root().join(backup_rel);
        if !backup_abs.is_file() {
            continue;
        }
        let original_hash = txn.affected_original_hashes.get(note_path);
        let intended_hash = txn.affected_intended_hashes.get(note_path);
        if intended_hash.is_none() {
            // The transaction never rewrote this note. Its on-disk state is the
            // user's own (whether edited externally, left untouched, or removed),
            // so there is nothing transaction-owned for us to restore. Skipping
            // here — instead of erroring — means a concurrent external edit to a
            // note the rename didn't touch cannot abort rollback of the notes the
            // transaction *did* rewrite.
            continue;
        }
        if note_abs.is_file() {
            let current = fs::read(&note_abs).map_err(|source| VaultError::io(&note_abs, source))?;
            let current_hash = content_hash_bytes(&current);
            // Untouched (still the original bytes): nothing to restore.
            if original_hash.is_some_and(|hash| hash == &current_hash) {
                continue;
            }
            // The transaction rewrote this note. Restore it only while it still
            // holds exactly the bytes the transaction wrote; any other content is
            // a concurrent edit we must not clobber with a stale backup.
            if intended_hash.as_deref() != Some(&current_hash) {
                return Err(VaultError::HashMismatch {
                    path: note_path.clone(),
                    expected: intended_hash.cloned().unwrap_or_default(),
                    found: current_hash,
                });
            }
        }
        if let Some(parent) = note_abs.parent() {
            fs::create_dir_all(parent).map_err(|source| VaultError::io(parent, source))?;
        }
        let bytes = fs::read(&backup_abs).map_err(|source| VaultError::io(&backup_abs, source))?;
        atomic_write(&note_abs, &bytes)?;
    }
    Ok(())
}

fn rollback_link_writes(
    root: &VaultRoot,
    txn: &RenameTransactionManifest,
) -> Result<(), VaultError> {
    restore_affected_backups(root, txn)?;
    cleanup_transaction(root, txn)
}

fn rollback_file_move_and_link_writes(
    root: &VaultRoot,
    txn: &RenameTransactionManifest,
) -> Result<(), VaultError> {
    let from = RelativeVaultPath::parse(&txn.from_path)?;
    let to = RelativeVaultPath::parse(&txn.to_path)?;
    let from_abs = root.resolve_relative(&from)?;
    let to_abs = root.resolve_relative(&to)?;
    let source_backup = root.root().join(&txn.source_backup);

    if to_abs.is_file() {
        let current = fs::read(&to_abs).map_err(|source| VaultError::io(&to_abs, source))?;
        let current_hash = content_hash_bytes(&current);
        let expected = txn
            .affected_intended_hashes
            .get(&txn.from_path)
            .unwrap_or(&txn.source_original_hash);
        if &current_hash != expected {
            return Err(VaultError::HashMismatch {
                path: txn.to_path.clone(),
                expected: expected.clone(),
                found: current_hash,
            });
        }
        fs::remove_file(&to_abs).map_err(|source| VaultError::io(&to_abs, source))?;
    }

    if source_backup.is_file() {
        if let Some(parent) = from_abs.parent() {
            fs::create_dir_all(parent).map_err(|source| VaultError::io(parent, source))?;
        }
        fs::copy(&source_backup, &from_abs).map_err(|source| VaultError::io(&from_abs, source))?;
    }

    restore_affected_backups(root, txn)?;
    cleanup_transaction(root, txn)
}

pub struct StagedRenameTransaction {
    root: VaultRoot,
    manifest: RenameTransactionManifest,
}

impl StagedRenameTransaction {
    pub fn begin(
        root: &VaultRoot,
        from_path: &RelativeVaultPath,
        to_path: &RelativeVaultPath,
        affected_paths: &[String],
    ) -> Result<Self, VaultError> {
        Self::begin_with_intended(root, from_path, to_path, affected_paths, &BTreeMap::new())
    }

    pub fn begin_with_intended(
        root: &VaultRoot,
        from_path: &RelativeVaultPath,
        to_path: &RelativeVaultPath,
        affected_paths: &[String],
        intended_hashes: &BTreeMap<String, String>,
    ) -> Result<Self, VaultError> {
        let recovery = recover_pending_rename_transactions(root)?;
        if !recovery.reindex_paths.is_empty() {
            return Err(VaultError::InvalidConfig {
                message: "cannot begin rename while index reconciliation is pending".into(),
            });
        }

        let dir = txn_dir(root);
        fs::create_dir_all(&dir).map_err(|source| VaultError::io(&dir, source))?;
        fs::create_dir_all(scriptor_meta_dir(root))
            .map_err(|source| VaultError::io(scriptor_meta_dir(root), source))?;

        let (source_backup, source_original_hash) = backup_file(root, &dir, from_path.as_str())?;
        let mut affected_backups = BTreeMap::new();
        let mut affected_original_hashes = BTreeMap::new();
        for path in affected_paths {
            if path == from_path.as_str() || path == to_path.as_str() {
                continue;
            }
            let (backup, original_hash) = backup_file(root, &dir, path)?;
            affected_backups.insert(path.clone(), backup);
            affected_original_hashes.insert(path.clone(), original_hash);
        }

        let manifest = RenameTransactionManifest {
            version: 3,
            phase: RenamePhase::Staged,
            from_path: from_path.to_string(),
            to_path: to_path.to_string(),
            source_backup,
            source_original_hash,
            affected_backups,
            affected_original_hashes,
            affected_intended_hashes: intended_hashes.clone(),
            affected_files: affected_paths.to_vec(),
        };

        write_manifest(root, &manifest)?;

        Ok(Self {
            root: root.clone(),
            manifest,
        })
    }

    pub fn record_phase(&mut self, phase: RenamePhase) -> Result<(), VaultError> {
        self.manifest.phase = phase;
        write_manifest(&self.root, &self.manifest)
    }

    pub fn commit(self) -> Result<(), VaultError> {
        cleanup_transaction(&self.root, &self.manifest)
    }

    pub fn abort(self) -> Result<(), VaultError> {
        match self.manifest.phase {
            RenamePhase::Staged => {
                recover_staged_transaction(&self.root, &self.manifest)?;
                cleanup_transaction(&self.root, &self.manifest)
            }
            RenamePhase::LinkWritesDone => rollback_link_writes(&self.root, &self.manifest),
            RenamePhase::FileMoveDone => {
                rollback_file_move_and_link_writes(&self.root, &self.manifest)
            }
        }
    }
}

fn backup_file(root: &VaultRoot, dir: &Path, relative_path: &str) -> Result<(String, String), VaultError> {
    let source = root.resolve_relative(&RelativeVaultPath::parse(relative_path)?)?;
    if !source.is_file() {
        return Err(VaultError::NoteNotFound(relative_path.to_string()));
    }

    // The backup filename must be injective over the full relative path.
    // Flattening separators (`a/b.md` -> `a__b.md`) collided with a literal
    // `a__b.md`, so a rename touching both wrote one note's contents into the
    // other's backup and rollback restored the wrong file. A hash of the full
    // path cannot collide that way.
    let backup_name = path_hash(relative_path);
    let backup_abs = dir.join(format!("{backup_name}.bak"));
    let bytes = fs::read(&source).map_err(|source_err| VaultError::io(&source, source_err))?;
    atomic_write(&backup_abs, &bytes)?;
    Ok((
        format!(".scriptor/{TXN_DIR_NAME}/{backup_name}.bak"),
        content_hash_bytes(&bytes),
    ))
}

fn write_manifest(
    root: &VaultRoot,
    manifest: &RenameTransactionManifest,
) -> Result<(), VaultError> {
    let path = manifest_path(root);
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|source| VaultError::io(parent, source))?;
    }
    let data = serde_json::to_string_pretty(manifest)?;
    atomic_write(&path, data.as_bytes())?;
    Ok(())
}

fn cleanup_transaction(
    root: &VaultRoot,
    txn: &RenameTransactionManifest,
) -> Result<(), VaultError> {
    fn remove_if_present(path: &Path) -> Result<(), VaultError> {
        match fs::remove_file(path) {
            Ok(()) => Ok(()),
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(()),
            Err(error) => Err(VaultError::io(path, error)),
        }
    }

    remove_if_present(&root.root().join(&txn.source_backup))?;
    for backup in txn.affected_backups.values() {
        remove_if_present(&root.root().join(backup))?;
    }
    remove_if_present(&manifest_path(root))?;
    let dir = txn_dir(root);
    if dir.is_dir() && fs::read_dir(&dir).map_err(|source| VaultError::io(&dir, source))?.next().is_none() {
        fs::remove_dir(&dir).map_err(|source| VaultError::io(&dir, source))?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::open::open_vault;
    use tempfile::tempdir;

    #[test]
    fn stages_and_cleans_up_transaction_manifest() {
        let dir = tempdir().unwrap();
        std::fs::write(dir.path().join("Note.md"), "# Note\n").unwrap();
        let session = open_vault(dir.path()).unwrap();

        let from = RelativeVaultPath::parse("Note.md").unwrap();
        let to = RelativeVaultPath::parse("Renamed.md").unwrap();
        let staged =
            StagedRenameTransaction::begin(&session.root, &from, &to, &["Note.md".into()]).unwrap();

        let manifest = manifest_path(&session.root);
        assert!(manifest.is_file());

        staged.commit().unwrap();
        assert!(!manifest.is_file());
    }

    #[test]
    fn recovers_interrupted_staged_rename_from_manifest() {
        let dir = tempdir().unwrap();
        std::fs::write(dir.path().join("Note.md"), "# Note\n").unwrap();
        let session = open_vault(dir.path()).unwrap();

        let from = RelativeVaultPath::parse("Note.md").unwrap();
        let to = RelativeVaultPath::parse("Renamed.md").unwrap();
        let staged =
            StagedRenameTransaction::begin(&session.root, &from, &to, &["Note.md".into()]).unwrap();

        let from_abs = session.root.resolve_relative(&from).unwrap();
        std::fs::remove_file(&from_abs).unwrap();

        drop(staged);
        recover_pending_rename_transactions(&session.root).unwrap();

        assert!(session.root.resolve_relative(&from).unwrap().is_file());
        assert!(!manifest_path(&session.root).is_file());
    }

    #[test]
    fn recovers_file_move_done_with_reindex_paths() {
        let dir = tempdir().unwrap();
        std::fs::write(dir.path().join("Note.md"), "# Note\n").unwrap();
        std::fs::write(dir.path().join("Other.md"), "# Other\n\n[[Note]]\n").unwrap();
        let session = open_vault(dir.path()).unwrap();

        let from = RelativeVaultPath::parse("Note.md").unwrap();
        let to = RelativeVaultPath::parse("Renamed.md").unwrap();
        let mut staged = StagedRenameTransaction::begin(
            &session.root,
            &from,
            &to,
            &["Note.md".into(), "Other.md".into()],
        )
        .unwrap();
        staged.record_phase(RenamePhase::LinkWritesDone).unwrap();

        std::fs::rename(
            session.root.resolve_relative(&from).unwrap(),
            session.root.resolve_relative(&to).unwrap(),
        )
        .unwrap();
        staged.record_phase(RenamePhase::FileMoveDone).unwrap();
        drop(staged);

        let outcome = recover_pending_rename_transactions(&session.root).unwrap();
        assert!(outcome.reindex_paths.contains(&"Renamed.md".to_string()));
        assert!(outcome.reindex_paths.contains(&"Other.md".to_string()));
        assert!(!manifest_path(&session.root).is_file());
        assert!(session.root.resolve_relative(&to).unwrap().is_file());
    }

    #[test]
    fn abort_after_link_writes_restores_affected_notes() {
        let dir = tempdir().unwrap();
        std::fs::write(dir.path().join("Note.md"), "# Note\n").unwrap();
        std::fs::write(dir.path().join("Other.md"), "# Other\n\n[[Note]]\n").unwrap();
        let session = open_vault(dir.path()).unwrap();

        let from = RelativeVaultPath::parse("Note.md").unwrap();
        let to = RelativeVaultPath::parse("Renamed.md").unwrap();
        let mut staged = StagedRenameTransaction::begin(
            &session.root,
            &from,
            &to,
            &["Note.md".into(), "Other.md".into()],
        )
        .unwrap();
        staged.record_phase(RenamePhase::LinkWritesDone).unwrap();

        std::fs::write(
            session
                .root
                .resolve_relative(&RelativeVaultPath::parse("Other.md").unwrap())
                .unwrap(),
            "# Other\n\n[[Renamed]]\n",
        )
        .unwrap();

        staged.abort().unwrap();
        let other = std::fs::read_to_string(dir.path().join("Other.md")).unwrap();
        assert!(other.contains("[[Note]]"));
        assert!(!manifest_path(&session.root).is_file());
    }

    #[test]
    fn backups_do_not_collide_across_separator_flattened_paths() {
        let dir = tempdir().unwrap();
        std::fs::create_dir_all(dir.path().join("archive")).unwrap();
        // `archive/notes.md` and `archive__notes.md` both flattened to
        // `archive__notes.md.bak` under the old scheme, so one note's backup
        // overwrote the other's and rollback restored the wrong content.
        std::fs::write(dir.path().join("archive/notes.md"), "# Nested\n").unwrap();
        std::fs::write(dir.path().join("archive__notes.md"), "# Flat\n").unwrap();
        std::fs::write(dir.path().join("Note.md"), "# Note\n").unwrap();
        let session = open_vault(dir.path()).unwrap();

        let from = RelativeVaultPath::parse("Note.md").unwrap();
        let to = RelativeVaultPath::parse("Renamed.md").unwrap();
        let mut staged = StagedRenameTransaction::begin(
            &session.root,
            &from,
            &to,
            &[
                "Note.md".into(),
                "archive/notes.md".into(),
                "archive__notes.md".into(),
            ],
        )
        .unwrap();

        let backups: Vec<_> = staged.manifest.affected_backups.values().cloned().collect();
        assert_eq!(backups.len(), 2);
        assert_ne!(backups[0], backups[1], "backup names collided");

        staged.record_phase(RenamePhase::LinkWritesDone).unwrap();
        std::fs::write(dir.path().join("archive/notes.md"), "# Clobbered\n").unwrap();
        std::fs::write(dir.path().join("archive__notes.md"), "# Clobbered\n").unwrap();
        staged.abort().unwrap();

        assert_eq!(
            std::fs::read_to_string(dir.path().join("archive/notes.md")).unwrap(),
            "# Nested\n"
        );
        assert_eq!(
            std::fs::read_to_string(dir.path().join("archive__notes.md")).unwrap(),
            "# Flat\n"
        );
    }

    #[test]
    fn staged_recovery_restores_partially_rewritten_notes() {
        let dir = tempdir().unwrap();
        std::fs::write(dir.path().join("Note.md"), "# Note\n").unwrap();
        std::fs::write(dir.path().join("Other.md"), "# Other\n\n[[Note]]\n").unwrap();
        let session = open_vault(dir.path()).unwrap();

        let from = RelativeVaultPath::parse("Note.md").unwrap();
        let to = RelativeVaultPath::parse("Renamed.md").unwrap();
        let staged = StagedRenameTransaction::begin(
            &session.root,
            &from,
            &to,
            &["Note.md".into(), "Other.md".into()],
        )
        .unwrap();

        // Simulate a crash partway through the link-rewrite loop: one note is
        // already pointing at a filename that was never created.
        std::fs::write(dir.path().join("Other.md"), "# Other\n\n[[Renamed]]\n").unwrap();
        drop(staged);

        recover_pending_rename_transactions(&session.root).unwrap();

        let other = std::fs::read_to_string(dir.path().join("Other.md")).unwrap();
        assert!(
            other.contains("[[Note]]"),
            "staged recovery left a dangling rewritten link: {other:?}"
        );
        assert!(!manifest_path(&session.root).is_file());
    }

    #[test]
    fn ignores_missing_backup_on_recovery() {
        let dir = tempdir().unwrap();
        std::fs::write(dir.path().join("Note.md"), "# Note\n").unwrap();
        let session = open_vault(dir.path()).unwrap();

        let manifest = RenameTransactionManifest {
            version: 2,
            phase: RenamePhase::Staged,
            from_path: "Note.md".into(),
            to_path: "Renamed.md".into(),
            source_backup: ".scriptor/rename-txn/missing.bak".into(),
            affected_backups: BTreeMap::new(),
            affected_files: vec!["Note.md".into()],
            ..Default::default()
        };
        write_manifest(&session.root, &manifest).unwrap();

        recover_pending_rename_transactions(&session.root).unwrap();
        assert!(!manifest_path(&session.root).is_file());
    }
}
