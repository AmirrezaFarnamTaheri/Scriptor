use std::path::{Path, PathBuf};

use crate::error::BridgeError;

pub fn scriptor_data_dir(app_name: &str) -> Result<PathBuf, BridgeError> {
    let base = if cfg!(windows) {
        std::env::var("APPDATA")
            .map(PathBuf::from)
            .or_else(|_| std::env::var("USERPROFILE").map(PathBuf::from))
            .map_err(|_| {
                BridgeError::Unsupported("could not resolve Windows app data directory".into())
            })?
    } else if cfg!(target_os = "macos") {
        std::env::var("HOME")
            .map(|home| PathBuf::from(home).join("Library/Application Support"))
            .map_err(|_| {
                BridgeError::Unsupported("could not resolve macOS app data directory".into())
            })?
    } else {
        std::env::var("XDG_DATA_HOME")
            .map(PathBuf::from)
            .or_else(|_| {
                std::env::var("HOME")
                    .map(|home| PathBuf::from(home).join(".local/share"))
                    .map_err(|_| {
                        BridgeError::Unsupported("could not resolve Linux data directory".into())
                    })
            })?
    };

    let dir = base.join(app_name);
    #[cfg(unix)]
    {
        use std::os::unix::fs::{DirBuilderExt, PermissionsExt};
        // This contains daemon socket discovery and other private application data.
        // Do not create it as 0755 and then attempt to tighten permissions.
        std::fs::DirBuilder::new()
            .recursive(true)
            .mode(0o700)
            .create(&dir)
            .map_err(|source| BridgeError::Io {
                path: dir.clone(),
                source,
            })?;
        let metadata = std::fs::symlink_metadata(&dir).map_err(|source| BridgeError::Io {
            path: dir.clone(),
            source,
        })?;
        if !metadata.file_type().is_dir() {
            return Err(BridgeError::Unsupported(
                "application data directory must be a real directory".into(),
            ));
        }
        // Repair an existing, older directory before the daemon creates its socket.
        std::fs::set_permissions(&dir, std::fs::Permissions::from_mode(0o700)).map_err(
            |source| BridgeError::Io {
                path: dir.clone(),
                source,
            },
        )?;
    }
    #[cfg(not(unix))]
    std::fs::create_dir_all(&dir).map_err(|source| BridgeError::Io {
        path: dir.clone(),
        source,
    })?;
    Ok(dir)
}

pub fn vault_scriptor_meta_dir(vault_root: &Path) -> PathBuf {
    vault_root.join(".scriptor")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn vault_scriptor_dir_is_relative() {
        let expected = Path::new("/vault").join(".scriptor");
        assert_eq!(vault_scriptor_meta_dir(Path::new("/vault")), expected);
    }
}
