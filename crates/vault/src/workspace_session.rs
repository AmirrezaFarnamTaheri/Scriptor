use std::collections::HashSet;
use std::fs;
use std::io::Read;

use serde::{Deserialize, Serialize};

use crate::error::VaultError;
use crate::fs::{atomic_write, lock_vault_mutation};
use crate::path::{RelativeVaultPath, VaultRoot};

pub const DEFAULT_WORKSPACE_SESSION_PATH: &str = ".scriptor/workspace-session.json";
const MAX_SESSION_BYTES: usize = 1_048_576;
const MAX_SESSION_TABS: usize = 256;
const MAX_SESSION_COLLAPSED_FOLDERS: usize = 4096;
const MAX_SESSION_PATH_BYTES: usize = 2048;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct WorkspaceSessionTab {
    pub path: String,
    #[serde(default)]
    pub pinned: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct WorkspaceSession {
    pub version: u32,
    pub active_path: Option<String>,
    pub open_tabs: Vec<WorkspaceSessionTab>,
    #[serde(default)]
    pub collapsed_folders: std::collections::BTreeMap<String, bool>,
    #[serde(default)]
    pub sidebar_view: Option<String>,
}

impl Default for WorkspaceSession {
    fn default() -> Self {
        Self {
            version: 1,
            active_path: None,
            open_tabs: Vec::new(),
            collapsed_folders: std::collections::BTreeMap::new(),
            sidebar_view: None,
        }
    }
}

impl WorkspaceSession {
    /// Validate the existing v1 persistence contract without introducing an
    /// incompatible parallel dock/pane schema. The saved session is external
    /// data, even when loaded from the currently selected vault.
    fn validate(&self) -> Result<(), VaultError> {
        if self.version != 1 {
            return Err(VaultError::InvalidWorkspaceSession(format!(
                "unsupported version {}", self.version
            )));
        }
        if self.open_tabs.len() > MAX_SESSION_TABS {
            return Err(VaultError::InvalidWorkspaceSession(
                "too many open tabs".into(),
            ));
        }
        if self.collapsed_folders.len() > MAX_SESSION_COLLAPSED_FOLDERS {
            return Err(VaultError::InvalidWorkspaceSession(
                "too many folder states".into(),
            ));
        }
        let mut paths = HashSet::new();
        for tab in &self.open_tabs {
            check_session_path(&tab.path)?;
            if !paths.insert(tab.path.as_str()) {
                return Err(VaultError::InvalidWorkspaceSession(
                    "duplicate open tab".into(),
                ));
            }
        }
        if let Some(path) = &self.active_path {
            check_session_path(path)?;
        }
        if self
            .sidebar_view
            .as_ref()
            .is_some_and(|value| value.len() > 32 || value.chars().any(char::is_control))
        {
            return Err(VaultError::InvalidWorkspaceSession(
                "invalid sidebar view".into(),
            ));
        }
        for folder in self.collapsed_folders.keys() {
            // Folder labels are UI state, not file access. Limit them without
            // imposing filesystem normalization on historical folder keys.
            if folder.len() > MAX_SESSION_PATH_BYTES || folder.chars().any(char::is_control) {
                return Err(VaultError::InvalidWorkspaceSession(
                    "invalid folder state key".into(),
                ));
            }
        }
        Ok(())
    }
}

fn check_session_path(path: &str) -> Result<(), VaultError> {
    if path.len() > MAX_SESSION_PATH_BYTES {
        return Err(VaultError::InvalidWorkspaceSession("note path too long".into()));
    }
    let normalized = RelativeVaultPath::parse(path)?;
    if normalized.as_str() != path {
        return Err(VaultError::InvalidWorkspaceSession(
            "non-canonical note path".into(),
        ));
    }
    Ok(())
}

fn workspace_session_path(root: &VaultRoot) -> Result<std::path::PathBuf, VaultError> {
    RelativeVaultPath::parse(DEFAULT_WORKSPACE_SESSION_PATH)?.resolve(root)
}

pub fn read_workspace_session(root: &VaultRoot) -> Result<WorkspaceSession, VaultError> {
    let absolute = workspace_session_path(root)?;
    if !absolute.exists() {
        return Ok(WorkspaceSession::default());
    }
    // Bound the read itself, not just a subsequent JSON parse. Corrupt or
    // adversarial session files must not allocate unbounded memory on startup.
    let mut raw = Vec::new();
    fs::File::open(&absolute)
        .map_err(|source| VaultError::io(&absolute, source))?
        .take((MAX_SESSION_BYTES + 1) as u64)
        .read_to_end(&mut raw)
        .map_err(|source| VaultError::io(&absolute, source))?;
    if raw.len() > MAX_SESSION_BYTES {
        return Err(VaultError::InvalidWorkspaceSession("session file too large".into()));
    }
    let session: WorkspaceSession = serde_json::from_slice(&raw)?;
    session.validate()?;
    Ok(session)
}

pub fn write_workspace_session(
    root: &VaultRoot,
    session: &WorkspaceSession,
) -> Result<(), VaultError> {
    session.validate()?;
    // Reject a symlinked .scriptor directory before attempting persistence and
    // serialize this write against other vault writers.
    let _guard = lock_vault_mutation(root.root())?;
    let absolute = workspace_session_path(root)?;
    if let Some(parent) = absolute.parent() {
        fs::create_dir_all(parent).map_err(|source| VaultError::io(parent, source))?;
    }
    let payload = serde_json::to_vec_pretty(session)?;
    if payload.len() > MAX_SESSION_BYTES {
        return Err(VaultError::InvalidWorkspaceSession("session file too large".into()));
    }
    atomic_write(&absolute, &payload)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn workspace_session_roundtrip() {
        let dir = std::env::temp_dir().join(format!("scriptor-session-{}", uuid::Uuid::new_v4()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).expect("temp dir");
        let root = VaultRoot::open(&dir).expect("vault root");

        let session = WorkspaceSession {
            version: 1,
            active_path: Some("Research Plan.md".into()),
            open_tabs: vec![
                WorkspaceSessionTab {
                    path: "Research Plan.md".into(),
                    pinned: true,
                },
                WorkspaceSessionTab {
                    path: "Field Notes.md".into(),
                    pinned: false,
                },
            ],
            collapsed_folders: [("Vault".into(), true)].into_iter().collect(),
            sidebar_view: Some("vault".into()),
        };

        write_workspace_session(&root, &session).expect("write");
        let loaded = read_workspace_session(&root).expect("read");
        assert_eq!(loaded, session);

        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn rejects_unsafe_or_duplicated_tabs_without_overwriting_last_valid_session() {
        let dir = std::env::temp_dir().join(format!(
            "scriptor-session-validation-{}",
            uuid::Uuid::new_v4()
        ));
        fs::create_dir_all(&dir).expect("temp dir");
        let root = VaultRoot::open(&dir).expect("vault root");
        let valid = WorkspaceSession {
            open_tabs: vec![WorkspaceSessionTab {
                path: "notes/ok.md".into(),
                pinned: false,
            }],
            active_path: Some("notes/ok.md".into()),
            ..WorkspaceSession::default()
        };
        write_workspace_session(&root, &valid).expect("valid save");
        let session_path = root.root().join(DEFAULT_WORKSPACE_SESSION_PATH);
        let original = fs::read(&session_path).expect("read initial bytes");

        for path in [
            "../secret.md",
            "/tmp/secret.md",
            "notes/../../secret.md",
            "notes\\evil.md",
        ] {
            let mut malformed = valid.clone();
            malformed.open_tabs[0].path = path.to_string();
            assert!(write_workspace_session(&root, &malformed).is_err(), "{path}");
        }
        let mut duplicate = valid.clone();
        let duplicated = duplicate.open_tabs[0].clone();
        duplicate.open_tabs.push(duplicated);
        assert!(matches!(
            write_workspace_session(&root, &duplicate),
            Err(VaultError::InvalidWorkspaceSession(_))
        ));

        let mut wrong_version = valid.clone();
        wrong_version.version = 2;
        assert!(matches!(
            write_workspace_session(&root, &wrong_version),
            Err(VaultError::InvalidWorkspaceSession(_))
        ));
        let mut too_many = valid.clone();
        too_many.open_tabs = (0..=MAX_SESSION_TABS)
            .map(|index| WorkspaceSessionTab {
                path: format!("notes/{index}.md"),
                pinned: false,
            })
            .collect();
        assert!(write_workspace_session(&root, &too_many).is_err());

        assert_eq!(fs::read(&session_path).unwrap(), original);
        assert_eq!(read_workspace_session(&root).unwrap(), valid);
        fs::remove_dir_all(&dir).expect("cleanup");
    }

    #[cfg(unix)]
    #[test]
    fn session_storage_refuses_symlinked_internal_directory() {
        use std::os::unix::fs::symlink;

        let base = std::env::temp_dir().join(format!(
            "scriptor-session-symlink-{}",
            uuid::Uuid::new_v4()
        ));
        let vault = base.join("vault");
        let outside = base.join("outside");
        fs::create_dir_all(&vault).expect("vault directory");
        fs::create_dir_all(&outside).expect("outside directory");
        symlink(&outside, vault.join(".scriptor")).expect("symlink internal directory");
        let root = VaultRoot::open(&vault).expect("vault root");

        assert!(matches!(
            read_workspace_session(&root),
            Err(VaultError::SymlinkEscape(_))
        ));
        assert!(write_workspace_session(&root, &WorkspaceSession::default()).is_err());
        assert!(!outside.join("workspace-session.json").exists());
        fs::remove_dir_all(base).expect("cleanup");
    }

    #[test]
    fn rejects_unbounded_or_invalid_saved_session_without_mutation() {
        let dir = std::env::temp_dir().join(format!(
            "scriptor-session-bounds-{}",
            uuid::Uuid::new_v4()
        ));
        fs::create_dir_all(dir.join(".scriptor")).expect("temp dir");
        let root = VaultRoot::open(&dir).expect("vault root");
        let path = root.root().join(DEFAULT_WORKSPACE_SESSION_PATH);

        fs::write(&path, vec![b' '; MAX_SESSION_BYTES + 1]).expect("write oversized fixture");
        assert!(matches!(
            read_workspace_session(&root),
            Err(VaultError::InvalidWorkspaceSession(_))
        ));

        let mut invalid = WorkspaceSession::default();
        invalid.version = 99;
        let raw = serde_json::to_vec(&invalid).unwrap();
        fs::write(&path, &raw).expect("write bad version fixture");
        assert!(matches!(
            read_workspace_session(&root),
            Err(VaultError::InvalidWorkspaceSession(_))
        ));
        assert_eq!(fs::read(&path).unwrap(), raw);

        let valid = WorkspaceSession {
            active_path: Some("notes/valid.md".into()),
            open_tabs: vec![WorkspaceSessionTab {
                path: "notes/valid.md".into(),
                pinned: true,
            }],
            ..WorkspaceSession::default()
        };
        fs::write(&path, serde_json::to_vec(&valid).unwrap()).expect("write valid fixture");
        assert_eq!(read_workspace_session(&root).unwrap(), valid);
        fs::remove_dir_all(&dir).expect("cleanup");
    }
}
