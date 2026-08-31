use std::path::Path;
use std::sync::{
    Arc, Mutex, MutexGuard, RwLock, RwLockReadGuard, RwLockWriteGuard,
    atomic::{AtomicBool, AtomicU64},
};

use scriptor_export_runner::{ExportCancelSlot, new_cancel_slot};
use scriptor_native_git::queue::GitQueue;
use scriptor_vault::{VaultSession, VaultWatcher};

use crate::authorization::AuthorizationBroker;

pub struct AppState {
    /// The active session is reader-locked for the full duration of every
    /// vault-bound command. `vault_open` takes the writer lock before swapping
    /// it, so a request that began in one vault cannot resolve a later vault.
    pub session: RwLock<Option<VaultSession>>,
    /// Keeps vault-open transitions in request order while recovery and watcher
    /// setup run, preventing overlapping opens from leaving a stale session.
    pub vault_switch_lock: Mutex<()>,
    pub export_cancel: ExportCancelSlot,
    pub vault_watcher: Mutex<Option<VaultWatcher>>,
    pub vault_watcher_generation: Arc<AtomicU64>,
    pub headless_engine: Mutex<bool>,
    /// Serializes native Git mutations across every renderer/hook instance
    /// through the bounded per-repo `GitQueue` worker. The handle is replaced
    /// whenever a command targets a different canonical repo root, so a vault
    /// swap can never reuse the previous vault's queue.
    pub git_queue: Mutex<Option<Arc<GitQueue>>>,
    pub authorization: AuthorizationBroker,
    /// Best-effort cancellation flag for the LaTeX (Tectonic) compiler.
    pub latex_cancel: Arc<AtomicBool>,
}

impl Default for AppState {
    fn default() -> Self {
        Self::new()
    }
}

impl AppState {
    pub fn new() -> Self {
        Self {
            session: RwLock::new(None),
            vault_switch_lock: Mutex::new(()),
            export_cancel: new_cancel_slot(),
            vault_watcher: Mutex::new(None),
            vault_watcher_generation: Arc::new(AtomicU64::new(0)),
            headless_engine: Mutex::new(false),
            git_queue: Mutex::new(None),
            authorization: AuthorizationBroker::default(),
            latex_cancel: Arc::new(AtomicBool::new(false)),
        }
    }
}

pub fn use_headless_engine(state: &AppState) -> bool {
    *lock_recover(&state.headless_engine, "headless engine")
}

pub fn set_headless_engine(state: &AppState, enabled: bool) {
    *lock_recover(&state.headless_engine, "headless engine") = enabled;
}

/// Returns the bounded per-repo `GitQueue` for `root`, reusing the handle when
/// the previous command targeted the same canonical repo root and replacing it
/// after a vault swap. All native Git mutations must run through this queue:
/// its worker is the serialization guarantee; the session lease on the caller
/// additionally blocks a vault swap until the queued operation completes.
pub fn git_queue_handle(state: &AppState, root: &Path) -> Arc<GitQueue> {
    let mut guard = lock_recover(&state.git_queue, "git queue");
    match guard.as_ref() {
        Some(queue) if queue.repo_root == root => Arc::clone(queue),
        _ => {
            let queue = Arc::new(GitQueue::new(root.to_path_buf()));
            *guard = Some(Arc::clone(&queue));
            queue
        }
    }
}

/// Drops the cached queue handle after a vault swap so the next mutation
/// targets the new repo root.
pub fn reset_git_queue(state: &AppState) {
    *lock_recover(&state.git_queue, "git queue") = None;
}

pub struct ActiveSession<'a> {
    guard: RwLockReadGuard<'a, Option<VaultSession>>,
}

impl std::ops::Deref for ActiveSession<'_> {
    type Target = VaultSession;

    fn deref(&self) -> &Self::Target {
        self.guard
            .as_ref()
            .expect("ActiveSession is only constructed for an open vault")
    }
}

pub fn active_session<'a>(
    state: &'a tauri::State<'a, AppState>,
) -> Result<ActiveSession<'a>, String> {
    active_session_from_app_state(state)
}

fn active_session_from_app_state(state: &AppState) -> Result<ActiveSession<'_>, String> {
    let guard = read_recover(&state.session, "session");
    if guard.is_none() {
        return Err("No vault is open. Call vault_open first.".to_string());
    }
    Ok(ActiveSession { guard })
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

pub fn read_recover<'a, T>(lock: &'a RwLock<T>, name: &str) -> RwLockReadGuard<'a, T> {
    match lock.read() {
        Ok(guard) => guard,
        Err(poisoned) => {
            tracing::error!(lock = name, "recovering poisoned desktop read lock");
            lock.clear_poison();
            poisoned.into_inner()
        }
    }
}

pub fn write_recover<'a, T>(lock: &'a RwLock<T>, name: &str) -> RwLockWriteGuard<'a, T> {
    match lock.write() {
        Ok(guard) => guard,
        Err(poisoned) => {
            tracing::error!(lock = name, "recovering poisoned desktop write lock");
            lock.clear_poison();
            poisoned.into_inner()
        }
    }
}

#[cfg(test)]
mod tests {
    use std::sync::{Arc, Mutex, mpsc};
    use std::time::Duration;

    use super::{AppState, active_session_from_app_state, lock_recover, write_recover};

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

    #[test]
    fn active_session_lease_blocks_a_vault_swap_until_the_command_finishes() {
        let vault = tempfile::tempdir().expect("vault");
        let session = scriptor_vault::open_vault(vault.path()).expect("open vault");
        let state = Arc::new(AppState::new());
        *write_recover(&state.session, "session") = Some(session);

        let lease = active_session_from_app_state(&state).expect("active session lease");
        let (entered_tx, entered_rx) = mpsc::channel();
        let state_for_swap = Arc::clone(&state);
        let swap = std::thread::spawn(move || {
            let _writer = write_recover(&state_for_swap.session, "session");
            entered_tx.send(()).expect("signal vault swap");
        });

        assert!(entered_rx.recv_timeout(Duration::from_millis(100)).is_err());
        drop(lease);
        entered_rx
            .recv_timeout(Duration::from_secs(1))
            .expect("vault swap proceeds after the command lease drops");
        swap.join().expect("vault swap thread");
    }
}
