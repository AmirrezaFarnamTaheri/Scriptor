use std::sync::{Arc, Mutex};
use std::thread::{self, JoinHandle};

use scriptor_export_runner::{
    ExportCancelSlot, ExportJobInput, ExportJobOutput, ExportProgressCallback,
    cancel_active_export, new_cancel_slot, run_export_job_with_cancel,
};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::locks::lock_recover;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ExportJobState {
    Idle,
    Running,
    Complete,
    Failed,
    Cancelled,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ExportProgressReport {
    pub job_id: String,
    pub status: ExportJobState,
    pub phase: String,
    pub event_index: u32,
    pub result_json: Option<String>,
    pub error: Option<String>,
}

impl Default for ExportProgressReport {
    fn default() -> Self {
        Self {
            job_id: String::new(),
            status: ExportJobState::Idle,
            phase: "idle".into(),
            event_index: 0,
            result_json: None,
            error: None,
        }
    }
}

pub struct ExportJobRunner {
    cancel_slot: ExportCancelSlot,
    progress: Arc<Mutex<ExportProgressReport>>,
    handle: Arc<Mutex<Option<JoinHandle<()>>>>,
}

impl Default for ExportJobRunner {
    fn default() -> Self {
        Self::new()
    }
}

impl ExportJobRunner {
    pub fn new() -> Self {
        Self {
            cancel_slot: new_cancel_slot(),
            progress: Arc::new(Mutex::new(ExportProgressReport::default())),
            handle: Arc::new(Mutex::new(None)),
        }
    }

    pub fn cancel_slot(&self) -> &ExportCancelSlot {
        &self.cancel_slot
    }

    pub fn progress_snapshot(&self) -> ExportProgressReport {
        lock_recover(&self.progress).clone()
    }

    pub fn start(&self, mut input: ExportJobInput) -> Result<String, String> {
        self.wait();

        let job_id = input
            .job_id
            .clone()
            .unwrap_or_else(|| Uuid::new_v4().to_string());
        input.job_id = Some(job_id.clone());

        {
            let mut progress = lock_recover(&self.progress);
            *progress = ExportProgressReport {
                job_id: job_id.clone(),
                status: ExportJobState::Running,
                phase: "queued".into(),
                event_index: 1,
                result_json: None,
                error: None,
            };
        }

        let progress = Arc::clone(&self.progress);
        let cancel_slot = Arc::clone(&self.cancel_slot);
        let handle = thread::spawn(move || {
            let progress_cb: ExportProgressCallback = Arc::new({
                let progress = Arc::clone(&progress);
                move |_chunk: &str| {
                    let mut guard = lock_recover(&progress);
                    guard.event_index = guard.event_index.saturating_add(1);
                    guard.phase = "exporting".into();
                }
            });

            {
                let mut guard = lock_recover(&progress);
                guard.phase = "starting".into();
                guard.event_index = guard.event_index.saturating_add(1);
            }

            let result = run_export_job_with_cancel(input, Some(&cancel_slot), Some(progress_cb));

            let mut guard = lock_recover(&progress);
            match result {
                Ok(output) => {
                    guard.status = ExportJobState::Complete;
                    guard.phase = "complete".into();
                    guard.event_index = guard.event_index.saturating_add(1);
                    guard.result_json = serde_json::to_string(&output).ok();
                    guard.error = None;
                }
                Err(error) => {
                    let cancelled = error.to_string().contains("cancelled");
                    guard.status = if cancelled {
                        ExportJobState::Cancelled
                    } else {
                        ExportJobState::Failed
                    };
                    guard.phase = if cancelled {
                        "cancelled".into()
                    } else {
                        "failed".into()
                    };
                    guard.event_index = guard.event_index.saturating_add(1);
                    guard.error = Some(error.to_string());
                    guard.result_json = None;
                }
            }
        });

        *lock_recover(&self.handle) = Some(handle);
        Ok(job_id)
    }

    pub fn cancel(&self, job_id: Option<&str>) -> Result<bool, String> {
        let active = lock_recover(&self.progress);
        if active.status != ExportJobState::Running {
            return Ok(false);
        }
        if let Some(expected) = job_id
            && active.job_id != expected
        {
            return Ok(false);
        }
        drop(active);

        let cancelled = cancel_active_export(&self.cancel_slot).is_some();
        if cancelled {
            let mut guard = lock_recover(&self.progress);
            if job_id.is_none() || job_id == Some(guard.job_id.as_str()) {
                guard.status = ExportJobState::Cancelled;
                guard.phase = "cancelled".into();
            }
        }
        Ok(cancelled)
    }

    pub fn wait(&self) {
        let handle = lock_recover(&self.handle).take();
        if let Some(handle) = handle {
            let _ = handle.join();
        }
    }

    pub fn take_result(&self, job_id: &str) -> Option<ExportJobOutput> {
        let guard = lock_recover(&self.progress);
        if guard.job_id != job_id || guard.status != ExportJobState::Complete {
            return None;
        }
        guard
            .result_json
            .as_ref()
            .and_then(|json| serde_json::from_str::<ExportJobOutput>(json).ok())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn start_dry_run_completes_with_progress_events() {
        let runner = ExportJobRunner::new();
        let job_id = runner
            .start(ExportJobInput {
                format: "html".into(),
                source_markdown: "# Hello\n".into(),
                output_directory: std::env::temp_dir().display().to_string(),
                source_stem: "hello".into(),
                title: None,
                dry_run: true,
                extra_pandoc_args: vec![],
                vault_root: std::env::temp_dir().display().to_string(),
                job_id: None,
                preserve_temp_on_failure: false,
                trusted_pandoc_hash: None,
                redact_secrets: false,
            })
            .expect("start");

        runner.wait();
        let report = runner.progress_snapshot();
        assert_eq!(report.job_id, job_id);
        assert_eq!(report.status, ExportJobState::Complete);
        assert!(
            report.event_index >= 3,
            "expected >=3 progress events, got {}",
            report.event_index
        );
        assert!(report.result_json.is_some());
    }

    #[test]
    fn cancel_on_idle_returns_false() {
        let runner = ExportJobRunner::new();
        assert!(!runner.cancel(None).expect("cancel"));
    }
}
