use std::path::{Path, PathBuf};

use crate::error::BridgeError;

pub fn scriptor_data_dir(app_name: &str) -> Result<PathBuf, BridgeError> {
    let base = if cfg!(windows) {
        std::env::var("APPDATA")
            .map(PathBuf::from)
            .or_else(|_| std::env::var("USERPROFILE").map(PathBuf::from))
            .map_err(|_| BridgeError::Unsupported("could not resolve Windows app data directory".into()))?
    } else if cfg!(target_os = "macos") {
        std::env::var("HOME")
            .map(|home| PathBuf::from(home).join("Library/Application Support"))
            .map_err(|_| BridgeError::Unsupported("could not resolve macOS app data directory".into()))?
    } else {
        std::env::var("XDG_DATA_HOME")
            .map(PathBuf::from)
            .or_else(|_| {
                std::env::var("HOME")
                    .map(|home| PathBuf::from(home).join(".local/share"))
                    .map_err(|_| BridgeError::Unsupported("could not resolve Linux data directory".into()))
            })?
    };

    let dir = base.join(app_name);
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
