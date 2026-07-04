use std::sync::{Arc, Mutex};

use scriptor_indexer::incremental_notes_index_with_cache;
use scriptor_vault::{VaultWatchEvent, VaultWatcher};

use crate::handler::DaemonState;

const WATCH_DEBOUNCE_MS: u64 = 300;

pub fn restart_vault_watcher(state: &Arc<Mutex<DaemonState>>) -> Result<(), String> {
    let root = {
        let mut guard = state.lock().expect("daemon state lock");
        guard.clear_vault_watcher();
        let session = guard
            .session()
            .ok_or_else(|| "no vault is open; cannot start watcher".to_string())?;
        session.root.clone()
    };

    let state_for_watcher = Arc::clone(state);
    let watcher = VaultWatcher::start(&root, WATCH_DEBOUNCE_MS, move |events| {
        apply_watch_batch(&state_for_watcher, events);
    })
    .map_err(|error| error.to_string())?;

    state
        .lock()
        .expect("daemon state lock")
        .set_vault_watcher(watcher);
    Ok(())
}

fn apply_watch_batch(state: &Arc<Mutex<DaemonState>>, events: Vec<VaultWatchEvent>) {
    let paths: Vec<String> = events.into_iter().map(|event| event.path).collect();
    if paths.is_empty() {
        return;
    }

    let (session, cache) = {
        let guard = state.lock().expect("daemon state lock");
        (
            guard.session().cloned(),
            guard.index_cache().cloned(),
        )
    };
    let Some(session) = session else {
        return;
    };
    let Some(cache) = cache else {
        return;
    };

    if let Err(error) = incremental_notes_index_with_cache(&session, &cache, &paths, &[]) {
        tracing::warn!(
            target: "scriptor_daemon::watcher",
            changed_paths = paths.len(),
            %error,
            "incremental index update failed for watch batch",
        );
    }
}

#[cfg(test)]
mod tests {
    use std::thread;
    use std::time::Duration;

    use scriptor_ipc::{RpcMethod, RpcPayload, RpcRequest, RpcResult};
    use tempfile::tempdir;

    use super::*;
    use crate::handler::DaemonState;

    #[test]
    fn filesystem_change_updates_daemon_index() {
        let dir = tempdir().expect("tempdir");
        std::fs::write(dir.path().join("alpha.md"), "# Alpha\n\nBody\n").expect("write");

        let state = Arc::new(Mutex::new(DaemonState::default()));
        {
            let mut guard = state.lock().expect("daemon state lock");
            let open = guard.handle(RpcRequest::new(1, RpcMethod::OpenVault {
                path: dir.path().display().to_string(),
            }));
            assert!(matches!(open.result, RpcResult::Ok(RpcPayload::VaultOpened { .. })));
            guard.wait_index_rebuild();
        }
        restart_vault_watcher(&state).expect("start watcher");

        std::fs::write(dir.path().join("external.md"), "# External\n\nWatcher body\n").expect("write");

        let mut found = false;
        for _ in 0..40 {
            thread::sleep(Duration::from_millis(50));
            let search = state.lock().expect("daemon state lock").handle(RpcRequest::new(2, RpcMethod::SearchNotes {
                query: "Watcher body".into(),
                limit: 10,
            }));
            if let RpcResult::Ok(RpcPayload::SearchHits { hits }) = search.result {
                if hits.iter().any(|hit| hit.path == "external.md") {
                    found = true;
                    break;
                }
            }
        }

        assert!(found, "external note should be indexed by daemon watcher");
    }
}
