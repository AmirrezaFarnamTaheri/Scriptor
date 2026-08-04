use std::collections::BTreeSet;
use std::fs;
use std::io::{Read, Write};
use std::path::{Component, Path, PathBuf};

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

use crate::authorization::{SensitiveOperation, require_sensitive_operation};
use crate::state::{AppState, active_session};

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
    let canonical = fs::canonicalize(&configured)
        .map_err(|error| format!("Invalid backup root: {error}"))?;
    let canonical_vault = fs::canonicalize(vault_root)
        .map_err(|error| format!("Invalid vault root: {error}"))?;
    if canonical.starts_with(&canonical_vault) || canonical_vault.starts_with(&canonical) {
        return Err(
            "Disaster-recovery backups must not be stored inside or above the active vault".into(),
        );
    }

    // Stable external root: backups remain discoverable after the vault moves to
    // a different machine or absolute path. Each backup name contains a source
    // fingerprint, while its integrity manifest carries the original path and content digest.
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
    let metadata = fs::symlink_metadata(&candidate)
        .map_err(|_| format!("Backup not found: {name}"))?;
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
        Some(".scriptor") => matches!(
            components.next(),
            Some(
                "snapshots"
                    | "cache"
                    | "exports"
                    | "diagnostics"
                    | "audit"
                    | "tmp"
                    | "restore-journal"
                    | "rename-txn"
                    | "recovery"
            )
        ),
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
            for metadata_entry in
                fs::read_dir(entry.path()).map_err(|error| error.to_string())?
            {
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
            total += entry
                .metadata()
                .map_err(|error| error.to_string())?
                .len();
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
    let scope = backup_path
        .as_deref()
        .filter(|value| !value.trim().is_empty())
        .unwrap_or("local-snapshot");
    require_sensitive_operation(
        &state,
        &authorization_token,
        SensitiveOperation::CreateBackup,
        Some(scope),
    )?;
    let session = active_session(&state)?;
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

#[tauri::command]
pub fn vault_list_backups(
    state: tauri::State<AppState>,
    backup_path: Option<String>,
) -> Result<Vec<VaultBackupEntry>, String> {
    let session = active_session(&state)?;
    let (root, storage_kind) = backup_root(session.root.root(), backup_path.as_deref())?;
    if !root.exists() {
        return Ok(Vec::new());
    }
    let mut backups = Vec::new();
    for entry in fs::read_dir(&root).map_err(|error| error.to_string())? {
        let entry = entry.map_err(|error| error.to_string())?;
        let name = entry.file_name().to_string_lossy().into_owned();
        if validate_backup_name(&name).is_err()
            || !entry
                .file_type()
                .map_err(|error| error.to_string())?
                .is_dir()
        {
            continue;
        }
        let path = confined_backup_dir(&root, &name)?;
        backups.push(entry_from_dir(&path, storage_kind)?);
    }
    backups.sort_by(|left, right| right.name.cmp(&left.name));
    Ok(backups)
}

#[tauri::command]
pub fn vault_delete_backup(
    state: tauri::State<AppState>,
    backup_name: String,
    backup_path: Option<String>,
    authorization_token: String,
) -> Result<(), String> {
    require_sensitive_operation(
        &state,
        &authorization_token,
        SensitiveOperation::DeleteBackup,
        Some(&backup_name),
    )?;
    let session = active_session(&state)?;
    let (root, _) = backup_root(session.root.root(), backup_path.as_deref())?;
    fs::remove_dir_all(confined_backup_dir(&root, &backup_name)?)
        .map_err(|error| format!("Failed to delete backup: {error}"))
}

#[tauri::command]
pub fn vault_restore_backup(
    state: tauri::State<AppState>,
    backup_name: String,
    backup_path: Option<String>,
    authorization_token: String,
) -> Result<String, String> {
    require_sensitive_operation(
        &state,
        &authorization_token,
        SensitiveOperation::RestoreBackup,
        Some(&backup_name),
    )?;
    let session = active_session(&state)?;
    let vault_root = session.root.root();
    let (root, _) = backup_root(vault_root, backup_path.as_deref())?;
    let source = confined_backup_dir(&root, &backup_name)?;
    let manifest = read_and_verify_manifest(&source)?;

    let transaction = vault_root.join(".scriptor").join("restore-journal");
    if transaction.exists() {
        fs::remove_dir_all(&transaction).map_err(|error| error.to_string())?;
    }
    let staged = transaction.join("staged");
    let rollback = transaction.join("rollback");
    fs::create_dir_all(&transaction).map_err(|error| error.to_string())?;
    fs::write(transaction.join("state"), "preparing").map_err(|error| error.to_string())?;

    let result = (|| {
        let mut ignored = Vec::new();
        copy_tree(&source, &staged, Path::new(""), &mut ignored)?;
        let _ = fs::remove_file(staged.join(MANIFEST_FILE));
        ignored.clear();
        copy_tree(vault_root, &rollback, Path::new(""), &mut ignored)?;
        fs::write(transaction.join("state"), "promoting")
            .map_err(|error| error.to_string())?;
        clear_persistent_vault_content(vault_root)?;
        ignored.clear();
        if let Err(promote_error) = copy_tree(&staged, vault_root, Path::new(""), &mut ignored) {
            let rollback_result = clear_persistent_vault_content(vault_root).and_then(|_| {
                ignored.clear();
                copy_tree(&rollback, vault_root, Path::new(""), &mut ignored)
            });
            return match rollback_result {
                Ok(()) => Err(format!(
                    "Restore failed and was rolled back: {promote_error}"
                )),
                Err(rollback_error) => Err(format!(
                    "Restore failed ({promote_error}); rollback also failed ({rollback_error})"
                )),
            };
        }
        fs::write(transaction.join("state"), "complete")
            .map_err(|error| error.to_string())?;
        Ok(())
    })();

    if result.is_ok() {
        let _ = fs::remove_dir_all(&transaction);
    }
    result?;
    Ok(format!(
        "Restored and verified {backup_name} from {}; a full index rebuild is required",
        manifest.source_vault_root
    ))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn backup_names_are_opaque() {
        assert!(
            validate_backup_name("vault-backup-a1b2c3d4e5f6-20260712-120000-42").is_ok()
        );
        assert!(validate_backup_name("../outside").is_err());
        assert!(validate_backup_name("vault-backup-a/b").is_err());
        assert!(validate_backup_name("C:\\outside").is_err());
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
        assert_eq!(
            verified.source_vault_root,
            "/old-machine/original-vault"
        );
    }
}
