use std::sync::{Arc, Mutex};

use scriptor_indexer::{incremental_notes_index_with_cache, rebuild_index};
use scriptor_vault::{VaultWatchBatch, VaultWatchEvent, VaultWatcher};

use crate::handler::DaemonState;
use crate::locks::lock_recover;

const WATCH_DEBOUNCE_MS: u64 = 300;

pub fn restart_vault_watcher(state: &Arc<Mutex<DaemonState>>) -> Result<(), String> {
    let (root, generation) = {
        let mut guard = lock_recover(state);
        guard.clear_vault_watcher();
        guard.watcher_generation = guard.watcher_generation.saturating_add(1);
        let session = guard
            .session()
            .ok_or_else(|| "no vault is open; cannot start watcher".to_string())?;
        (session.root.clone(), guard.watcher_generation)
    };

    let state_for_watcher = Arc::clone(state);
    let watcher = VaultWatcher::start(&root, WATCH_DEBOUNCE_MS, move |batch| {
        apply_watch_batch(&state_for_watcher, generation, batch);
    })
    .map_err(|error| error.to_string())?;

    lock_recover(state).set_vault_watcher(watcher);
    Ok(())
}

fn apply_watch_batch(state: &Arc<Mutex<DaemonState>>, generation: u64, batch: VaultWatchBatch) {
    let (session, cache) = {
        let guard = lock_recover(state);
        if guard.watcher_generation != generation {
            return;
        }
        (guard.session().cloned(), guard.index_cache().cloned())
    };
    let Some(session) = session else {
        return;
    };

    match batch {
        VaultWatchBatch::Events(events) => {
            apply_incremental_batch(cache, &session, events);
        }
        VaultWatchBatch::RescanRequired { reason } => {
            tracing::warn!(
                target: "scriptor_daemon::watcher",
                %reason,
                "watcher reported event loss; rebuilding complete index",
            );
            if let Err(error) = rebuild_index(&session, &[]) {
                tracing::error!(
                    target: "scriptor_daemon::watcher",
                    %error,
                    "full index rebuild failed after watcher event loss",
                );
            }
        }
    }
}

fn apply_incremental_batch(
    cache: Option<scriptor_indexer::IndexCache>,
    session: &scriptor_vault::VaultSession,
    events: Vec<VaultWatchEvent>,
) {
    let paths: Vec<String> = events.into_iter().map(|event| event.path).collect();
    if paths.is_empty() {
        return;
    }
    let Some(cache) = cache else {
        return;
    };

    if let Err(error) = incremental_notes_index_with_cache(session, &cache, &paths, &[]) {
        tracing::warn!(
            target: "scriptor_daemon::watcher",
            changed_paths = paths.len(),
            %error,
            "incremental index update failed; rebuilding complete index",
        );
        if let Err(rebuild_error) = rebuild_index(session, &[]) {
            tracing::error!(
                target: "scriptor_daemon::watcher",
                %rebuild_error,
                "full index rebuild also failed after incremental watcher update",
            );
        }
    }
}

#[cfg(test)]
mod tests {
    use std::thread;
    use std::time::Duration;

    use scriptor_ipc::{RpcMethod, RpcPayload, RpcRequest, RpcResult};
    use tempfile::tempdir;

    use super::*;

    #[test]
    fn filesystem_change_updates_daemon_index() {
        let dir = tempdir().expect("tempdir");
        std::fs::write(dir.path().join("alpha.md"), "# Alpha\n\nBody\n").expect("write");

        let state = Arc::new(Mutex::new(DaemonState::default()));
        {
            let mut guard = lock_recover(&state);
            let open = guard.handle(RpcRequest::new(
                1,
                RpcMethod::OpenVault {
                    path: dir.path().display().to_string(),
                },
            ));
            assert!(matches!(
                open.result,
                RpcResult::Ok(RpcPayload::VaultOpened { .. })
            ));
            guard.wait_index_rebuild();
        }
        restart_vault_watcher(&state).expect("start watcher");

        std::fs::write(
            dir.path().join("external.md"),
            "# External\n\nWatcher body\n",
        )
        .expect("write");

        let mut found = false;
        for _ in 0..40 {
            thread::sleep(Duration::from_millis(50));
            let search = lock_recover(&state).handle(RpcRequest::new(
                2,
                RpcMethod::SearchNotes {
                    query: "Watcher body".into(),
                    limit: 10,
                },
            ));
            if let RpcResult::Ok(RpcPayload::SearchHits { hits }) = search.result
                && hits.iter().any(|hit| hit.path == "external.md")
            {
                found = true;
                break;
            }
        }

        assert!(found, "external note should be indexed by daemon watcher");
    }
}
