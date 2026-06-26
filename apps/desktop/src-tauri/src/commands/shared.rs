use serde::Serialize;
use tauri::{AppHandle, Emitter};
use scriptor_vault::{VaultSession, VaultWatchEvent, VaultWatcher};

use crate::AppState;

#[derive(Debug, Clone, Serialize)]
pub(crate) struct VaultFilesystemChanged {
    events: Vec<VaultWatchEvent>,
}

pub(crate) fn restart_vault_watcher(
    app: &AppHandle,
    state: &AppState,
    session: &VaultSession,
) -> Result<(), String> {
    {
        let mut guard = state.vault_watcher.lock().expect("vault watcher lock");
        *guard = None;
    }

    let app_handle = app.clone();
    let watcher = VaultWatcher::start(&session.root, 300, move |events| {
        let payload = VaultFilesystemChanged { events };
        let _ = app_handle.emit("vault:filesystem-changed", &payload);
    })
    .map_err(|error| error.to_string())?;

    *state
        .vault_watcher
        .lock()
        .expect("vault watcher lock") = Some(watcher);
    Ok(())
}

pub(crate) fn parse_daemon_json<T: serde::de::DeserializeOwned>(json: &str) -> Result<T, String> {
    serde_json::from_str(json).map_err(|error| error.to_string())
}
