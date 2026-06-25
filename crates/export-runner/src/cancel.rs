use std::process::Child;
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;

use crate::error::ExportError;

pub struct RunningExport {
    pub job_id: String,
    child: Child,
}

pub type ExportCancelSlot = Arc<Mutex<Option<RunningExport>>>;

pub fn new_cancel_slot() -> ExportCancelSlot {
    Arc::new(Mutex::new(None))
}

pub fn cancel_active_export(slot: &ExportCancelSlot) -> Option<String> {
    let mut guard = slot.lock().expect("export cancel lock");
    let running = guard.take()?;
    let job_id = running.job_id.clone();
    let mut child = running.child;
    drop(guard);
    let _ = child.kill();
    let _ = child.wait();
    Some(job_id)
}

pub fn wait_for_child(
    slot: &ExportCancelSlot,
    job_id: &str,
    child: Child,
) -> Result<std::process::ExitStatus, ExportError> {
    {
        let mut guard = slot.lock().expect("export cancel lock");
        if let Some(previous) = guard.take() {
            let mut previous_child = previous.child;
            let _ = previous_child.kill();
            let _ = previous_child.wait();
        }
        *guard = Some(RunningExport {
            job_id: job_id.to_string(),
            child,
        });
    }

    loop {
        let wait_result = {
            let mut guard = slot.lock().expect("export cancel lock");
            let Some(running) = guard.as_mut() else {
                return Err(ExportError::Cancelled);
            };
            if running.job_id != job_id {
                return Err(ExportError::Cancelled);
            }
            running.child.try_wait()
        };

        match wait_result {
            Ok(Some(status)) => {
                let mut guard = slot.lock().expect("export cancel lock");
                if guard.as_ref().is_some_and(|running| running.job_id == job_id) {
                    guard.take();
                }
                return Ok(status);
            }
            Ok(None) => thread::sleep(Duration::from_millis(50)),
            Err(source) => {
                let mut guard = slot.lock().expect("export cancel lock");
                if guard.as_ref().is_some_and(|running| running.job_id == job_id) {
                    guard.take();
                }
                return Err(ExportError::Io {
                    path: std::path::PathBuf::from("pandoc"),
                    source,
                });
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn cancel_on_empty_slot_returns_none() {
        let slot = new_cancel_slot();
        assert!(cancel_active_export(&slot).is_none());
    }
}
