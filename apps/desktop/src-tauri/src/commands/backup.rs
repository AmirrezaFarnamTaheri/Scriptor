use std::collections::BTreeSet;
use std::fs;
use std::io::{Read, Write};
use std::path::{Component, Path, PathBuf};

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

use crate::authorization::{SensitiveOperation, require_sensitive_operation};
use crate::state::{AppState, active_session, write_recover};

const BACKUP_SCHEMA_VERSION: u32 = 2;
const MANIFEST_FILE: &str = "scriptor-backup.json";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VaultBackupEntry {
    pub name: String,
    pub path: String,
    pub created_at: String,
    pub size_bytes: u64,
    pub storage_kind: String,
    pub verified: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct BackupManifest {
    schema_version: u32,
    #[serde(alias = "vault_root")]
    source_vault_root: String,
    created_at: String,
    files: Vec<BackupFile>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct BackupFile {
    path: String,
    size_bytes: u64,
    sha256: String,
}

fn backup_root(
    vault_root: &Path,
    backup_path: Option<&str>,
) -> Result<(PathBuf, &'static str), String> {
    let Some(configured) = backup_path.map(str::trim).filter(|value| !value.is_empty()) else {
        return Ok((
            vault_root.join(".scriptor").join("snapshots"),
            "local_snapshot",
        ));
    };

    let configured = PathBuf::from(configured);
    if !configured.is_absolute() {
        return Err(
            "Disaster-recovery backup path must be absolute and outside the active vault".into(),
        );
    }
    fs::create_dir_all(&configured)
        .map_err(|error| format!("Cannot create backup root: {error}"))?;
    let canonical =
        fs::canonicalize(&configured).map_err(|error| format!("Invalid backup root: {error}"))?;
    let canonical_vault =
        fs::canonicalize(vault_root).map_err(|error| format!("Invalid vault root: {error}"))?;
    if canonical.starts_with(&canonical_vault) || canonical_vault.starts_with(&canonical) {
        return Err(
            "Disaster-recovery backups must not be stored inside or above the active vault".into(),
        );
    }
    Ok((canonical.join("scriptor-backups"), "external_backup"))
}

fn validate_backup_name(name: &str) -> Result<(), String> {
    if !name.starts_with("vault-backup-")
        || name.len() > 96
        || !name
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || byte == b'-')
    {
        return Err("Invalid backup identifier".into());
    }
    Ok(())
}

fn confined_backup_dir(root: &Path, name: &str) -> Result<PathBuf, String> {
    validate_backup_name(name)?;
    let canonical_root =
        fs::canonicalize(root).map_err(|error| format!("Invalid backup root: {error}"))?;
    let candidate = canonical_root.join(name);
    let metadata =
        fs::symlink_metadata(&candidate).map_err(|_| format!("Backup not found: {name}"))?;
    if metadata.file_type().is_symlink() || !metadata.is_dir() {
        return Err("Backup identifier does not reference a regular directory".into());
    }
    let canonical =
        fs::canonicalize(&candidate).map_err(|error| format!("Invalid backup: {error}"))?;
    if canonical.parent() != Some(canonical_root.as_path()) {
        return Err("Backup escapes the configured backup root".into());
    }
    Ok(canonical)
}

fn should_skip_backup_path(relative: &Path) -> bool {
    let mut components = relative.components().filter_map(|part| match part {
        Component::Normal(value) => value.to_str(),
        _ => None,
    });
    match components.next() {
        Some(".git") => true,
        Some(".scriptor") => {
            let Some(second) = components.next() else {
                return false;
            };
            second.starts_with("rename-txn")
                || matches!(
                    second,
                    "snapshots"
                        | "cache"
                        | "exports"
                        | "diagnostics"
                        | "audit"
                        | "tmp"
                        | "restore-journal"
                        | "recovery"
                )
        }
        _ => false,
    }
}

fn file_sha256(path: &Path) -> Result<String, String> {
    let mut file = fs::File::open(path).map_err(|error| error.to_string())?;
    let mut digest = Sha256::new();
    let mut buffer = [0u8; 64 * 1024];
    loop {
        let read = file.read(&mut buffer).map_err(|error| error.to_string())?;
        if read == 0 {
            break;
        }
        digest.update(&buffer[..read]);
    }
    Ok(hex::encode(digest.finalize()))
}

fn copy_tree(
    source: &Path,
    destination: &Path,
    relative: &Path,
    files: &mut Vec<BackupFile>,
) -> Result<(), String> {
    let metadata = fs::symlink_metadata(source).map_err(|error| error.to_string())?;
    if metadata.file_type().is_symlink() {
        return Err(format!(
            "Symlinks are not permitted in backups: {}",
            source.display()
        ));
    }
    fs::create_dir_all(destination).map_err(|error| error.to_string())?;
    for entry in fs::read_dir(source).map_err(|error| error.to_string())? {
        let entry = entry.map_err(|error| error.to_string())?;
        let file_type = entry.file_type().map_err(|error| error.to_string())?;
        if file_type.is_symlink() {
            return Err(format!(
                "Symlinks are not permitted in backups: {}",
                entry.path().display()
            ));
        }
        let child_relative = relative.join(entry.file_name());
        if should_skip_backup_path(&child_relative) {
            continue;
        }
        let target = destination.join(entry.file_name());
        if file_type.is_dir() {
            copy_tree(&entry.path(), &target, &child_relative, files)?;
        } else if file_type.is_file() {
            fs::copy(entry.path(), &target).map_err(|error| error.to_string())?;
            let size_bytes = fs::metadata(&target)
                .map_err(|error| error.to_string())?
                .len();
            files.push(BackupFile {
                path: child_relative.to_string_lossy().replace('\\', "/"),
                size_bytes,
                sha256: file_sha256(&target)?,
            });
        }
    }
    Ok(())
}

fn write_manifest(destination: &Path, manifest: &BackupManifest) -> Result<(), String> {
    let path = destination.join(MANIFEST_FILE);
    let temp = destination.join(format!(".{MANIFEST_FILE}.tmp"));
    let bytes = serde_json::to_vec_pretty(manifest).map_err(|error| error.to_string())?;
    let mut file = fs::File::create(&temp).map_err(|error| error.to_string())?;
    file.write_all(&bytes).map_err(|error| error.to_string())?;
    file.sync_all().map_err(|error| error.to_string())?;
    fs::rename(temp, path).map_err(|error| error.to_string())
}

fn collect_backup_files(
    root: &Path,
    relative: &Path,
    files: &mut Vec<String>,
) -> Result<(), String> {
    for entry in fs::read_dir(root.join(relative)).map_err(|error| error.to_string())? {
        let entry = entry.map_err(|error| error.to_string())?;
        let file_type = entry.file_type().map_err(|error| error.to_string())?;
        if file_type.is_symlink() {
            return Err(format!(
                "Backup contains a symlink: {}",
                entry.path().display()
            ));
        }
        let child = relative.join(entry.file_name());
        if file_type.is_dir() {
            collect_backup_files(root, &child, files)?;
        } else if file_type.is_file() && child != Path::new(MANIFEST_FILE) {
            files.push(child.to_string_lossy().replace('\\', "/"));
        }
    }
    Ok(())
}

fn read_and_verify_manifest(source: &Path) -> Result<BackupManifest, String> {
    let raw = fs::read(source.join(MANIFEST_FILE))
        .map_err(|error| format!("Backup manifest missing: {error}"))?;
    let manifest: BackupManifest = serde_json::from_slice(&raw)
        .map_err(|error| format!("Invalid backup manifest: {error}"))?;
    if !(1..=BACKUP_SCHEMA_VERSION).contains(&manifest.schema_version) {
        return Err(format!(
            "Unsupported backup schema version {}",
            manifest.schema_version
        ));
    }

    let mut declared = BTreeSet::new();
    for entry in &manifest.files {
        let relative = Path::new(&entry.path);
        if relative.is_absolute()
            || relative.components().any(|part| {
                matches!(
                    part,
                    Component::ParentDir | Component::RootDir | Component::Prefix(_)
                )
            })
        {
            return Err(format!("Unsafe path in backup manifest: {}", entry.path));
        }
        if !declared.insert(entry.path.clone()) {
            return Err(format!("Duplicate path in backup manifest: {}", entry.path));
        }
        let path = source.join(relative);
        let metadata = fs::symlink_metadata(&path)
            .map_err(|error| format!("Missing backup file {}: {error}", entry.path))?;
        if !metadata.is_file()
            || metadata.len() != entry.size_bytes
            || file_sha256(&path)? != entry.sha256
        {
            return Err(format!("Backup integrity check failed for {}", entry.path));
        }
    }

    let mut actual = Vec::new();
    collect_backup_files(source, Path::new(""), &mut actual)?;
    let actual = actual.into_iter().collect::<BTreeSet<_>>();
    if actual != declared {
        let unlisted = actual.difference(&declared).cloned().collect::<Vec<_>>();
        let missing = declared.difference(&actual).cloned().collect::<Vec<_>>();
        return Err(format!(
            "Backup manifest membership mismatch (unlisted: {}; missing: {})",
            unlisted.join(", "),
            missing.join(", ")
        ));
    }
    Ok(manifest)
}

#[cfg(unix)]
fn sync_file(path: &Path) -> Result<(), String> {
    fs::File::open(path)
        .map_err(|error| error.to_string())?
        .sync_all()
        .map_err(|error| error.to_string())
}

#[cfg(windows)]
fn sync_file(_path: &Path) -> Result<(), String> {
    // The standard library does not expose a portable Windows equivalent of
    // the Unix fsync guarantees used here. Rename ordering remains protected
    // by the journal markers; directory syncing is likewise a no-op below.
    Ok(())
}

#[cfg(unix)]
fn sync_directory(path: &Path) -> Result<(), String> {
    fs::File::open(path)
        .map_err(|error| error.to_string())?
        .sync_all()
        .map_err(|error| error.to_string())
}

#[cfg(windows)]
fn sync_directory(_path: &Path) -> Result<(), String> {
    // The standard library cannot open Windows directories with the flags
    // required for an explicit directory flush. File contents and the journal
    // marker are still fsync'd below; Windows commits the rename through its
    // filesystem cache semantics.
    Ok(())
}

fn sync_tree(root: &Path) -> Result<(), String> {
    let metadata = fs::symlink_metadata(root).map_err(|error| error.to_string())?;
    if metadata.file_type().is_symlink() {
        return Err(format!("Refusing to sync symlink: {}", root.display()));
    }
    if metadata.is_file() {
        sync_file(root)?;
        return Ok(());
    }
    if !metadata.is_dir() {
        return Err(format!(
            "Restore tree contains unsupported entry: {}",
            root.display()
        ));
    }
    for entry in fs::read_dir(root).map_err(|error| error.to_string())? {
        sync_tree(&entry.map_err(|error| error.to_string())?.path())?;
    }
    sync_directory(root)
}

fn validate_restore_journal(vault_root: &Path, journal: &Path) -> Result<(), String> {
    let metadata_root = fs::symlink_metadata(vault_root).map_err(|error| error.to_string())?;
    if metadata_root.file_type().is_symlink() || !metadata_root.is_dir() {
        return Err("Vault root must be a regular directory".into());
    }

    let metadata_scriptor = fs::symlink_metadata(vault_root.join(".scriptor"))
        .map_err(|error| format!("Invalid vault metadata directory: {error}"))?;
    if metadata_scriptor.file_type().is_symlink() || !metadata_scriptor.is_dir() {
        return Err("Vault metadata directory must be a regular directory".into());
    }

    let metadata_journal = fs::symlink_metadata(journal)
        .map_err(|error| format!("Invalid restore journal: {error}"))?;
    if metadata_journal.file_type().is_symlink() || !metadata_journal.is_dir() {
        return Err("Restore journal must be a regular directory".into());
    }

    let canonical_root = fs::canonicalize(vault_root).map_err(|error| error.to_string())?;
    let canonical_journal = fs::canonicalize(journal).map_err(|error| error.to_string())?;
    if !canonical_journal.starts_with(canonical_root.join(".scriptor")) {
        return Err("Restore journal escapes the vault metadata directory".into());
    }
    for name in ["staged", "rollback"] {
        let child = journal.join(name);
        if !child.exists() {
            continue;
        }
        let metadata = fs::symlink_metadata(&child).map_err(|error| error.to_string())?;
        if metadata.file_type().is_symlink() || !metadata.is_dir() {
            return Err(format!(
                "Restore journal {name} must be a regular directory"
            ));
        }
        let canonical = fs::canonicalize(&child).map_err(|error| error.to_string())?;
        if !canonical.starts_with(&canonical_journal) {
            return Err(format!(
                "Restore journal {name} escapes its journal directory"
            ));
        }
    }
    Ok(())
}

fn clear_persistent_vault_content(root: &Path) -> Result<(), String> {
    for entry in fs::read_dir(root).map_err(|error| error.to_string())? {
        let entry = entry.map_err(|error| error.to_string())?;
        let name = entry.file_name();
        let file_type = entry.file_type().map_err(|error| error.to_string())?;
        if file_type.is_symlink() {
            return Err(format!(
                "Refusing to remove symlink during restore: {}",
                entry.path().display()
            ));
        }
        if name == ".git" {
            continue;
        }
        if name == ".scriptor" && file_type.is_dir() {
            for metadata_entry in fs::read_dir(entry.path()).map_err(|error| error.to_string())? {
                let metadata_entry = metadata_entry.map_err(|error| error.to_string())?;
                let relative = Path::new(".scriptor").join(metadata_entry.file_name());
                if should_skip_backup_path(&relative) {
                    continue;
                }
                let metadata_type = metadata_entry
                    .file_type()
                    .map_err(|error| error.to_string())?;
                if metadata_type.is_symlink() {
                    return Err(format!(
                        "Refusing to remove symlink during restore: {}",
                        metadata_entry.path().display()
                    ));
                }
                if metadata_type.is_dir() {
                    fs::remove_dir_all(metadata_entry.path())
                } else {
                    fs::remove_file(metadata_entry.path())
                }
                .map_err(|error| error.to_string())?;
            }
            continue;
        }
        if file_type.is_dir() {
            fs::remove_dir_all(entry.path())
        } else {
            fs::remove_file(entry.path())
        }
        .map_err(|error| error.to_string())?;
    }
    Ok(())
}

fn dir_size(path: &Path) -> Result<u64, String> {
    let mut total = 0;
    for entry in fs::read_dir(path).map_err(|error| error.to_string())? {
        let entry = entry.map_err(|error| error.to_string())?;
        let file_type = entry.file_type().map_err(|error| error.to_string())?;
        if file_type.is_symlink() {
            return Err("Backup contains a symlink".into());
        }
        if file_type.is_dir() {
            total += dir_size(&entry.path())?;
        } else if file_type.is_file() {
            total += entry.metadata().map_err(|error| error.to_string())?.len();
        }
    }
    Ok(total)
}

fn entry_from_dir(path: &Path, storage_kind: &str) -> Result<VaultBackupEntry, String> {
    let manifest = fs::read(path.join(MANIFEST_FILE))
        .ok()
        .and_then(|bytes| serde_json::from_slice::<BackupManifest>(&bytes).ok());
    Ok(VaultBackupEntry {
        name: path
            .file_name()
            .and_then(|value| value.to_str())
            .unwrap_or_default()
            .to_string(),
        path: path.display().to_string(),
        created_at: manifest
            .as_ref()
            .map(|value| value.created_at.clone())
            .unwrap_or_default(),
        size_bytes: dir_size(path)?,
        storage_kind: storage_kind.into(),
        verified: read_and_verify_manifest(path).is_ok(),
    })
}

#[tauri::command]
pub fn vault_create_backup(
    state: tauri::State<AppState>,
    backup_path: Option<String>,
    authorization_token: String,
) -> Result<VaultBackupEntry, String> {
    let _switch = crate::state::lock_recover(&state.vault_switch_lock, "vault backup");
    let session_guard = write_recover(&state.session, "session");
    let session = session_guard
        .as_ref()
        .ok_or_else(|| "No vault is open. Call vault_open first.".to_string())?;
    let scope = backup_path
        .as_deref()
        .filter(|value| !value.trim().is_empty())
        .unwrap_or("local-snapshot");
    require_sensitive_operation(
        &state,
        &authorization_token,
        SensitiveOperation::CreateBackup,
        Some(scope),
        Some(&session.descriptor.id),
    )?;
    let vault_root = session.root.root();
    let (root, storage_kind) = backup_root(vault_root, backup_path.as_deref())?;
    fs::create_dir_all(&root).map_err(|error| error.to_string())?;

    let timestamp = chrono::Utc::now();
    let canonical_vault = fs::canonicalize(vault_root).map_err(|error| error.to_string())?;
    let fingerprint = &scriptor_vault::content_hash(&canonical_vault.display().to_string())[..12];
    let name = format!(
        "vault-backup-{fingerprint}-{}-{}",
        timestamp.format("%Y%m%d-%H%M%S"),
        std::process::id()
    );
    let destination = root.join(&name);
    let partial = root.join(format!(".partial-{}", uuid::Uuid::new_v4()));
    fs::create_dir(&partial).map_err(|error| error.to_string())?;

    let mut files = Vec::new();
    if let Err(error) = copy_tree(vault_root, &partial, Path::new(""), &mut files) {
        let _ = fs::remove_dir_all(&partial);
        return Err(format!("Backup creation failed: {error}"));
    }
    files.sort_by(|left, right| left.path.cmp(&right.path));
    let manifest = BackupManifest {
        schema_version: BACKUP_SCHEMA_VERSION,
        source_vault_root: canonical_vault.display().to_string(),
        created_at: timestamp.to_rfc3339(),
        files,
    };
    if let Err(error) = write_manifest(&partial, &manifest) {
        let _ = fs::remove_dir_all(&partial);
        return Err(error);
    }
    fs::rename(&partial, &destination).map_err(|error| {
        let _ = fs::remove_dir_all(&partial);
        format!("Failed to finalize backup: {error}")
    })?;
    if let Ok(directory) = fs::File::open(&root) {
        let _ = directory.sync_all();
    }
    entry_from_dir(&destination, storage_kind)
}

fn list_backup_entries(root: &Path, storage_kind: &str) -> Result<Vec<VaultBackupEntry>, String> {
    if !root.exists() {
        return Ok(Vec::new());
    }
    let mut backups = Vec::new();
    for entry in fs::read_dir(root).map_err(|error| error.to_string())? {
        let entry = entry.map_err(|error| error.to_string())?;
        let file_type = entry.file_type().map_err(|error| error.to_string())?;
        if file_type.is_symlink() || !file_type.is_dir() {
            continue;
        }
        let Some(name) = entry.file_name().to_str().map(str::to_string) else {
            continue;
        };
        if validate_backup_name(&name).is_err() {
            continue;
        }
        if let Ok(backup) = entry_from_dir(&entry.path(), storage_kind) {
            backups.push(backup);
        }
    }
    backups.sort_by(|left, right| right.created_at.cmp(&left.created_at));
    Ok(backups)
}

#[tauri::command]
pub fn vault_list_backups(
    state: tauri::State<AppState>,
    backup_path: Option<String>,
) -> Result<Vec<VaultBackupEntry>, String> {
    let session = active_session(&state)?;
    let (root, storage_kind) = backup_root(session.root.root(), backup_path.as_deref())?;
    list_backup_entries(&root, storage_kind)
}

#[tauri::command]
pub fn vault_delete_backup(
    state: tauri::State<AppState>,
    backup_name: String,
    backup_path: Option<String>,
    authorization_token: String,
) -> Result<(), String> {
    let session = active_session(&state)?;
    require_sensitive_operation(
        &state,
        &authorization_token,
        SensitiveOperation::DeleteBackup,
        Some(&backup_name),
        Some(&session.descriptor.id),
    )?;
    let (root, _) = backup_root(session.root.root(), backup_path.as_deref())?;
    fs::remove_dir_all(confined_backup_dir(&root, &backup_name)?)
        .map_err(|error| format!("Failed to delete backup: {error}"))
}

/// Recovers any interrupted restore operation left in `.scriptor/restore-journal`.
/// Called during `vault_open` and before a new restore so unresolved recovery
/// state is never discarded merely because the user retries the operation.
///
/// Restore states are deliberately explicit and monotonic around destructive
/// filesystem work. A transition is persisted before the mutation it protects.
/// If a state write is interrupted and the marker becomes unreadable/missing,
/// recovery fails closed instead of assuming rollback succeeded.
const RESTORE_STATE_PREPARING: &str = "preparing";
const RESTORE_STATE_PROMOTING: &str = "promoting";
const RESTORE_STATE_ROLLBACK_IN_PROGRESS: &str = "rollback-in-progress";
const RESTORE_STATE_ROLLED_BACK: &str = "rolled-back";
const RESTORE_STATE_COMPLETE: &str = "complete";

fn sync_restore_directory(path: &Path) -> Result<(), String> {
    // Unix requires syncing the containing directory for rename/create
    // durability. std does not expose an equivalent portable directory handle
    // on Windows; the state file itself is still sync_all'd, and any
    // replace-gap/read failure is classified as RecoveryRequired.
    #[cfg(unix)]
    {
        fs::File::open(path)
            .and_then(|directory| directory.sync_all())
            .map_err(|error| format!("Failed to sync restore journal directory: {error}"))?;
    }
    #[cfg(not(unix))]
    {
        let _ = path;
    }
    Ok(())
}

fn write_restore_state(transaction: &Path, state: &str) -> Result<(), String> {
    let state_file = transaction.join("state");
    let temp_file = transaction.join("state.tmp");
    let mut file = fs::OpenOptions::new()
        .create(true)
        .truncate(true)
        .write(true)
        .open(&temp_file)
        .map_err(|error| format!("Failed to create restore state {state}: {error}"))?;
    file.write_all(state.as_bytes())
        .map_err(|error| format!("Failed to write restore state {state}: {error}"))?;
    file.sync_all()
        .map_err(|error| format!("Failed to sync restore state {state}: {error}"))?;
    drop(file);

    if let Err(rename_error) = fs::rename(&temp_file, &state_file) {
        if !state_file.exists() {
            return Err(format!(
                "Failed to install restore state {state}: {rename_error}"
            ));
        }

        // Windows does not replace an existing destination with rename(). The
        // fallback can leave a missing marker if interrupted between remove and
        // rename; that state is intentionally fail-closed by finalization and
        // recovery rather than being treated as a successful rollback.
        fs::remove_file(&state_file)
            .map_err(|error| format!("Failed to replace restore state {state}: {error}"))?;
        fs::rename(&temp_file, &state_file)
            .map_err(|error| format!("Failed to install restore state {state}: {error}"))?;
    }
    sync_restore_directory(transaction)
}

fn restore_failure_is_reconciled(journal_state: Option<&str>) -> bool {
    matches!(
        journal_state,
        Some(state)
            if state == RESTORE_STATE_PREPARING || state == RESTORE_STATE_ROLLED_BACK
    )
}

fn should_attempt_restore_reopen(
    transaction_result: &Result<(), String>,
    journal_state: Option<&str>,
) -> bool {
    transaction_result.is_ok() || restore_failure_is_reconciled(journal_state)
}

pub fn recover_interrupted_restore(vault_root: &Path) -> Result<(), String> {
    let journal = vault_root.join(".scriptor").join("restore-journal");
    let journal_metadata = match fs::symlink_metadata(&journal) {
        Ok(metadata) => metadata,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(()),
        Err(error) => return Err(format!("Failed to inspect restore journal: {error}")),
    };
    if journal_metadata.file_type().is_symlink() || !journal_metadata.is_dir() {
        return Err(
            "Restore journal must be a regular directory; journal preserved for manual inspection."
                .into(),
        );
    }
    validate_restore_journal(vault_root, &journal)?;

    let state_file = journal.join("state");
    let state = fs::read_to_string(&state_file)
        .map(|s| s.trim().to_string())
        .map_err(|error| {
            format!(
                "Failed to read restore journal state: {error}. Journal preserved for recovery."
            )
        })?;

    if state == RESTORE_STATE_ROLLED_BACK {
        // The replacement was reverted and the rollback was flushed before this
        // marker was written, so the vault already matches the pre-restore
        // snapshot. Only the evidence itself remains to be swept.
        fs::remove_dir_all(&journal)
            .map_err(|error| format!("Failed to remove rolled-back restore journal: {error}"))?;
        sync_directory(&vault_root.join(".scriptor"))
            .map_err(|error| format!("Failed to durably remove restore journal: {error}"))?;
        Ok(())
    } else if state == RESTORE_STATE_PROMOTING || state == RESTORE_STATE_ROLLBACK_IN_PROGRESS {
        let rollback = journal.join("rollback");
        let rollback_metadata = fs::symlink_metadata(&rollback)
            .map_err(|error| format!("Restore rollback snapshot is missing. Journal preserved for manual inspection. Error: {error}"))?;
        if rollback_metadata.file_type().is_symlink() || !rollback_metadata.is_dir() {
            return Err("Restore rollback snapshot must be a regular directory; journal preserved for manual inspection.".into());
        }
        eprintln!(
            "[vault-backup] Interrupted restore detected in {state} state; rolling back to pre-restore snapshot"
        );
        write_restore_state(&journal, RESTORE_STATE_ROLLBACK_IN_PROGRESS)?;
        clear_persistent_vault_content(vault_root).map_err(|error| {
            format!("Failed to clear partial vault during restore rollback: {error}")
        })?;
        let mut ignored = Vec::new();
        copy_tree(&rollback, vault_root, Path::new(""), &mut ignored)
            .map_err(|error| format!("Failed to restore rollback snapshot: {error}"))?;
        sync_tree(vault_root)
            .map_err(|error| format!("Failed to durably restore rollback snapshot: {error}"))?;
        write_restore_state(&journal, RESTORE_STATE_ROLLED_BACK)?;
        fs::remove_dir_all(&journal)
            .map_err(|error| format!("Failed to remove completed restore journal: {error}"))?;
        sync_directory(&vault_root.join(".scriptor"))
            .map_err(|error| format!("Failed to durably remove restore journal: {error}"))?;
        Ok(())
    } else if state == RESTORE_STATE_PREPARING
        || state == RESTORE_STATE_ROLLED_BACK
        || state == RESTORE_STATE_COMPLETE
    {
        fs::remove_dir_all(&journal)
            .map_err(|error| format!("Failed to remove {state} restore journal: {error}"))?;
        sync_directory(&vault_root.join(".scriptor"))
            .map_err(|error| format!("Failed to durably remove restore journal: {error}"))?;
        Ok(())
    } else {
        Err(format!(
            "Unrecognized restore journal state '{state}'. Journal preserved for manual inspection."
        ))
    }
}

/// Terminal status of a vault restore, reported to the frontend so it can
/// decide whether editor persistence may resume.
///
/// The distinction that matters is not whether the command returned an error
/// but whether the filesystem is authoritative, and whether the active session
/// is the one that opened the restored tree. A transaction that promoted the
/// staged content but failed to write the completion marker has still replaced
/// the vault content, so resuming the superseded draft would overwrite it just
/// as surely as in the committed case. And a committed replacement whose
/// reopen failed leaves the pre-restore session in place — one that never ran
/// rename-transaction recovery on the restored content — so the restored
/// lifecycle and index rebuild must not run against it.
///
/// The wire format is pinned to kebab-case because the frontend mirrors it as a
/// literal union, so a status must never be renamed on one side only.
#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub enum VaultRestoreStatus {
    /// Replacement never mutated vault files: a pre-transaction check failed,
    /// or promotion failed and the rollback snapshot fully restored the
    /// original content. Editor persistence may resume.
    RolledBack,
    /// Files were replaced but the completion marker could not be written, so
    /// the transaction is neither rolled back nor recognizable as complete.
    /// Persistence must stay frozen and the rollback journal must be kept for
    /// recovery on the next vault open.
    RecoveryRequired,
    /// The replacement is durable, but the vault session could not be
    /// reopened, so the caller's session predates the restored content.
    /// Persistence must stay frozen and the restored lifecycle must not run
    /// until the user reopens the vault, which reconciles the journal.
    CommittedNeedsReopen,
    /// The replacement is durable and a fresh session owns the restored
    /// content. The caller may run the normal restored lifecycle.
    CommittedReady,
}

