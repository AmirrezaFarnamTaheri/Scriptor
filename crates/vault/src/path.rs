use std::path::{Component, Path, PathBuf};

use crate::error::VaultError;

#[derive(Debug, Clone, PartialEq, Eq, Hash, serde::Serialize, serde::Deserialize)]
#[serde(transparent)]
pub struct RelativeVaultPath(String);

impl RelativeVaultPath {
    pub fn parse(raw: &str) -> Result<Self, VaultError> {
        let normalized = normalize_relative(raw)?;
        Ok(Self(normalized))
    }

    pub fn as_str(&self) -> &str {
        &self.0
    }

    pub fn resolve<'a>(&self, root: &'a VaultRoot) -> Result<PathBuf, VaultError> {
        root.resolve_relative(self)
    }
}

impl std::fmt::Display for RelativeVaultPath {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(&self.0)
    }
}

#[derive(Debug, Clone)]
pub struct VaultRoot {
    root: PathBuf,
}

impl VaultRoot {
    pub fn open(path: impl AsRef<Path>) -> Result<Self, VaultError> {
        let path = path.as_ref();
        if !path.exists() {
            return Err(VaultError::RootMissing(path.to_path_buf()));
        }
        if !path.is_dir() {
            return Err(VaultError::RootNotDirectory(path.to_path_buf()));
        }

        let canonical = path
            .canonicalize()
            .map_err(|source| VaultError::io(path, source))?;

        Ok(Self { root: canonical })
    }

    pub fn root(&self) -> &Path {
        &self.root
    }

    pub fn relative_path(&self, absolute: &Path) -> Result<RelativeVaultPath, VaultError> {
        let canonical = absolute
            .canonicalize()
            .map_err(|source| VaultError::io(absolute, source))?;

        if !canonical.starts_with(&self.root) {
            return Err(VaultError::PathEscape(format_path(&canonical)));
        }

        let relative = canonical
            .strip_prefix(&self.root)
            .map_err(|_| VaultError::PathEscape(format_path(&canonical)))?;

        if relative.as_os_str().is_empty() {
            return Err(VaultError::InvalidRelativePath(".".into()));
        }

        RelativeVaultPath::parse(&format_path(relative))
    }

    pub fn resolve_relative(&self, relative: &RelativeVaultPath) -> Result<PathBuf, VaultError> {
        let candidate = self.root.join(relative.as_str().replace('/', std::path::MAIN_SEPARATOR_STR));
        let normalized = normalize_components(&candidate);

        if !normalized.starts_with(&self.root) {
            return Err(VaultError::PathEscape(relative.to_string()));
        }

        if candidate.exists() {
            let canonical = candidate
                .canonicalize()
                .map_err(|source| VaultError::io(&candidate, source))?;
            if !canonical.starts_with(&self.root) {
                return Err(VaultError::SymlinkEscape(relative.to_string()));
            }
            return Ok(canonical);
        }

        Ok(normalized)
    }
}

pub fn normalize_relative(raw: &str) -> Result<String, VaultError> {
    if raw.is_empty() {
        return Err(VaultError::InvalidRelativePath(raw.into()));
    }

    if raw.contains('\\') {
        return Err(VaultError::InvalidRelativePath(raw.into()));
    }

    if raw.starts_with('/') || raw.starts_with('\\') {
        return Err(VaultError::InvalidRelativePath(raw.into()));
    }

    if Path::new(raw).is_absolute() {
        return Err(VaultError::InvalidRelativePath(raw.into()));
    }

    let mut parts = Vec::new();
    for component in Path::new(raw).components() {
        match component {
            Component::Normal(part) => {
                let part = part.to_string_lossy();
                if part == "." || part.is_empty() {
                    continue;
                }
                if part == ".." {
                    return Err(VaultError::PathEscape(raw.into()));
                }
                parts.push(part.into_owned());
            }
            Component::ParentDir => return Err(VaultError::PathEscape(raw.into())),
            Component::RootDir | Component::Prefix(_) => {
                return Err(VaultError::InvalidRelativePath(raw.into()));
            }
            Component::CurDir => {}
        }
    }

    if parts.is_empty() {
        return Err(VaultError::InvalidRelativePath(raw.into()));
    }

    Ok(parts.join("/"))
}

fn normalize_components(path: &Path) -> PathBuf {
    let mut output = PathBuf::new();
    for component in path.components() {
        match component {
            Component::ParentDir => {
                output.pop();
            }
            Component::CurDir => {}
            Component::Normal(part) => output.push(part),
            Component::RootDir => {
                if output.as_os_str().is_empty() {
                    output.push(std::path::MAIN_SEPARATOR_STR);
                }
            }
            Component::Prefix(prefix) => output.push(prefix.as_os_str()),
        }
    }
    output
}

fn format_path(path: &Path) -> String {
    path.components()
        .filter_map(|component| match component {
            Component::Normal(part) => Some(part.to_string_lossy().into_owned()),
            _ => None,
        })
        .collect::<Vec<_>>()
        .join("/")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_parent_segments() {
        assert!(RelativeVaultPath::parse("../secret").is_err());
        assert!(RelativeVaultPath::parse("notes/../../secret").is_err());
    }

    #[test]
    fn normalizes_nested_paths() {
        let path = RelativeVaultPath::parse("notes/./Research Plan.md").unwrap();
        assert_eq!(path.as_str(), "notes/Research Plan.md");
    }

    #[test]
    fn rejects_symlink_escape() {
        let vault_dir = tempfile::tempdir().unwrap();
        let outside_dir = tempfile::tempdir().unwrap();
        let secret = outside_dir.path().join("secret.md");
        std::fs::write(&secret, "# secret").unwrap();
        let link = vault_dir.path().join("escape.md");
        let linked = {
            #[cfg(unix)]
            {
                std::os::unix::fs::symlink(&secret, &link)
            }
            #[cfg(windows)]
            {
                std::os::windows::fs::symlink_file(&secret, &link)
            }
        };
        if linked.is_err() {
            // Symlink creation may require elevated privileges on Windows.
            return;
        }

        let root = VaultRoot::open(vault_dir.path()).unwrap();
        let relative = RelativeVaultPath::parse("escape.md").unwrap();
        let result = root.resolve_relative(&relative);
        assert!(matches!(result, Err(VaultError::SymlinkEscape(_))));
    }
}
