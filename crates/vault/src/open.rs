use std::path::Path;
use std::time::Duration;

use chrono::Utc;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::error::VaultError;
use crate::fs::cleanup_stale_temp_files;
use crate::path::VaultRoot;
use crate::rename_transaction::recover_pending_rename_transactions;

/// Max age before an orphaned atomic-write temp file is considered safe to remove.
/// Keeps a wide margin so concurrent writes are never disturbed.
const STALE_TEMP_MAX_AGE: Duration = Duration::from_secs(60 * 60 * 24);

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
    pub pending_reindex_paths: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct OpenVaultOutput {
    pub vault: VaultDescriptor,
    pub scan_job_id: String,
}

/// Opens a vault at the given path, recovering any pending rename transactions
/// and sweeping stale atomic-write temp files left behind by crashes.
pub fn open_vault(root_path: impl AsRef<Path>) -> Result<VaultSession, VaultError> {
    let root = VaultRoot::open(root_path.as_ref())?;
    let recovery = recover_pending_rename_transactions(&root)?;

    // Best-effort: reclaim orphaned temp files from interrupted writes. We only
    // surface the count via tracing so operators can see it; a failure here must
    // never block opening a vault.
    match cleanup_stale_temp_files(root.root(), STALE_TEMP_MAX_AGE) {
        Ok(removed) if removed > 0 => {
            tracing::info!(
                target: "scriptor_vault::open",
                removed,
                "swept stale atomic-write temp files on vault open"
            );
        }
        Ok(_) => {}
        Err(error) => {
            tracing::warn!(
                target: "scriptor_vault::open",
                error = %error,
                "failed to sweep stale atomic-write temp files on vault open"
            );
        }
    }

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

    Ok(VaultSession {
        descriptor,
        root,
        pending_reindex_paths: recovery.reindex_paths,
    })
}

/// Creates an [`OpenVaultOutput`] from an existing session.
pub fn open_vault_output(session: &VaultSession) -> OpenVaultOutput {
    OpenVaultOutput {
        vault: session.descriptor.clone(),
        scan_job_id: Uuid::new_v4().to_string(),
    }
}
