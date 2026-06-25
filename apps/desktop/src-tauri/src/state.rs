use std::sync::Mutex;

use scriptor_export_runner::{new_cancel_slot, ExportCancelSlot};
use scriptor_vault::{VaultSession, VaultWatcher};

pub struct AppState {
    pub session: Mutex<Option<VaultSession>>,
    pub export_cancel: ExportCancelSlot,
    pub vault_watcher: Mutex<Option<VaultWatcher>>,
}

impl AppState {
    pub fn new() -> Self {
        Self {
            session: Mutex::new(None),
            export_cancel: new_cancel_slot(),
            vault_watcher: Mutex::new(None),
        }
    }
}

pub fn active_session(state: &tauri::State<AppState>) -> Result<VaultSession, String> {
    state
        .session
        .lock()
        .expect("session lock")
        .clone()
        .ok_or_else(|| "No vault is open. Call vault_open first.".to_string())
}
