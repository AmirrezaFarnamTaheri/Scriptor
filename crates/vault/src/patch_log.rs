use std::fs;
use std::path::Path;

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

use crate::error::VaultError;
use crate::path::VaultRoot;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct RenamePatchLog {
    pub patch_id: String,
    pub from_path: String,
    pub to_path: String,
    pub created_at: String,
    pub backups: Vec<RenameBackupEntry>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct RenameBackupEntry {
    pub path: String,
    pub backup_path: String,
}

pub fn write_rename_patch_log(
    root: &VaultRoot,
    from_path: &str,
    to_path: &str,
    backups: Vec<(String, String)>,
) -> Result<RenamePatchLog, VaultError> {
    let patch_id = uuid::Uuid::new_v4().to_string();
    let log = RenamePatchLog {
        patch_id: patch_id.clone(),
        from_path: from_path.to_string(),
        to_path: to_path.to_string(),
        created_at: chrono::Utc::now().to_rfc3339(),
        backups: backups
            .into_iter()
            .map(|(path, backup_path)| RenameBackupEntry { path, backup_path })
            .collect(),
    };
    let dir = root.root().join(".scriptor").join("patches");
    fs::create_dir_all(&dir).map_err(|source| VaultError::io(&dir, source))?;
    let file = dir.join(format!("rename-{patch_id}.json"));
    let payload = serde_json::to_string_pretty(&log).map_err(VaultError::from)?;
    fs::write(&file, payload).map_err(|source| VaultError::io(&file, source))?;
    Ok(log)
}

pub fn backup_note_content(root: &VaultRoot, absolute: &Path, relative_path: &str) -> Result<String, VaultError> {
    if !absolute.is_file() {
        return Ok(String::new());
    }
    let content = fs::read_to_string(absolute).map_err(|source| VaultError::io(absolute, source))?;
    let digest = Sha256::digest(relative_path.as_bytes());
    let name = format!("{}.md", hex::encode(&digest[..8]));
    let backup_dir = root.root().join(".scriptor").join("recovery").join("rename");
    fs::create_dir_all(&backup_dir).map_err(|source| VaultError::io(&backup_dir, source))?;
    let backup_path = backup_dir.join(name);
    fs::write(&backup_path, &content).map_err(|source| VaultError::io(&backup_path, source))?;
    Ok(backup_path
        .strip_prefix(root.root())
        .map(|path| path.to_string_lossy().replace('\\', "/"))
        .unwrap_or_else(|_| backup_path.display().to_string()))
}

pub fn collect_rename_backups(
    root: &VaultRoot,
    paths: &[String],
) -> Result<Vec<(String, String)>, VaultError> {
    let mut backups = Vec::new();
    for path in paths {
        let relative = crate::path::RelativeVaultPath::parse(path)?;
        let absolute = root.resolve_relative(&relative)?;
        if absolute.is_file() {
            let backup = backup_note_content(root, &absolute, path)?;
            if !backup.is_empty() {
                backups.push((path.clone(), backup));
            }
        }
    }
    Ok(backups)
}
