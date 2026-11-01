use std::process::Child;
use std::sync::{Arc, Mutex, MutexGuard, PoisonError};
use std::thread;
use std::time::{Duration, Instant};

use crate::error::ExportError;

/// Locks `mutex`, recovering the inner guard if a previous holder panicked.
///
/// Mirrors `scriptor_daemon::locks::lock_recover` (this crate cannot depend on
/// the daemon). Without it, a single panic while the cancel slot is held
/// poisons the mutex forever and every subsequent export *and* cancel panics
/// too -- turning one transient failure into a permanently broken subsystem.
fn lock_recover<T: ?Sized>(mutex: &Mutex<T>) -> MutexGuard<'_, T> {
    mutex.lock().unwrap_or_else(PoisonError::into_inner)
}

pub struct RunningExport {
    pub job_id: String,
    child: Child,
}

pub type ExportCancelSlot = Arc<Mutex<Option<RunningExport>>>;

pub fn new_cancel_slot() -> ExportCancelSlot {
    Arc::new(Mutex::new(None))
}

pub fn cancel_active_export(slot: &ExportCancelSlot) -> Option<String> {
    let mut guard = lock_recover(slot);
    let running = guard.take()?;
    let job_id = running.job_id.clone();
    let mut child = running.child;
    drop(guard);
    let _ = child.kill();
    let _ = child.wait();
    Some(job_id)
}

pub const DEFAULT_EXPORT_TIMEOUT: Duration = Duration::from_secs(15 * 60);

pub fn wait_for_child(
    slot: &ExportCancelSlot,
    job_id: &str,
    child: Child,
) -> Result<std::process::ExitStatus, ExportError> {
    wait_for_child_with_timeout(slot, job_id, child, DEFAULT_EXPORT_TIMEOUT)
}

pub fn wait_for_child_with_timeout(
    slot: &ExportCancelSlot,
    job_id: &str,
    child: Child,
    timeout: Duration,
) -> Result<std::process::ExitStatus, ExportError> {
    let started = Instant::now();
    {
        let mut guard = lock_recover(slot);
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
            let mut guard = lock_recover(slot);
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
                let mut guard = lock_recover(slot);
                if guard
                    .as_ref()
                    .is_some_and(|running| running.job_id == job_id)
                {
                    guard.take();
                }
                return Ok(status);
            }
            Ok(None) => {
                if started.elapsed() >= timeout {
                    let mut running = {
                        let mut guard = lock_recover(slot);
                        if guard
                            .as_ref()
                            .is_some_and(|running| running.job_id == job_id)
                        {
                            guard.take()
                        } else {
                            None
                        }
                    };
                    if let Some(running) = running.as_mut() {
                        let _ = running.child.kill();
                        let _ = running.child.wait();
                    }
                    return Err(ExportError::Process(format!(
                        "pandoc timed out after {} seconds",
                        timeout.as_secs()
                    )));
                }
                thread::sleep(Duration::from_millis(50));
            }
            Err(source) => {
                let mut guard = lock_recover(slot);
                if guard
                    .as_ref()
                    .is_some_and(|running| running.job_id == job_id)
                {
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

    use std::process::{Command, Stdio};

    #[test]
    fn cancel_on_empty_slot_returns_none() {
        let slot = new_cancel_slot();
        assert!(cancel_active_export(&slot).is_none());
    }

    fn poison(slot: &ExportCancelSlot) {
        let poisoner = Arc::clone(slot);
        let handle = thread::spawn(move || {
            let _guard = lock_recover(&poisoner);
            panic!("poison the cancel slot");
        });
        assert!(handle.join().is_err(), "helper thread should have panicked");
        assert!(slot.lock().is_err(), "cancel slot should be poisoned");
    }

    #[test]
    fn cancel_still_works_after_a_poisoning_panic() {
        let slot = new_cancel_slot();
        poison(&slot);
        // Would have panicked with the old `.expect("export cancel lock")`.
        assert!(cancel_active_export(&slot).is_none());
    }

    fn spawn_short_lived() -> Option<Child> {
        let mut command = if cfg!(windows) {
            // PROCESS_BROKER_EXCEPTION(export-cancel-test-windows)
            let mut cmd = Command::new("cmd");
            cmd.args(["/C", "exit 0"]);
            cmd
        } else {
            // PROCESS_BROKER_EXCEPTION(export-cancel-test-unix)
            Command::new("true")
        };
        command
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .spawn()
            .ok()
    }

    #[cfg(unix)]
    #[test]
    fn cancelling_export_terminates_descendants_and_stops_their_output() {
        use scriptor_system_bridge::{ProcessSpec, spawn_process};
        let directory = tempfile::tempdir().expect("isolated export cancellation fixture");
        let heartbeat = directory.path().join("descendant-heartbeat");
        let descendant_pid = directory.path().join("descendant-pid");
        let script = r#"sh -c 'while :; do printf x >> "$SCRIPTOR_EXPORT_HEARTBEAT"; sleep 0.05; done' & echo $! > "$SCRIPTOR_EXPORT_DESCENDANT_PID"; wait"#;
        let spawned = spawn_process(
            &ProcessSpec::new("sh")
                .args(["-c", script])
                .env("SCRIPTOR_EXPORT_HEARTBEAT", heartbeat.as_os_str())
                .env("SCRIPTOR_EXPORT_DESCENDANT_PID", descendant_pid.as_os_str()),
        )
        .expect("spawn group-scoped export process");
        let slot = new_cancel_slot();
        *lock_recover(&slot) = Some(RunningExport {
            job_id: "descendant-cancel".into(),
            child: spawned.child,
        });

        let started = Instant::now();
        while started.elapsed() < Duration::from_secs(5) {
            if descendant_pid.exists()
                && std::fs::metadata(&heartbeat)
                    .is_ok_and(|metadata| metadata.len() > 0)
            {
                break;
            }
            thread::sleep(Duration::from_millis(10));
        }
        assert!(descendant_pid.exists() && heartbeat.exists(), "descendant never started");
        assert_eq!(cancel_active_export(&slot).as_deref(), Some("descendant-cancel"));
        let stopped_bytes = std::fs::metadata(&heartbeat).expect("heartbeat").len();
        thread::sleep(Duration::from_millis(250));
        let final_bytes = std::fs::metadata(&heartbeat).expect("heartbeat").len();
        assert_eq!(
            stopped_bytes, final_bytes,
            "cancelled export left a background compiler child writing outside the broker lifecycle",
        );
    }

    #[test]
    fn export_wait_still_works_after_a_poisoning_panic() {
        let slot = new_cancel_slot();
        poison(&slot);

        let Some(child) = spawn_short_lived() else {
            return; // no shell utilities available; poisoning coverage above still holds
        };
        let status = wait_for_child(&slot, "job-after-poison", child).expect("wait must not panic");
        assert!(status.success());
        assert!(
            lock_recover(&slot).is_none(),
            "finished job should be cleared from the slot"
        );
    }
}
