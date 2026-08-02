// PROCESS_BROKER_EXCEPTION: export cancellation operates on an already-running child/process tree and is the streaming broker cleanup path.
use std::process::Child;
use std::sync::{Arc, Mutex, MutexGuard, PoisonError};
use std::thread;
use std::time::Duration;

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

pub fn wait_for_child(
    slot: &ExportCancelSlot,
    job_id: &str,
    child: Child,
) -> Result<std::process::ExitStatus, ExportError> {
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
                if guard.as_ref().is_some_and(|running| running.job_id == job_id) {
                    guard.take();
                }
                return Ok(status);
            }
            Ok(None) => thread::sleep(Duration::from_millis(50)),
            Err(source) => {
                let mut guard = lock_recover(slot);
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
            let mut cmd = Command::new("cmd");
            cmd.args(["/C", "exit 0"]);
            cmd
        } else {
            Command::new("true")
        };
        command.stdout(Stdio::null()).stderr(Stdio::null()).spawn().ok()
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
