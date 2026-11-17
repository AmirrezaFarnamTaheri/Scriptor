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

/// Resolves a backup path recorded in a manifest.
///
/// The manifest is a file inside the vault, so a copied or synced vault can carry
/// a hand-written one. Recovery moves, copies and deletes the files it names, so
/// every backup must be exactly what `backup_file` writes: one hex-named `.bak`
/// file directly inside `.scriptor/rename-txn/`, with neither directory a link.
fn backup_abs(root: &VaultRoot, recorded: &str) -> Result<PathBuf, VaultError> {
    let reject = || VaultError::PathEscape(recorded.to_string());
    let name = recorded
        .strip_prefix(&format!(".scriptor/{TXN_DIR_NAME}/"))
        .and_then(|rest| rest.strip_suffix(".bak"))
        .ok_or_else(reject)?;
    if name.is_empty() || name.len() > 128 || !name.bytes().all(|byte| byte.is_ascii_hexdigit()) {
        return Err(reject());
    }
    for dir in [scriptor_meta_dir(root), txn_dir(root)] {
        match fs::symlink_metadata(&dir) {
            Ok(meta) if meta.file_type().is_symlink() => return Err(reject()),
            _ => {}
        }
    }
    Ok(txn_dir(root).join(format!("{name}.bak")))
}

