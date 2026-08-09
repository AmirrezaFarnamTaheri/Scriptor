use std::sync::{Arc, Mutex, MutexGuard, atomic::AtomicU64};

use scriptor_export_runner::{ExportCancelSlot, new_cancel_slot};
use scriptor_vault::{VaultSession, VaultWatcher};

use crate::authorization::AuthorizationBroker;

pub struct AppState {
    pub session: Mutex<Option<VaultSession>>,
    pub export_cancel: ExportCancelSlot,
    pub vault_watcher: Mutex<Option<VaultWatcher>>,
    pub vault_watcher_generation: Arc<AtomicU64>,
    pub headless_engine: Mutex<bool>,
    pub authorization: AuthorizationBroker,
}

impl Default for AppState {
    fn default() -> Self {
        Self::new()
    }
}

impl AppState {
    pub fn new() -> Self {
        Self {
            session: Mutex::new(None),
            export_cancel: new_cancel_slot(),
            vault_watcher: Mutex::new(None),
            vault_watcher_generation: Arc::new(AtomicU64::new(0)),
            headless_engine: Mutex::new(false),
            authorization: AuthorizationBroker::default(),
        }
    }
}

pub fn use_headless_engine(state: &AppState) -> bool {
    *lock_recover(&state.headless_engine, "headless engine")
}

pub fn set_headless_engine(state: &AppState, enabled: bool) {
    *lock_recover(&state.headless_engine, "headless engine") = enabled;
}

pub fn active_session(state: &tauri::State<AppState>) -> Result<VaultSession, String> {
    lock_recover(&state.session, "session")
        .clone()
        .ok_or_else(|| "No vault is open. Call vault_open first.".to_string())
}

pub fn lock_recover<'a, T>(mutex: &'a Mutex<T>, name: &str) -> MutexGuard<'a, T> {
    match mutex.lock() {
        Ok(guard) => guard,
        Err(poisoned) => {
            tracing::error!(lock = name, "recovering poisoned desktop state lock");
            mutex.clear_poison();
            poisoned.into_inner()
        }
    }
}

#[cfg(test)]
mod tests {
    use std::sync::{Arc, Mutex};

    use super::lock_recover;

    #[test]
    fn poisoned_lock_recovers_once_and_remains_usable() {
        let value = Arc::new(Mutex::new(0usize));
        let worker_value = Arc::clone(&value);
        let _ = std::thread::spawn(move || {
            let _guard = worker_value.lock().expect("test lock");
            panic!("poison test lock");
        })
        .join();

        *lock_recover(&value, "test") = 7;
        assert_eq!(*lock_recover(&value, "test"), 7);
        assert!(!value.is_poisoned());
    }
}
