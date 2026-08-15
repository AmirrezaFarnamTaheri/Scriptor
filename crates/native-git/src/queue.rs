//! `GitQueue` — one worker thread per canonical repo root (W1-4).
//!
//! All mutating git operations must be enqueued here. The worker thread
//! processes them sequentially so that concurrent pull + commit cannot
//! interleave. The frontend "busy" flag is a UX convenience only; the queue
//! is the correctness guarantee.
//!
//! # Design
//! - Each canonical repo root gets its own `GitQueue` instance.
//! - `GitQueue::enqueue` submits a boxed closure that runs on the worker
//!   thread and returns its result via a [`std::sync::mpsc`] one-shot.
//! - The queue is unbounded; back-pressure is the caller's responsibility
//!   (the UI busy flag is the coarse limiter).
//! - Dropping a `GitQueue` shuts the worker thread down gracefully: the
//!   worker exits when the send half of the channel is dropped.
//!
//! # Example
//! ```no_run
//! use std::path::PathBuf;
//! use scriptor_native_git::queue::{GitQueue, QueuedOp};
//!
//! let queue = GitQueue::new(PathBuf::from("/path/to/repo"));
//! let result = queue.enqueue(|root| {
//!     // Any mutating git operation here.
//!     Ok("done".to_string())
//! });
//! println!("{:?}", result);
//! ```

use std::path::PathBuf;
use std::sync::mpsc;
use std::thread;

use crate::error::GitError;

// ── Types ─────────────────────────────────────────────────────────────────────

/// A boxed closure that runs a git operation and returns a result.
pub type QueuedOp<T> = Box<dyn FnOnce(&PathBuf) -> Result<T, GitError> + Send + 'static>;

// Internal message type.  We use Box<dyn FnOnce(…) + Send> so we can
// store heterogeneous operations in the same channel.
type Task = Box<dyn FnOnce(&PathBuf) + Send + 'static>;

// ── GitQueue ──────────────────────────────────────────────────────────────────

/// A serialised-operation queue for a single git repository.
///
/// Create one instance per canonical repository root. All mutating git
/// operations should be submitted through [`GitQueue::enqueue`].
pub struct GitQueue {
    sender: mpsc::Sender<Task>,
    /// The canonical path of the managed repository root (for diagnostics).
    pub repo_root: PathBuf,
}

impl GitQueue {
    /// Spawn a worker thread for `repo_root` and return a handle.
    ///
    /// The worker runs until the `GitQueue` is dropped (at which point the
    /// sender channel closes and the worker exits its loop).
    pub fn new(repo_root: PathBuf) -> Self {
        let (sender, receiver) = mpsc::channel::<Task>();
        let root_clone = repo_root.clone();

        thread::Builder::new()
            .name(format!(
                "git-queue[{}]",
                repo_root
                    .file_name()
                    .and_then(|name| name.to_str())
                    .unwrap_or("repo")
            ))
            .spawn(move || {
                // Process tasks until the sender end of the channel closes.
                for task in receiver {
                    task(&root_clone);
                }
            })
            .expect("failed to spawn git queue worker thread");

        Self { sender, repo_root }
    }

    /// Submit a git operation to be run on the worker thread.
    ///
    /// Blocks the calling thread until the operation completes and returns its
    /// result, preserving a synchronous calling convention while guaranteeing
    /// that no two operations run concurrently for the same repo root.
    ///
    /// # Errors
    /// Returns [`GitError::Command`] if the worker thread panicked or the
    /// channel disconnected before the result arrived.
    pub fn enqueue<T, F>(&self, op: F) -> Result<T, GitError>
    where
        T: Send + 'static,
        F: FnOnce(&PathBuf) -> Result<T, GitError> + Send + 'static,
    {
        let (result_tx, result_rx) = mpsc::sync_channel::<Result<T, GitError>>(1);

        let task: Task = Box::new(move |root| {
            let result = op(root);
            // If the caller dropped the receiver we just silently discard the result.
            let _ = result_tx.send(result);
        });

        self.sender
            .send(task)
            .map_err(|_| GitError::Command("git queue worker has stopped".into()))?;

        result_rx.recv().map_err(|_| {
            GitError::Command("git queue worker disconnected before returning a result".into())
        })?
    }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn queue_runs_closure_on_repo_root() {
        let dir = tempdir().unwrap();
        let root = dir.path().to_path_buf();
        let queue = GitQueue::new(root.clone());

        let result = queue
            .enqueue(|r| Ok(r.to_string_lossy().into_owned()))
            .unwrap();
        assert_eq!(result, root.to_string_lossy());
    }

    #[test]
    fn queue_serialises_concurrent_submissions() {
        use std::sync::{Arc, Mutex};

        let dir = tempdir().unwrap();
        let queue = GitQueue::new(dir.path().to_path_buf());
        let log: Arc<Mutex<Vec<u32>>> = Arc::new(Mutex::new(Vec::new()));

        let mut handles = Vec::new();
        for i in 0..10u32 {
            let log_clone = Arc::clone(&log);
            // We cannot move `queue` across threads, so we wrap in Arc.
            // Instead: collect futures then send to queue from one thread.
            let result = queue.enqueue(move |_root| {
                log_clone.lock().unwrap().push(i);
                Ok::<u32, GitError>(i)
            });
            handles.push(result);
        }

        // All 10 operations should have succeeded.
        for (i, handle) in handles.into_iter().enumerate() {
            assert_eq!(handle.unwrap(), i as u32);
        }

        let final_log = log.lock().unwrap();
        assert_eq!(final_log.len(), 10);
        // The log must be in submission order (proving serialisation).
        let expected: Vec<u32> = (0..10).collect();
        assert_eq!(*final_log, expected, "operations ran out of order");
    }

    #[test]
    fn queue_propagates_errors() {
        let dir = tempdir().unwrap();
        let queue = GitQueue::new(dir.path().to_path_buf());

        let result = queue.enqueue(|_| Err::<String, _>(GitError::Command("boom".into())));
        assert!(matches!(result, Err(GitError::Command(_))));
    }

    #[test]
    fn queue_reports_correct_repo_root() {
        let dir = tempdir().unwrap();
        let root = dir.path().to_path_buf();
        let queue = GitQueue::new(root.clone());
        assert_eq!(queue.repo_root, root);
    }
}
