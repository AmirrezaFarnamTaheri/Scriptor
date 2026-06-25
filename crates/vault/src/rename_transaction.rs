use std::collections::BTreeMap;
use std::fs;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};

use crate::error::VaultError;
use crate::path::{RelativeVaultPath, VaultRoot};

const TXN_DIR_NAME: &str = "rename-txn";
const TXN_MANIFEST: &str = "rename-txn.json";

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct RenameTransactionManifest {
    pub version: u32,
    pub from_path: String,
    pub to_path: String,
    pub source_backup: String,
    #[serde(default)]
    pub affected_backups: BTreeMap<String, String>,
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

pub fn recover_pending_rename_transactions(root: &VaultRoot) -> Result<(), VaultError> {
    let manifest = manifest_path(root);
    if !manifest.is_file() {
        return Ok(());
    }

    let data = fs::read_to_string(&manifest).map_err(|source| VaultError::io(&manifest, source))?;
    let txn: RenameTransactionManifest = match serde_json::from_str(&data) {
        Ok(value) => value,
        Err(_) => {
            let _ = fs::remove_file(&manifest);
            return Ok(());
        }
    };

    recover_transaction(root, &txn)?;
    cleanup_transaction(root, &txn)?;
    Ok(())
}

fn recover_transaction(root: &VaultRoot, txn: &RenameTransactionManifest) -> Result<(), VaultError> {
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

    for (note_path, backup_rel) in &txn.affected_backups {
        let note_abs = root.resolve_relative(&RelativeVaultPath::parse(note_path)?)?;
        let backup_abs = root.root().join(backup_rel);
        if backup_abs.is_file() && note_abs.exists() {
            fs::copy(&backup_abs, &note_abs).map_err(|source| VaultError::io(&note_abs, source))?;
        } else if backup_abs.is_file() && !note_abs.exists() {
            if let Some(parent) = note_abs.parent() {
                fs::create_dir_all(parent).map_err(|source| VaultError::io(parent, source))?;
            }
            fs::rename(&backup_abs, &note_abs).map_err(|source| VaultError::io(&note_abs, source))?;
        }
    }

    Ok(())
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
        recover_pending_rename_transactions(root)?;

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
            version: 1,
            from_path: from_path.to_string(),
            to_path: to_path.to_string(),
            source_backup,
            affected_backups,
        };

        write_manifest(root, &manifest)?;

        Ok(Self {
            root: root.clone(),
            manifest,
        })
    }

    pub fn commit(self) -> Result<(), VaultError> {
        cleanup_transaction(&self.root, &self.manifest)
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
    fs::write(&path, data).map_err(|source| VaultError::io(&path, source))
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
        let staged = StagedRenameTransaction::begin(&session.root, &from, &to, &[]).unwrap();

        let manifest = manifest_path(&session.root);
        assert!(manifest.is_file());

        staged.commit().unwrap();
        assert!(!manifest.is_file());
    }

    #[test]
    fn recovers_interrupted_rename_from_manifest() {
        let dir = tempdir().unwrap();
        std::fs::write(dir.path().join("Note.md"), "# Note\n").unwrap();
        let session = open_vault(dir.path()).unwrap();

        let from = RelativeVaultPath::parse("Note.md").unwrap();
        let to = RelativeVaultPath::parse("Renamed.md").unwrap();
        let staged = StagedRenameTransaction::begin(&session.root, &from, &to, &[]).unwrap();

        let from_abs = session.root.resolve_relative(&from).unwrap();
        std::fs::remove_file(&from_abs).unwrap();

        drop(staged);
        recover_pending_rename_transactions(&session.root).unwrap();

        assert!(session.root.resolve_relative(&from).unwrap().is_file());
        assert!(!manifest_path(&session.root).is_file());
    }

    #[test]
    fn ignores_missing_backup_on_recovery() {
        let dir = tempdir().unwrap();
        std::fs::write(dir.path().join("Note.md"), "# Note\n").unwrap();
        let session = open_vault(dir.path()).unwrap();

        let manifest = RenameTransactionManifest {
            version: 1,
            from_path: "Note.md".into(),
            to_path: "Renamed.md".into(),
            source_backup: "rename-txn/missing.bak".into(),
            affected_backups: BTreeMap::new(),
        };
        write_manifest(&session.root, &manifest).unwrap();

        recover_pending_rename_transactions(&session.root).unwrap();
        assert!(!manifest_path(&session.root).is_file());
    }
}
