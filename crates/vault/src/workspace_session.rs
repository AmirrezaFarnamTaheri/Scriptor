use std::fs;

use serde::{Deserialize, Serialize};

use crate::error::VaultError;
use crate::fs::atomic_write;
use crate::path::VaultRoot;

pub const DEFAULT_WORKSPACE_SESSION_PATH: &str = ".scriptor/workspace-session.json";

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

pub fn read_workspace_session(root: &VaultRoot) -> Result<WorkspaceSession, VaultError> {
    let absolute = root.root().join(DEFAULT_WORKSPACE_SESSION_PATH);
    if !absolute.exists() {
        return Ok(WorkspaceSession::default());
    }
    let raw = fs::read_to_string(&absolute).map_err(|source| VaultError::io(&absolute, source))?;
    serde_json::from_str(&raw).map_err(VaultError::from)
}

pub fn write_workspace_session(
    root: &VaultRoot,
    session: &WorkspaceSession,
) -> Result<(), VaultError> {
    let absolute = root.root().join(DEFAULT_WORKSPACE_SESSION_PATH);
    if let Some(parent) = absolute.parent() {
        fs::create_dir_all(parent).map_err(|source| VaultError::io(parent, source))?;
    }
    let payload = serde_json::to_string_pretty(session).map_err(VaultError::from)?;
    atomic_write(&absolute, payload.as_bytes())
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
}
