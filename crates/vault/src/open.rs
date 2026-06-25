use std::path::Path;

use chrono::Utc;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::error::VaultError;
use crate::path::VaultRoot;
use crate::rename_transaction::recover_pending_rename_transactions;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct VaultDescriptor {
    pub id: String,
    pub name: String,
    pub root_path: String,
    pub opened_at: String,
    pub status: VaultStatus,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum VaultStatus {
    Ready,
    Scanning,
    Degraded,
}

#[derive(Debug, Clone)]
pub struct VaultSession {
    pub descriptor: VaultDescriptor,
    pub root: VaultRoot,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct OpenVaultOutput {
    pub vault: VaultDescriptor,
    pub scan_job_id: String,
}

pub fn open_vault(root_path: impl AsRef<Path>) -> Result<VaultSession, VaultError> {
    let root = VaultRoot::open(root_path.as_ref())?;
    recover_pending_rename_transactions(&root)?;
    let name = root_path
        .as_ref()
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or("vault")
        .to_string();

    let descriptor = VaultDescriptor {
        id: Uuid::new_v4().to_string(),
        name,
        root_path: root.root().display().to_string(),
        opened_at: Utc::now().to_rfc3339(),
        status: VaultStatus::Ready,
    };

    Ok(VaultSession { descriptor, root })
}

pub fn open_vault_output(session: &VaultSession) -> OpenVaultOutput {
    OpenVaultOutput {
        vault: session.descriptor.clone(),
        scan_job_id: Uuid::new_v4().to_string(),
    }
}
