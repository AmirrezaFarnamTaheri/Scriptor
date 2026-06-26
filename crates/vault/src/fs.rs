use std::fs;
use std::io::Write;
use std::path::Path;

use crate::error::VaultError;

/// Write `bytes` to `path` atomically: temp file in the target directory, fsync, rename.
pub fn atomic_write(path: &Path, bytes: &[u8]) -> Result<(), VaultError> {
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

    if let Some(parent) = path.parent() {
        if let Ok(file) = fs::OpenOptions::new().read(true).open(parent) {
            let _ = file.sync_all();
        }
    }

    Ok(())
}
