use std::sync::atomic::Ordering;

use scriptor_vault::{VaultSession, VaultWatchBatch, VaultWatchEvent, VaultWatcher};
use serde::Serialize;
use tauri::{AppHandle, Emitter};

use crate::AppState;
use crate::state::lock_recover;

#[derive(Debug, Clone, Serialize)]
pub(crate) struct VaultFilesystemChanged {
    generation: u64,
    events: Vec<VaultWatchEvent>,
    rescan_required: bool,
    reason: Option<String>,
}

pub(crate) fn restart_vault_watcher(
    app: &AppHandle,
    state: &AppState,
    session: &VaultSession,
) -> Result<(), String> {
    *lock_recover(&state.vault_watcher, "vault watcher") = None;

    let generation = state
        .vault_watcher_generation
        .fetch_add(1, Ordering::AcqRel)
        .saturating_add(1);
    let current_generation = state.vault_watcher_generation.clone();
    let app_handle = app.clone();
    let watcher = VaultWatcher::start(&session.root, 300, move |batch| {
        if current_generation.load(Ordering::Acquire) != generation {
            return;
        }

        let payload = match batch {
            VaultWatchBatch::Events(events) => VaultFilesystemChanged {
                generation,
                events,
                rescan_required: false,
                reason: None,
            },
            VaultWatchBatch::RescanRequired { reason } => VaultFilesystemChanged {
                generation,
                events: Vec::new(),
                rescan_required: true,
                reason: Some(reason),
            },
        };
        if let Err(error) = app_handle.emit("vault:filesystem-changed", &payload) {
            tracing::warn!(%error, "failed to emit vault filesystem event");
        }
    })
    .map_err(|error| error.to_string())?;

    *lock_recover(&state.vault_watcher, "vault watcher") = Some(watcher);
    Ok(())
}

pub(crate) fn parse_daemon_json<T: serde::de::DeserializeOwned>(json: &str) -> Result<T, String> {
    serde_json::from_str(json).map_err(|error| error.to_string())
}