#[derive(Debug, Clone, Serialize)]
pub struct VaultRestoreResult {
    pub status: VaultRestoreStatus,
    pub message: String,
}

/// Finalizes a restore once the replacement transaction and the session reopen
/// have both reached a terminal outcome.
///
/// A transaction `Err` is ambiguous on its own: it covers both a restore that
/// promoted nothing and rolled back cleanly (safe to resume) and one that
/// promoted the staged content but could not record completion (the vault
/// already holds the restored content, and resuming the superseded draft
/// would overwrite it). The on-disk journal state distinguishes them: the
/// transaction only writes `promoting` before it starts mutating the vault,
/// so a leftover `promoting` marker after an error means the replacement was
/// in flight when it failed.
///
/// A committed replacement drops the journal only once a fresh session owns
/// the restored content, so a crash or a failed reopen between the commit and
/// the session swap cannot discard the only recovery path for content that was
/// already replaced. A reopen failure is reported as needs-reopen rather than
/// ready, so the caller does not run the restored lifecycle against the
/// pre-restore session.
fn finalize_restore(
    transaction_result: Result<(), String>,
    transaction: &Path,
    journal_state: Option<String>,
    reopen_outcome: Result<(), String>,
    backup_name: &str,
    source_vault_root: &str,
) -> VaultRestoreResult {
    let status = match transaction_result.as_ref() {
        Ok(()) => match reopen_outcome.as_ref() {
            Ok(()) => VaultRestoreStatus::CommittedReady,
            Err(_) => VaultRestoreStatus::CommittedNeedsReopen,
        },
        Err(_) if restore_failure_is_reconciled(journal_state.as_deref()) => {
            VaultRestoreStatus::RolledBack
        }
        Err(_) => VaultRestoreStatus::RecoveryRequired,
    };

    if status == VaultRestoreStatus::CommittedReady {
        // A fresh session now owns the restored content, so the rollback
        // snapshot is no longer needed. A failed cleanup is not fatal:
        // recovery finalizes a leftover `complete` journal on the next open.
        if let Err(error) = fs::remove_dir_all(transaction) {
            eprintln!(
                "[vault-backup] Restore committed and reopened, but journal cleanup failed: {error}"
            );
        } else if let Some(parent) = transaction.parent()
            && let Err(error) = sync_directory(parent)
        {
            eprintln!("[vault-backup] Restore journal directory sync failed: {error}");
        }
    }

    let message = match &status {
        VaultRestoreStatus::RolledBack => transaction_result
            .err()
            .unwrap_or_else(|| "Restore did not replace any vault content".to_string()),
        VaultRestoreStatus::CommittedReady => format!(
            "Restored and verified {backup_name} from {source_vault_root}; \
             a full index rebuild is required"
        ),
        VaultRestoreStatus::CommittedNeedsReopen => format!(
            "Restored {backup_name} from {source_vault_root}, but the vault session \
             could not be reopened: {}. The vault files are authoritative; reopen the \
             vault before editing so the restore journal can reconcile.",
            reopen_outcome.as_ref().err().unwrap_or(&String::new())
        ),
        VaultRestoreStatus::RecoveryRequired => {
            let detail = transaction_result
                .as_ref()
                .err()
                .or_else(|| reopen_outcome.as_ref().err())
                .map(String::as_str)
                .unwrap_or("the restore journal is incomplete or unreadable");
            format!(
                "Restore {backup_name} from {source_vault_root} requires recovery. Vault files may be replaced; reopen the vault so the recovery journal can reconcile before editing: {detail}"
            )
        }
    };

    VaultRestoreResult { status, message }
}