fn manifest_backups_are_confined(root: &VaultRoot, txn: &RenameTransactionManifest) -> bool {
    std::iter::once(txn.source_backup.as_str())
        .chain(txn.affected_backups.values().map(String::as_str))
        .all(|recorded| backup_abs(root, recorded).is_ok())
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
    if !manifest_backups_are_confined(root, &txn) {
        // Not written by Scriptor. Acting on it could move or delete files the
        // manifest names; leave every file alone and set the manifest aside so
        // the vault still opens and the evidence survives.
        let rejected = manifest_file.with_extension("json.rejected");
        fs::rename(&manifest_file, &rejected)
            .map_err(|source| VaultError::io(&manifest_file, source))?;
        return Ok(RenameRecoveryOutcome::default());
    }

    let outcome = match txn.phase {
        RenamePhase::FileMoveDone => {
            let reindex_paths = build_reindex_paths(&txn);
            cleanup_transaction(root, &txn)?;
            RenameRecoveryOutcome { reindex_paths }
        }
        RenamePhase::LinkWritesDone | RenamePhase::Staged => {
            roll_back_unfinished(root, &txn)?;
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
    let source_backup = backup_abs(root, &txn.source_backup)?;

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
        let backup_abs = backup_abs(root, backup_rel)?;
        if !backup_abs.is_file() {
            continue;
        }
        let original_hash = txn.affected_original_hashes.get(note_path);
        let intended_hash = txn.affected_intended_hashes.get(note_path);
        // Manifests written before the intended/original hashes were recorded cannot
        // say which notes this transaction rewrote, so they keep the pre-v3
        // contract: restore every backup. Skipping on a missing hash there would
        // silently keep rewritten links pointing at a file the interrupted rename
        // never created, and recovery then deletes the backups that could fix it.
        let hashes_recorded = !txn.affected_intended_hashes.is_empty();
        if hashes_recorded && intended_hash.is_none() {
            // The transaction never rewrote this note. Its on-disk state is the
            // user's own (whether edited externally, left untouched, or removed),
            // so there is nothing transaction-owned for us to restore. Skipping
            // here — instead of erroring — means a concurrent external edit to a
            // note the rename didn't touch cannot abort rollback of the notes the
            // transaction *did* rewrite.
            continue;
        }
        if hashes_recorded && note_abs.is_file() {
            let current =
                fs::read(&note_abs).map_err(|source| VaultError::io(&note_abs, source))?;
            let current_hash = content_hash_bytes(&current);
            // Untouched (still the original bytes): nothing to restore.
            if original_hash.is_some_and(|hash| hash == &current_hash) {
                continue;
            }
            // The transaction rewrote this note. Restore it only while it still
            // holds exactly the bytes the transaction wrote; any other content is
            // a concurrent edit we must not clobber with a stale backup.
            if intended_hash != Some(&current_hash) {
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

/// Rolls back a transaction that never recorded `FileMoveDone`.
///
/// The move itself is not a recorded phase, so the files decide: when the
/// destination holds this transaction's note (the source is gone, or the
/// destination carries the bytes the transaction wrote there), the move
/// happened and is undone together with the link writes. Restoring only the
/// links would leave every backlink pointing at the old name while the note
/// sits at the new one.
fn roll_back_unfinished(
    root: &VaultRoot,
    txn: &RenameTransactionManifest,
) -> Result<(), VaultError> {
    if note_was_moved(root, txn)? {
        return rollback_file_move_and_link_writes(root, txn);
    }
    match txn.phase {
        RenamePhase::Staged => {
            recover_staged_transaction(root, txn)?;
            cleanup_transaction(root, txn)
        }
        _ => {
            restore_affected_backups(root, txn)?;
            cleanup_transaction(root, txn)
        }
    }
}

fn note_was_moved(root: &VaultRoot, txn: &RenameTransactionManifest) -> Result<bool, VaultError> {
    let from_abs = root.resolve_relative(&RelativeVaultPath::parse(&txn.from_path)?)?;
    let to_abs = root.resolve_relative(&RelativeVaultPath::parse(&txn.to_path)?)?;
    if !to_abs.is_file() {
        return Ok(false);
    }
    if !from_abs.exists() {
        return Ok(true);
    }
    // Copy-then-remove path: the destination was written but the source not yet
    // removed. Only bytes this transaction wrote count as its destination.
    let Some(intended) = txn.affected_intended_hashes.get(&txn.from_path) else {
        return Ok(false);
    };
    let current = fs::read(&to_abs).map_err(|source| VaultError::io(&to_abs, source))?;
    Ok(&content_hash_bytes(&current) == intended)
}

fn rollback_file_move_and_link_writes(
    root: &VaultRoot,
    txn: &RenameTransactionManifest,
) -> Result<(), VaultError> {
    let from = RelativeVaultPath::parse(&txn.from_path)?;
    let to = RelativeVaultPath::parse(&txn.to_path)?;
    let from_abs = root.resolve_relative(&from)?;
    let to_abs = root.resolve_relative(&to)?;
    let source_backup = backup_abs(root, &txn.source_backup)?;

    if to_abs.is_file() {
        // The destination may only be deleted while it still holds the bytes this
        // transaction wrote. Manifests written before those hashes were recorded
        // carry empty strings, which cannot vouch for anything: comparing against
        // them would reject every legacy rollback, so they keep the pre-v3
        // unconditional behaviour instead.
        let intended = txn
            .affected_intended_hashes
            .get(&txn.from_path)
            .map(String::as_str);
        let original =
            (!txn.source_original_hash.is_empty()).then_some(txn.source_original_hash.as_str());
        if let Some(expected) = intended.or(original) {
            let current = fs::read(&to_abs).map_err(|source| VaultError::io(&to_abs, source))?;
            let current_hash = content_hash_bytes(&current);
            if current_hash != expected {
                return Err(VaultError::HashMismatch {
                    path: txn.to_path.clone(),
                    expected: expected.to_string(),
                    found: current_hash,
                });
            }
        }
        fs::remove_file(&to_abs).map_err(|source| VaultError::io(&to_abs, source))?;
    }

    // Restore the source only where it is missing: a source that still exists is
    // either untouched or holds an edit made after planning (the reason a
    // copy-then-remove move aborts), and the backup must not overwrite it.
    if source_backup.is_file() && !from_abs.exists() {
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
            RenamePhase::Staged | RenamePhase::LinkWritesDone => {
                roll_back_unfinished(&self.root, &self.manifest)
            }
            RenamePhase::FileMoveDone => {
                rollback_file_move_and_link_writes(&self.root, &self.manifest)
            }
        }
    }
}

fn backup_file(
    root: &VaultRoot,
    dir: &Path,
    relative_path: &str,
) -> Result<(String, String), VaultError> {
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

    remove_if_present(&backup_abs(root, &txn.source_backup)?)?;
    for backup in txn.affected_backups.values() {
        remove_if_present(&backup_abs(root, backup)?)?;
    }
    remove_if_present(&manifest_path(root))?;
    let dir = txn_dir(root);
    if dir.is_dir()
        && fs::read_dir(&dir)
            .map_err(|source| VaultError::io(&dir, source))?
            .next()
            .is_none()
    {
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

    /// A crash after the note moved but before `FileMoveDone` was recorded used
    /// to restore the backlinks while leaving the note at its new name, so every
    /// restored link pointed at a file that no longer existed.
    #[test]
    fn recovery_after_a_crash_mid_move_puts_the_note_back_with_its_links() {
        let dir = tempdir().unwrap();
        std::fs::write(dir.path().join("Note.md"), "# Note\n").unwrap();
        std::fs::write(dir.path().join("Other.md"), "# Other\n\n[[Note]]\n").unwrap();
        let session = open_vault(dir.path()).unwrap();
        let from = RelativeVaultPath::parse("Note.md").unwrap();
        let to = RelativeVaultPath::parse("Renamed.md").unwrap();
        let rewritten = "# Other\n\n[[Renamed]]\n";
        let intended = BTreeMap::from([(
            "Other.md".to_string(),
            content_hash_bytes(rewritten.as_bytes()),
        )]);
        let mut staged = StagedRenameTransaction::begin_with_intended(
            &session.root,
            &from,
            &to,
            &["Note.md".into(), "Other.md".into()],
            &intended,
        )
        .unwrap();
        staged.record_phase(RenamePhase::LinkWritesDone).unwrap();
        std::fs::write(dir.path().join("Other.md"), rewritten).unwrap();
        std::fs::rename(dir.path().join("Note.md"), dir.path().join("Renamed.md")).unwrap();
        drop(staged);

        recover_pending_rename_transactions(&session.root).unwrap();

        assert_eq!(
            std::fs::read_to_string(dir.path().join("Note.md")).unwrap(),
            "# Note\n"
        );
        assert!(!dir.path().join("Renamed.md").exists());
        assert!(
            std::fs::read_to_string(dir.path().join("Other.md"))
                .unwrap()
                .contains("[[Note]]")
        );
        assert!(!manifest_path(&session.root).is_file());
    }

    #[test]
    fn staged_recovery_after_the_move_returns_the_note_to_its_original_path() {
        let dir = tempdir().unwrap();
        std::fs::write(dir.path().join("Note.md"), "# Note\n").unwrap();
        let session = open_vault(dir.path()).unwrap();
        let from = RelativeVaultPath::parse("Note.md").unwrap();
        let to = RelativeVaultPath::parse("Renamed.md").unwrap();
        let staged =
            StagedRenameTransaction::begin(&session.root, &from, &to, &["Note.md".into()]).unwrap();
        std::fs::rename(dir.path().join("Note.md"), dir.path().join("Renamed.md")).unwrap();

        staged.abort().unwrap();

        assert_eq!(
            std::fs::read_to_string(dir.path().join("Note.md")).unwrap(),
            "# Note\n"
        );
        assert!(!dir.path().join("Renamed.md").exists());
        assert!(!manifest_path(&session.root).is_file());
    }

    #[test]
    fn rollback_never_overwrites_a_source_edited_after_planning() {
        let dir = tempdir().unwrap();
        std::fs::write(dir.path().join("Note.md"), "# Note\n").unwrap();
        let session = open_vault(dir.path()).unwrap();
        let from = RelativeVaultPath::parse("Note.md").unwrap();
        let to = RelativeVaultPath::parse("Renamed.md").unwrap();
        let moved = "# Note moved\n";
        let intended =
            BTreeMap::from([("Note.md".to_string(), content_hash_bytes(moved.as_bytes()))]);
        let staged = StagedRenameTransaction::begin_with_intended(
            &session.root,
            &from,
            &to,
            &["Note.md".into()],
            &intended,
        )
        .unwrap();
        std::fs::write(dir.path().join("Renamed.md"), moved).unwrap();
        std::fs::write(dir.path().join("Note.md"), "# Note edited meanwhile\n").unwrap();

        staged.abort().unwrap();

        assert_eq!(
            std::fs::read_to_string(dir.path().join("Note.md")).unwrap(),
            "# Note edited meanwhile\n"
        );
        assert!(!dir.path().join("Renamed.md").exists());
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
    fn recovery_refuses_backup_paths_outside_the_transaction_directory() {
        let dir = tempdir().unwrap();
        let outside = tempdir().unwrap();
        let victim = outside.path().join("victim.txt");
        fs::write(&victim, "keep me").unwrap();
        fs::write(dir.path().join("note.md"), "note").unwrap();
        fs::create_dir_all(dir.path().join(".scriptor")).unwrap();
        let root = VaultRoot::open(dir.path()).unwrap();
        for hostile in [
            victim.to_string_lossy().to_string(),
            "../outside.bak".to_string(),
            ".scriptor/rename-txn/../../note.md".to_string(),
            "note.md".to_string(),
        ] {
            let manifest = RenameTransactionManifest {
                version: 3,
                phase: RenamePhase::FileMoveDone,
                from_path: "note.md".into(),
                to_path: "moved.md".into(),
                source_backup: hostile.clone(),
                ..Default::default()
            };
            write_manifest(&root, &manifest).unwrap();
            let outcome = recover_pending_rename_transactions(&root).unwrap();
            assert!(outcome.reindex_paths.is_empty(), "{hostile}");
            assert!(!manifest_path(&root).exists(), "{hostile}");
            assert!(
                manifest_path(&root)
                    .with_extension("json.rejected")
                    .exists()
            );
            assert_eq!(fs::read_to_string(&victim).unwrap(), "keep me");
            assert_eq!(
                fs::read_to_string(dir.path().join("note.md")).unwrap(),
                "note"
            );
        }
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

    /// Manifests written before the original/intended hash records existed cannot
    /// say which notes the interrupted rename rewrote. They must still restore
    /// every recorded backup; skipping on a missing hash would keep links that
    /// point at a file the rename never created.
    #[test]
    fn legacy_manifest_recovery_restores_backups_without_hash_records() {
        let dir = tempdir().unwrap();
        std::fs::write(dir.path().join("Note.md"), "# Note\n").unwrap();
        std::fs::write(dir.path().join("Other.md"), "# Other\n\n[[Note]]\n").unwrap();
        let session = open_vault(dir.path()).unwrap();

        let from = RelativeVaultPath::parse("Note.md").unwrap();
        let to = RelativeVaultPath::parse("Renamed.md").unwrap();
        let staged =
            StagedRenameTransaction::begin(&session.root, &from, &to, &["Other.md".into()])
                .unwrap();
        let source_backup = staged.manifest.source_backup.clone();
        let affected_backups = staged.manifest.affected_backups.clone();
        let affected_files = staged.manifest.affected_files.clone();
        drop(staged);

        write_manifest(
            &session.root,
            &RenameTransactionManifest {
                version: 2,
                phase: RenamePhase::LinkWritesDone,
                from_path: from.to_string(),
                to_path: to.to_string(),
                source_backup,
                affected_backups,
                affected_files,
                ..Default::default()
            },
        )
        .unwrap();
        // The rename had already rewritten this note before it died.
        std::fs::write(dir.path().join("Other.md"), "# Other\n\n[[Renamed]]\n").unwrap();

        recover_pending_rename_transactions(&session.root).unwrap();

        let other = std::fs::read_to_string(dir.path().join("Other.md")).unwrap();
        assert!(
            other.contains("[[Note]]"),
            "legacy recovery skipped a note the interrupted rename rewrote: {other:?}"
        );
        assert!(!manifest_path(&session.root).is_file());
    }
}
