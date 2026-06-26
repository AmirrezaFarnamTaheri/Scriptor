use std::collections::BTreeMap;
use std::fs;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};

use crate::error::VaultError;
use crate::fs::atomic_write;
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

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct RenameTransactionManifest {
    pub version: u32,
    #[serde(default)]
    pub phase: RenamePhase,
    pub from_path: String,
    pub to_path: String,
    pub source_backup: String,
    #[serde(default)]
    pub affected_backups: BTreeMap<String, String>,
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

pub fn recover_pending_rename_transactions(root: &VaultRoot) -> Result<RenameRecoveryOutcome, VaultError> {
    let manifest_file = manifest_path(root);
    if !manifest_file.is_file() {
        return Ok(RenameRecoveryOutcome::default());
    }

    let data = fs::read_to_string(&manifest_file).map_err(|source| VaultError::io(&manifest_file, source))?;
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

fn recover_staged_transaction(root: &VaultRoot, txn: &RenameTransactionManifest) -> Result<(), VaultError> {
    let from = RelativeVaultPath::parse(&txn.from_path)?;
    let to = RelativeVaultPath::parse(&txn.to_path)?;
    let from_abs = root.resolve_relative(&from)?;
    let to_abs = root.resolve_relative(&to)?;
    let source_backup = root.root().join(&txn.source_backup);

    if source_backup.is_file() && !from_abs.exists() && !to_abs.exists() {
        if let Some(parent) = from_abs.parent() {
            fs::create_dir_all(parent).map_err(|source| VaultError::io(parent, source))?;
        }
        fs::rename(&source_backup, &from_abs).map_err(|source| VaultError::io(&from_abs, source))?;
    }

    Ok(())
}

fn restore_affected_backups(root: &VaultRoot, txn: &RenameTransactionManifest) -> Result<(), VaultError> {
    for (note_path, backup_rel) in &txn.affected_backups {
        let note_abs = root.resolve_relative(&RelativeVaultPath::parse(note_path)?)?;
        let backup_abs = root.root().join(backup_rel);
        if !backup_abs.is_file() {
            continue;
        }
        if let Some(parent) = note_abs.parent() {
            fs::create_dir_all(parent).map_err(|source| VaultError::io(parent, source))?;
        }
        fs::copy(&backup_abs, &note_abs).map_err(|source| VaultError::io(&note_abs, source))?;
    }
    Ok(())
}

fn rollback_link_writes(root: &VaultRoot, txn: &RenameTransactionManifest) -> Result<(), VaultError> {
    restore_affected_backups(root, txn)?;
    cleanup_transaction(root, txn)
}

fn rollback_file_move_and_link_writes(root: &VaultRoot, txn: &RenameTransactionManifest) -> Result<(), VaultError> {
    let from = RelativeVaultPath::parse(&txn.from_path)?;
    let to = RelativeVaultPath::parse(&txn.to_path)?;
    let from_abs = root.resolve_relative(&from)?;
    let to_abs = root.resolve_relative(&to)?;
    let source_backup = root.root().join(&txn.source_backup);

    if to_abs.is_file() {
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
        let recovery = recover_pending_rename_transactions(root)?;
        if !recovery.reindex_paths.is_empty() {
            return Err(VaultError::InvalidConfig {
                message: "cannot begin rename while index reconciliation is pending".into(),
            });
        }

        let dir = txn_dir(root);
        fs::create_dir_all(&dir).map_err(|source| VaultError::io(&dir, source))?;
        fs::create_dir_all(scriptor_meta_dir(root)).map_err(|source| VaultError::io(scriptor_meta_dir(root), source))?;

        let source_backup = backup_file(root, &dir, from_path.as_str())?;
        let mut affected_backups = BTreeMap::new();
        for path in affected_paths {
            if path == from_path.as_str() || path == to_path.as_str() {
                continue;
            }
            let backup = backup_file(root, &dir, path)?;
            affected_backups.insert(path.clone(), backup);
        }

        let manifest = RenameTransactionManifest {
            version: 2,
            phase: RenamePhase::Staged,
            from_path: from_path.to_string(),
            to_path: to_path.to_string(),
            source_backup,
            affected_backups,
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
            RenamePhase::FileMoveDone => rollback_file_move_and_link_writes(&self.root, &self.manifest),
        }
    }
}

fn backup_file(root: &VaultRoot, dir: &Path, relative_path: &str) -> Result<String, VaultError> {
    let source = root.resolve_relative(&RelativeVaultPath::parse(relative_path)?)?;
    if !source.is_file() {
        return Err(VaultError::NoteNotFound(relative_path.to_string()));
    }

    let backup_name = relative_path.replace('/', "__");
    let backup_abs = dir.join(format!("{backup_name}.bak"));
    fs::copy(&source, &backup_abs).map_err(|source| VaultError::io(&backup_abs, source))?;
    Ok(format!(".scriptor/{TXN_DIR_NAME}/{backup_name}.bak"))
}

fn write_manifest(root: &VaultRoot, manifest: &RenameTransactionManifest) -> Result<(), VaultError> {
    let path = manifest_path(root);
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|source| VaultError::io(parent, source))?;
    }
    let data = serde_json::to_string_pretty(manifest)?;
    atomic_write(&path, data.as_bytes())?;
    Ok(())
}

fn cleanup_transaction(root: &VaultRoot, txn: &RenameTransactionManifest) -> Result<(), VaultError> {
    let _ = fs::remove_file(root.root().join(&txn.source_backup));
    for backup in txn.affected_backups.values() {
        let _ = fs::remove_file(root.root().join(backup));
    }
    let _ = fs::remove_file(manifest_path(root));
    let dir = txn_dir(root);
    if dir.is_dir() {
        if fs::read_dir(&dir)
            .map(|mut entries| entries.next().is_none())
            .unwrap_or(false)
        {
            let _ = fs::remove_dir(&dir);
        }
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
        let staged = StagedRenameTransaction::begin(&session.root, &from, &to, &["Note.md".into()]).unwrap();

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
        let staged = StagedRenameTransaction::begin(&session.root, &from, &to, &["Note.md".into()]).unwrap();

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
        let mut staged =
            StagedRenameTransaction::begin(&session.root, &from, &to, &["Note.md".into(), "Other.md".into()]).unwrap();
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
        let mut staged =
            StagedRenameTransaction::begin(&session.root, &from, &to, &["Note.md".into(), "Other.md".into()]).unwrap();
        staged.record_phase(RenamePhase::LinkWritesDone).unwrap();

        std::fs::write(
            session.root.resolve_relative(&RelativeVaultPath::parse("Other.md").unwrap()).unwrap(),
            "# Other\n\n[[Renamed]]\n",
        )
        .unwrap();

        staged.abort().unwrap();
        let other = std::fs::read_to_string(dir.path().join("Other.md")).unwrap();
        assert!(other.contains("[[Note]]"));
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
        };
        write_manifest(&session.root, &manifest).unwrap();

        recover_pending_rename_transactions(&session.root).unwrap();
        assert!(!manifest_path(&session.root).is_file());
    }
}
