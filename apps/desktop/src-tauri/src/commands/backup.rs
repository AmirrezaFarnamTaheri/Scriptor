use std::fs;
use std::path::{Path, PathBuf};

use serde::Serialize;

use crate::state::{active_session, AppState};

#[derive(Serialize)]
pub struct VaultBackupEntry {
    pub name: String,
    pub path: String,
    pub created_at: String,
    pub size_bytes: u64,
}

fn backup_root(vault_root: &Path) -> PathBuf {
    vault_root.join(".scriptor").join("backups")
}

fn validate_default_root(backup_path: Option<String>) -> Result<(), String> {
    if backup_path.as_deref().is_some_and(|value| !value.trim().is_empty()) {
        return Err("Custom backup paths are disabled; backups are confined to the active vault".into());
    }
    Ok(())
}

fn validate_backup_name(name: &str) -> Result<(), String> {
    if !name.starts_with("vault-backup-")
        || name.len() > 64
        || !name.bytes().all(|byte| byte.is_ascii_alphanumeric() || byte == b'-')
    {
        return Err("Invalid backup identifier".into());
    }
    Ok(())
}

fn confined_backup_dir(root: &Path, name: &str) -> Result<PathBuf, String> {
    validate_backup_name(name)?;
    let canonical_root = fs::canonicalize(root).map_err(|error| format!("Invalid backup root: {error}"))?;
    let candidate = canonical_root.join(name);
    let metadata = fs::symlink_metadata(&candidate)
        .map_err(|_| format!("Backup not found: {name}"))?;
    if metadata.file_type().is_symlink() || !metadata.is_dir() {
        return Err("Backup identifier does not reference a regular directory".into());
    }
    let canonical = fs::canonicalize(&candidate).map_err(|error| format!("Invalid backup: {error}"))?;
    if canonical.parent() != Some(canonical_root.as_path()) {
        return Err("Backup escapes the configured backup root".into());
    }
    Ok(canonical)
}

fn copy_tree(src: &Path, dst: &Path) -> Result<(), String> {
    let metadata = fs::symlink_metadata(src).map_err(|error| error.to_string())?;
    if metadata.file_type().is_symlink() {
        return Err(format!("Symlinks are not permitted in backups: {}", src.display()));
    }
    fs::create_dir_all(dst).map_err(|error| error.to_string())?;
    for entry in fs::read_dir(src).map_err(|error| error.to_string())? {
        let entry = entry.map_err(|error| error.to_string())?;
        let name = entry.file_name();
        if name == ".scriptor" || name == ".git" {
            continue;
        }
        let file_type = entry.file_type().map_err(|error| error.to_string())?;
        if file_type.is_symlink() {
            return Err(format!("Symlinks are not permitted in backups: {}", entry.path().display()));
        }
        let target = dst.join(&name);
        if file_type.is_dir() {
            copy_tree(&entry.path(), &target)?;
        } else if file_type.is_file() {
            fs::copy(entry.path(), target).map_err(|error| error.to_string())?;
        }
    }
    Ok(())
}

