use std::sync::{Arc, Mutex};
use std::thread::{self, JoinHandle};

use scriptor_indexer::{
    rebuild_index_with_progress, RebuildProgressReport, RebuildStatus, RebuildSummary,
};
use scriptor_vault::VaultSession;

#[derive(Debug, Clone)]
pub struct IndexRebuildJob {
    progress: Arc<Mutex<RebuildProgressReport>>,
    handle: Arc<Mutex<Option<JoinHandle<Result<RebuildSummary, String>>>>>,
}

impl Default for IndexRebuildJob {
    fn default() -> Self {
        Self {
            progress: Arc::new(Mutex::new(RebuildProgressReport {
                status: RebuildStatus::Idle,
                phase: "idle".into(),
                notes_processed: 0,
                notes_total: 0,
                event_index: 0,
            })),
            handle: Arc::new(Mutex::new(None)),
        }
    }
}

impl IndexRebuildJob {
    pub fn progress_snapshot(&self) -> RebuildProgressReport {
        self.progress.lock().expect("progress lock").clone()
    }

    pub fn spawn(&self, session: VaultSession) {
        self.wait();

        {
            let mut progress = self.progress.lock().expect("progress lock");
            *progress = RebuildProgressReport {
                status: RebuildStatus::Running,
                phase: "queued".into(),
                notes_processed: 0,
                notes_total: 0,
                event_index: 0,
            };
        }

        let progress = self.progress.clone();
        let handle = thread::spawn(move || {
            let result = rebuild_index_with_progress(&session, &[], |report| {
                *progress.lock().expect("progress lock") = report;
            })
            .map_err(|error| error.to_string());

            if let Err(error) = &result {
                let mut state = progress.lock().expect("progress lock");
                state.status = RebuildStatus::Failed;
                state.phase = error.clone();
            }

            result
        });

        *self.handle.lock().expect("handle lock") = Some(handle);
    }

    pub fn wait(&self) {
        let handle = self.handle.lock().expect("handle lock").take();
        if let Some(handle) = handle {
            let _ = handle.join();
        }
    }
}