#[tauri::command]
pub fn vault_restore_backup(
    state: tauri::State<AppState>,
    backup_name: String,
    backup_path: Option<String>,
    authorization_token: String,
) -> Result<VaultRestoreResult, String> {
    let _switch = crate::state::lock_recover(&state.vault_switch_lock, "vault switch");
    let mut session_guard = write_recover(&state.session, "session");
    let session = session_guard
        .as_mut()
        .ok_or_else(|| "No vault is open. Call vault_open first.".to_string())?;

    require_sensitive_operation(
        &state,
        &authorization_token,
        SensitiveOperation::RestoreBackup,
        Some(&backup_name),
        Some(&session.descriptor.id),
    )?;
    let vault_root = session.root.root().to_path_buf();
    let (root, _) = backup_root(&vault_root, backup_path.as_deref())?;
    let source = confined_backup_dir(&root, &backup_name)?;
    let manifest = read_and_verify_manifest(&source)?;

    let transaction = vault_root.join(".scriptor").join("restore-journal");
    let transaction_exists = match fs::symlink_metadata(&transaction) {
        Ok(metadata) => {
            if metadata.file_type().is_symlink() || !metadata.is_dir() {
                return Err("Restore journal must be a regular directory".into());
            }
            true
        }
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => false,
        Err(error) => return Err(format!("Failed to inspect restore journal: {error}")),
    };
    if transaction_exists {
        recover_interrupted_restore(&vault_root)?;
    }
    fs::create_dir_all(&transaction).map_err(|error| error.to_string())?;
    validate_restore_journal(&vault_root, &transaction)?;
    let staged = transaction.join("staged");
    let rollback = transaction.join("rollback");
    write_restore_state(&transaction, RESTORE_STATE_PREPARING)?;

    let result = (|| {
        let mut ignored = Vec::new();
        copy_tree(&source, &staged, Path::new(""), &mut ignored)?;
        let _ = fs::remove_file(staged.join(MANIFEST_FILE));
        sync_tree(&staged)?;
        ignored.clear();
        copy_tree(&vault_root, &rollback, Path::new(""), &mut ignored)?;
        sync_tree(&rollback)?;
        write_restore_state(&transaction, RESTORE_STATE_PROMOTING)?;
        clear_persistent_vault_content(&vault_root)?;
        sync_directory(&vault_root)?;
        ignored.clear();
        if let Err(promote_error) = copy_tree(&staged, &vault_root, Path::new(""), &mut ignored) {
            let rollback_result =
                write_restore_state(&transaction, RESTORE_STATE_ROLLBACK_IN_PROGRESS)
                    .and_then(|_| clear_persistent_vault_content(&vault_root))
                    .and_then(|_| {
                        ignored.clear();
                        copy_tree(&rollback, &vault_root, Path::new(""), &mut ignored)
                    });
            return match rollback_result {
                Ok(()) => {
                    // Record the rollback itself as a durable terminal state. A
                    // crash before this marker is written leaves `promoting`,
                    // which recovery must treat as unresolved; a rollback that
                    // succeeded but could not be recorded would otherwise be
                    // reported as recovery-required and restore the snapshot a
                    // second time.
                    let recorded = sync_tree(&vault_root).and_then(|()| {
                        write_restore_state(&transaction, RESTORE_STATE_ROLLED_BACK)
                    });
                    Err(match recorded {
                        Ok(()) => format!("Restore failed and was rolled back: {promote_error}"),
                        Err(error) => format!(
                            "Restore failed ({promote_error}); rollback durability failed ({error})"
                        ),
                    })
                }
                Err(rollback_error) => Err(format!(
                    "Restore failed ({promote_error}); rollback also failed ({rollback_error})"
                )),
            };
        }
        sync_tree(&vault_root)?;
        write_restore_state(&transaction, RESTORE_STATE_COMPLETE)?;
        Ok(())
    })();

    // The replacement has reached a terminal outcome. Reopen the vault before
    // deciding the fate of the rollback journal: a failed replacement keeps it
    // for recovery, and a committed replacement keeps it until a fresh session
    // is established so a crash between commit and reopen never discards the
    // only recovery path for the already-replaced content.
    //
    // The journal marker is read after the transaction: an error paired with a
    // `promoting` marker means the staged content was being promoted when the
    // failure happened, so the vault must not be treated as rolled back.
    let journal_state = fs::read_to_string(transaction.join("state"))
        .ok()
        .map(|state| state.trim().to_string());
    let should_reopen = should_attempt_restore_reopen(&result, journal_state.as_deref());
    let reopened = if should_reopen {
        scriptor_vault::open_vault(&vault_root).map_err(|error| error.to_string())
    } else {
        Err(
            "restore recovery is unresolved; normal session reopen was intentionally skipped"
                .to_string(),
        )
    };
    let outcome = finalize_restore(
        result,
        &transaction,
        journal_state,
        reopened.as_ref().map(|_| ()).map_err(Clone::clone),
        &backup_name,
        &manifest.source_vault_root,
    );

    // Only swap in the fresh session when the outcome is safe to use in-process.
    // A recovery-required result deliberately tells the caller to reopen the
    // vault through the normal open path, which runs restore-journal recovery
    // before installing a session. Installing this direct reopen would let later
    // native operations act on an unreconciled tree.
    if matches!(
        outcome.status,
        VaultRestoreStatus::RolledBack | VaultRestoreStatus::CommittedReady
    ) && let Ok(refreshed_session) = reopened
    {
        *session_guard = Some(refreshed_session);
        crate::state::reset_git_queue(&state);
    }

    Ok(outcome)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn backup_names_are_opaque() {
        assert!(validate_backup_name("vault-backup-a1b2c3d4e5f6-20260712-120000-42").is_ok());
        assert!(validate_backup_name("../outside").is_err());
        assert!(validate_backup_name("vault-backup-a/b").is_err());
        assert!(validate_backup_name("C:\\outside").is_err());
    }

    #[test]
    fn backup_listing_ignores_unowned_directories_but_keeps_owned_corrupt_entries_visible() {
        let directory = tempfile::tempdir().expect("tempdir");
        fs::create_dir(directory.path().join("notes")).expect("notes");
        fs::create_dir(directory.path().join("old")).expect("old");
        let owned = directory
            .path()
            .join("vault-backup-a1b2c3d4e5f6-20260712-120000-42");
        fs::create_dir(&owned).expect("owned");
        fs::write(owned.join("note.md"), "# incomplete backup").expect("note");

        let listed = list_backup_entries(directory.path(), "external_backup").expect("list");
        assert_eq!(listed.len(), 1);
        assert_eq!(
            listed[0].name,
            "vault-backup-a1b2c3d4e5f6-20260712-120000-42"
        );
        assert!(
            !listed[0].verified,
            "owned corrupt backup stays visible so it can be inspected/deleted"
        );
    }

    #[test]
    fn backup_policy_keeps_durable_metadata_and_skips_transient_state() {
        assert!(!should_skip_backup_path(Path::new("notes/a.md")));
        assert!(!should_skip_backup_path(Path::new(".scriptor/config.json")));
        assert!(!should_skip_backup_path(Path::new(
            ".scriptor/templates/daily.md"
        )));
        assert!(!should_skip_backup_path(Path::new(
            ".scriptor/history/note.json"
        )));
        assert!(should_skip_backup_path(Path::new(".git/config")));
        assert!(should_skip_backup_path(Path::new(
            ".scriptor/cache/index.sqlite"
        )));
        assert!(should_skip_backup_path(Path::new(
            ".scriptor/snapshots/recursive"
        )));
        assert!(should_skip_backup_path(Path::new(
            ".scriptor/restore-journal/state"
        )));
    }

    #[test]
    fn manifest_rejects_unlisted_files() {
        let directory = tempfile::tempdir().expect("tempdir");
        let note = directory.path().join("note.md");
        fs::write(&note, "# Note\n").expect("write note");
        let manifest = BackupManifest {
            schema_version: BACKUP_SCHEMA_VERSION,
            source_vault_root: "/source/vault".into(),
            created_at: chrono::Utc::now().to_rfc3339(),
            files: vec![BackupFile {
                path: "note.md".into(),
                size_bytes: fs::metadata(&note).expect("metadata").len(),
                sha256: file_sha256(&note).expect("hash"),
            }],
        };
        write_manifest(directory.path(), &manifest).expect("manifest");
        fs::write(directory.path().join("injected.md"), "not declared").expect("extra file");
        assert!(read_and_verify_manifest(directory.path()).is_err());
    }

    #[test]
    fn verified_backup_is_portable_across_vault_paths() {
        let directory = tempfile::tempdir().expect("tempdir");
        let note = directory.path().join("note.md");
        fs::write(&note, "# Portable\n").expect("write note");
        let manifest = BackupManifest {
            schema_version: BACKUP_SCHEMA_VERSION,
            source_vault_root: "/old-machine/original-vault".into(),
            created_at: chrono::Utc::now().to_rfc3339(),
            files: vec![BackupFile {
                path: "note.md".into(),
                size_bytes: fs::metadata(&note).expect("metadata").len(),
                sha256: file_sha256(&note).expect("hash"),
            }],
        };
        write_manifest(directory.path(), &manifest).expect("manifest");
        let verified = read_and_verify_manifest(directory.path()).expect("portable manifest");
        assert_eq!(verified.source_vault_root, "/old-machine/original-vault");
    }

    #[test]
    fn backup_skips_rename_transactions() {
        assert!(should_skip_backup_path(Path::new(
            ".scriptor/rename-txn-123/manifest.json"
        )));
        assert!(should_skip_backup_path(Path::new(
            ".scriptor/rename-txn-abc-def/file.md"
        )));
        assert!(should_skip_backup_path(Path::new(
            ".scriptor/rename-txn/manifest.json"
        )));
        assert!(!should_skip_backup_path(Path::new(".scriptor/config.json")));
    }

    #[test]
    fn interrupted_restore_in_promoting_state_rolls_back_cleanly() {
        let directory = tempfile::tempdir().expect("tempdir");
        let vault_root = directory.path();
        let journal = vault_root.join(".scriptor").join("restore-journal");
        let rollback = journal.join("rollback");
        fs::create_dir_all(&rollback).expect("create rollback");
        fs::write(vault_root.join("corrupt.md"), "corrupted partial content")
            .expect("write corrupt");
        fs::write(rollback.join("original.md"), "# Original Note\n").expect("write original");
        fs::write(journal.join("state"), "promoting").expect("write state");
        recover_interrupted_restore(vault_root).expect("recover interrupted restore");
        assert!(vault_root.join("original.md").exists());
        assert!(!vault_root.join("corrupt.md").exists());
        assert!(!journal.exists());
    }

    #[test]
    fn interrupted_restore_missing_rollback_preserves_journal() {
        let directory = tempfile::tempdir().expect("tempdir");
        let journal = directory.path().join(".scriptor").join("restore-journal");
        fs::create_dir_all(&journal).expect("journal");
        fs::write(journal.join("state"), "promoting").expect("state");
        assert!(recover_interrupted_restore(directory.path()).is_err());
        assert!(
            journal.exists(),
            "failed recovery must preserve evidence/rollback state"
        );
    }

    #[test]
    fn unrecognized_restore_state_is_preserved() {
        let directory = tempfile::tempdir().expect("tempdir");
        let journal = directory.path().join(".scriptor").join("restore-journal");
        fs::create_dir_all(&journal).expect("journal");
        fs::write(journal.join("state"), "future-state").expect("state");
        assert!(recover_interrupted_restore(directory.path()).is_err());
        assert!(journal.exists());
    }

    #[test]
    fn complete_restore_journal_is_safe_to_finalize_on_restart() {
        let directory = tempfile::tempdir().expect("tempdir");
        let journal = directory.path().join(".scriptor").join("restore-journal");
        fs::create_dir_all(&journal).expect("journal");
        fs::write(journal.join("state"), "complete").expect("state");
        recover_interrupted_restore(directory.path()).expect("cleanup complete journal");
        assert!(!journal.exists());
    }

    #[test]
    fn interrupted_restore_in_preparing_state_cleans_journal_and_leaves_vault() {
        let directory = tempfile::tempdir().expect("tempdir");
        let vault_root = directory.path();
        let journal = vault_root.join(".scriptor").join("restore-journal");
        let staged = journal.join("staged");
        fs::create_dir_all(&staged).expect("create staged");
        fs::write(vault_root.join("healthy.md"), "# Healthy Note\n").expect("write healthy");
        fs::write(staged.join("staged.md"), "# Staged Note\n").expect("write staged");
        fs::write(journal.join("state"), "preparing").expect("write state");
        recover_interrupted_restore(vault_root).expect("recover interrupted restore");
        assert!(vault_root.join("healthy.md").exists());
        assert!(!journal.exists());
    }

    #[test]
    fn failed_replacement_without_promotion_is_rolled_back() {
        let directory = tempfile::tempdir().expect("tempdir");
        let journal = directory.path().join(".scriptor").join("restore-journal");
        fs::create_dir_all(&journal).expect("journal");

        let outcome = finalize_restore(
            Err("Restore failed and was rolled back: boom".to_string()),
            &journal,
            Some("preparing".to_string()),
            Ok(()),
            "vault-backup-a1b2c3d4e5f6-20260712-120000-42",
            "/source/vault",
        );

        assert_eq!(outcome.status, VaultRestoreStatus::RolledBack);
        assert!(outcome.message.contains("rolled back"));
        assert!(
            journal.exists(),
            "the rollback journal must survive a failed replacement"
        );
    }

    #[test]
    fn failed_replacement_after_promotion_requires_recovery() {
        let directory = tempfile::tempdir().expect("tempdir");
        let journal = directory.path().join(".scriptor").join("restore-journal");
        fs::create_dir_all(&journal).expect("journal");

        let outcome = finalize_restore(
            Err("failed to write completion marker: disk full".to_string()),
            &journal,
            Some(RESTORE_STATE_PROMOTING.to_string()),
            Ok(()),
            "vault-backup-a1b2c3d4e5f6-20260712-120000-42",
            "/source/vault",
        );

        assert_eq!(
            outcome.status,
            VaultRestoreStatus::RecoveryRequired,
            "a failure after promotion already replaced the vault content, so resuming the \
             superseded draft would overwrite it"
        );
        assert!(
            journal.exists(),
            "the journal is the only record of what was replaced"
        );
        assert!(outcome.message.contains("completion marker"));
    }

    #[test]
    fn failed_replacement_with_unavailable_journal_state_requires_recovery() {
        let directory = tempfile::tempdir().expect("tempdir");
        let journal = directory.path().join(".scriptor").join("restore-journal");
        fs::create_dir_all(&journal).expect("journal");

        let outcome = finalize_restore(
            Err("restore transaction failed".to_string()),
            &journal,
            None,
            Ok(()),
            "vault-backup-a1b2c3d4e5f6-20260712-120000-42",
            "/source/vault",
        );

        assert_eq!(outcome.status, VaultRestoreStatus::RecoveryRequired);
    }

    #[test]
    fn successful_rollback_terminal_state_is_resumable() {
        let directory = tempfile::tempdir().expect("tempdir");
        let transaction = directory.path().join("restore-journal");

        let outcome = finalize_restore(
            Err("promotion failed, rollback succeeded".to_string()),
            &transaction,
            Some(RESTORE_STATE_ROLLED_BACK.to_string()),
            Ok(()),
            "vault-backup-a1b2c3d4e5f6-20260712-120000-42",
            "/source/vault",
        );

        assert_eq!(outcome.status, VaultRestoreStatus::RolledBack);
        assert!(should_attempt_restore_reopen(
            &Err("promotion failed".to_string()),
            Some(RESTORE_STATE_ROLLED_BACK),
        ));
    }

    #[test]
    fn unresolved_restore_failure_skips_normal_reopen() {
        assert!(!should_attempt_restore_reopen(
            &Err("promotion failed".to_string()),
            Some(RESTORE_STATE_PROMOTING),
        ));
        assert!(!should_attempt_restore_reopen(
            &Err("journal unreadable".to_string()),
            None,
        ));
        assert!(!should_attempt_restore_reopen(
            &Err("future state".to_string()),
            Some("future-state"),
        ));
    }

    #[test]
    fn restore_state_writer_persists_terminal_marker() {
        let directory = tempfile::tempdir().expect("tempdir");
        write_restore_state(directory.path(), RESTORE_STATE_ROLLED_BACK)
            .expect("write restore state");
        assert_eq!(
            fs::read_to_string(directory.path().join("state"))
                .expect("read state")
                .trim(),
            RESTORE_STATE_ROLLED_BACK
        );
    }

    #[test]
    fn restore_status_wire_format_matches_the_frontend_union() {
        // The frontend mirrors these as a literal TypeScript union and switches
        // on them, so a rename on either side must fail here rather than at
        // runtime as an unhandled status.
        assert_eq!(
            serde_json::to_string(&VaultRestoreStatus::RolledBack).unwrap(),
            "\"rolled-back\""
        );
        assert_eq!(
            serde_json::to_string(&VaultRestoreStatus::RecoveryRequired).unwrap(),
            "\"recovery-required\""
        );
        assert_eq!(
            serde_json::to_string(&VaultRestoreStatus::CommittedNeedsReopen).unwrap(),
            "\"committed-needs-reopen\""
        );
        assert_eq!(
            serde_json::to_string(&VaultRestoreStatus::CommittedReady).unwrap(),
            "\"committed-ready\""
        );
    }

    #[test]
    fn only_rolled_back_is_a_resumable_status() {
        // The hook resumes editor persistence for exactly one status, so every
        // other variant must compare unequal to it however the check is written.
        assert_eq!(
            VaultRestoreStatus::RolledBack,
            VaultRestoreStatus::RolledBack
        );
        assert_ne!(
            VaultRestoreStatus::RecoveryRequired,
            VaultRestoreStatus::RolledBack
        );
        assert_ne!(
            VaultRestoreStatus::CommittedNeedsReopen,
            VaultRestoreStatus::RolledBack
        );
        assert_ne!(
            VaultRestoreStatus::CommittedReady,
            VaultRestoreStatus::RolledBack
        );
    }

    #[test]
    fn committed_replacement_drops_journal_only_after_successful_reopen() {
        let directory = tempfile::tempdir().expect("tempdir");
        let journal = directory.path().join(".scriptor").join("restore-journal");
        fs::create_dir_all(&journal).expect("journal");

        let outcome = finalize_restore(
            Ok(()),
            &journal,
            Some("complete".to_string()),
            Ok(()),
            "vault-backup-a1b2c3d4e5f6-20260712-120000-42",
            "/source/vault",
        );

        assert_eq!(outcome.status, VaultRestoreStatus::CommittedReady);
        assert!(
            !journal.exists(),
            "the journal is dropped only once the new session is established"
        );
    }

    #[test]
    fn committed_replacement_survives_failed_reopen_without_looking_aborted() {
        let directory = tempfile::tempdir().expect("tempdir");
        let journal = directory.path().join(".scriptor").join("restore-journal");
        fs::create_dir_all(&journal).expect("journal");

        let outcome = finalize_restore(
            Ok(()),
            &journal,
            Some("complete".to_string()),
            Err("vault is not a valid Scriptor vault".to_string()),
            "vault-backup-a1b2c3d4e5f6-20260712-120000-42",
            "/source/vault",
        );

        assert_eq!(
            outcome.status,
            VaultRestoreStatus::CommittedNeedsReopen,
            "a committed restore must never be reported as aborted"
        );
        assert!(
            journal.exists(),
            "the rollback journal must survive a failed reopen"
        );
        assert!(outcome.message.contains("could not be reopened"));
    }
}