fn clear_vault_content(root: &Path) -> Result<(), String> {
    for entry in fs::read_dir(root).map_err(|error| error.to_string())? {
        let entry = entry.map_err(|error| error.to_string())?;
        let name = entry.file_name();
        if name == ".scriptor" || name == ".git" {
            continue;
        }
        let file_type = entry.file_type().map_err(|error| error.to_string())?;
        if file_type.is_symlink() {
            return Err(format!("Refusing to remove symlink during restore: {}", entry.path().display()));
        }
        if file_type.is_dir() {
            fs::remove_dir_all(entry.path()).map_err(|error| error.to_string())?;
        } else if file_type.is_file() {
            fs::remove_file(entry.path()).map_err(|error| error.to_string())?;
        }
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

#[tauri::command]
pub fn vault_create_backup(
    state: tauri::State<AppState>,
    backup_path: Option<String>,
) -> Result<VaultBackupEntry, String> {
    validate_default_root(backup_path)?;
    let session = active_session(&state)?;
    let vault_root = session.root.root();
    let root = backup_root(vault_root);
    fs::create_dir_all(&root).map_err(|error| error.to_string())?;

    let timestamp = chrono::Local::now().format("%Y%m%d-%H%M%S");
    let name = format!("vault-backup-{timestamp}-{}", std::process::id());
    let destination = root.join(&name);
    fs::create_dir(&destination).map_err(|error| error.to_string())?;
    if let Err(error) = copy_tree(vault_root, &destination) {
        let _ = fs::remove_dir_all(&destination);
        return Err(format!("Backup creation failed: {error}"));
    }

    Ok(VaultBackupEntry {
        name,
        path: destination.display().to_string(),
        created_at: chrono::Local::now().to_rfc3339(),
        size_bytes: dir_size(&destination)?,
    })
}

#[tauri::command]
pub fn vault_list_backups(
    state: tauri::State<AppState>,
    backup_path: Option<String>,
) -> Result<Vec<VaultBackupEntry>, String> {
    validate_default_root(backup_path)?;
    let session = active_session(&state)?;
    let root = backup_root(session.root.root());
    if !root.exists() {
        return Ok(Vec::new());
    }
    let mut backups = Vec::new();
    for entry in fs::read_dir(&root).map_err(|error| error.to_string())? {
        let entry = entry.map_err(|error| error.to_string())?;
        let name = entry.file_name().to_string_lossy().into_owned();
        if validate_backup_name(&name).is_err() || !entry.file_type().map_err(|error| error.to_string())?.is_dir() {
            continue;
        }
        let path = confined_backup_dir(&root, &name)?;
        let created_at = entry
            .metadata()
            .and_then(|metadata| metadata.modified())
            .map(|time| chrono::DateTime::<chrono::Local>::from(time).to_rfc3339())
            .unwrap_or_default();
        backups.push(VaultBackupEntry {
            name,
            path: path.display().to_string(),
            created_at,
            size_bytes: dir_size(&path)?,
        });
    }
    backups.sort_by(|left, right| right.name.cmp(&left.name));
    Ok(backups)
}

#[tauri::command]
pub fn vault_delete_backup(
    state: tauri::State<AppState>,
    backup_name: String,
    backup_path: Option<String>,
) -> Result<(), String> {
    validate_default_root(backup_path)?;
    let session = active_session(&state)?;
    let root = backup_root(session.root.root());
    let backup = confined_backup_dir(&root, &backup_name)?;
    fs::remove_dir_all(backup).map_err(|error| format!("Failed to delete backup: {error}"))
}

#[tauri::command]
pub fn vault_restore_backup(
    state: tauri::State<AppState>,
    backup_name: String,
    backup_path: Option<String>,
) -> Result<String, String> {
    validate_default_root(backup_path)?;
    let session = active_session(&state)?;
    let vault_root = session.root.root();
    let root = backup_root(vault_root);
    let source = confined_backup_dir(&root, &backup_name)?;

    let transaction = root.join(format!(".restore-{}-{}", chrono::Utc::now().timestamp_millis(), std::process::id()));
    let staged = transaction.join("staged");
    let rollback = transaction.join("rollback");
    fs::create_dir_all(&transaction).map_err(|error| error.to_string())?;

    let result = (|| {
        copy_tree(&source, &staged)?;
        copy_tree(vault_root, &rollback)?;
        clear_vault_content(vault_root)?;
        if let Err(promote_error) = copy_tree(&staged, vault_root) {
            let rollback_result = clear_vault_content(vault_root).and_then(|_| copy_tree(&rollback, vault_root));
            return match rollback_result {
                Ok(()) => Err(format!("Restore failed and was rolled back: {promote_error}")),
                Err(rollback_error) => Err(format!("Restore failed ({promote_error}); rollback also failed ({rollback_error})")),
            };
        }
        Ok(())
    })();

    let _ = fs::remove_dir_all(&transaction);
    result?;
    Ok(format!("Restored vault from {backup_name}; rebuild the index before continuing"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn backup_names_are_opaque() {
        assert!(validate_backup_name("vault-backup-20260712-120000-42").is_ok());
        assert!(validate_backup_name("../outside").is_err());
        assert!(validate_backup_name("vault-backup-a/b").is_err());
        assert!(validate_backup_name("C:\\outside").is_err());
    }
}
