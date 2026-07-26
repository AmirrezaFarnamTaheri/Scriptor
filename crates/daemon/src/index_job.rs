use std::sync::{Arc, Mutex};
use std::thread::{self, JoinHandle};

use scriptor_indexer::{
    rebuild_index_with_progress, RebuildProgressReport, RebuildStatus, RebuildSummary,
};
use scriptor_vault::VaultSession;

type RebuildHandle = JoinHandle<Result<RebuildSummary, String>>;

#[derive(Debug, Clone)]
pub struct IndexRebuildJob {
    progress: Arc<Mutex<RebuildProgressReport>>,
    handle: Arc<Mutex<Option<RebuildHandle>>>,
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
            match handle.join() {
                Ok(Ok(_)) => {}
                Ok(Err(error)) => {
                    // The worker normally records its own failure, but make sure
                    // the progress report always reaches a terminal state.
                    let mut state = self.progress.lock().expect("progress lock");
                    if state.status != RebuildStatus::Failed {
                        state.status = RebuildStatus::Failed;
                        state.phase = error;
                    }
                }
                Err(panic) => {
                    // A panicking rebuild thread must not leave the progress
                    // report stuck at Running.
                    let message = panic
                        .downcast_ref::<String>()
                        .map(String::as_str)
                        .or_else(|| panic.downcast_ref::<&str>().copied())
                        .unwrap_or("index rebuild thread panicked");
                    let mut state = self.progress.lock().expect("progress lock");
                    state.status = RebuildStatus::Failed;
                    state.phase = format!("index rebuild panicked: {message}");
                }
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn running_job_with_handle(handle: RebuildHandle) -> IndexRebuildJob {
        let job = IndexRebuildJob::default();
        {
            let mut progress = job.progress.lock().expect("progress lock");
            progress.status = RebuildStatus::Running;
            progress.phase = "indexing".into();
        }
        *job.handle.lock().expect("handle lock") = Some(handle);
        job
    }

    #[test]
    fn wait_marks_progress_failed_when_thread_panics() {
        let handle: RebuildHandle =
            thread::spawn(|| -> Result<RebuildSummary, String> { panic!("boom") });
        let job = running_job_with_handle(handle);

        job.wait();

        let progress = job.progress_snapshot();
        assert_eq!(progress.status, RebuildStatus::Failed);
        assert!(progress.phase.contains("boom"), "phase: {}", progress.phase);
    }

    #[test]
    fn wait_marks_progress_failed_on_error_result() {
        let handle: RebuildHandle = thread::spawn(|| Err("db locked".to_string()));
        let job = running_job_with_handle(handle);

        job.wait();

        let progress = job.progress_snapshot();
        assert_eq!(progress.status, RebuildStatus::Failed);
        assert_eq!(progress.phase, "db locked");
    }
}
