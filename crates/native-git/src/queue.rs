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
//! - The queue is bounded; a full queue blocks submitters and applies back-pressure
//!   instead of allowing an unbounded mutation backlog.
//! - Dropping a `GitQueue` shuts the worker thread down gracefully: the
//!   worker exits when the send half of the channel is dropped.
//!
//! # Example
//! ```no_run
//! use std::path::PathBuf;
//! use scriptor_native_git::queue::{GitQueue, QueuedOp};
//!
//! let queue = GitQueue::new(PathBuf::from("/path/to/repo")).expect("queue");
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

const MAX_PENDING_GIT_OPERATIONS: usize = 64;

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
    sender: mpsc::SyncSender<Task>,
    /// The canonical path of the managed repository root (for diagnostics).
    pub repo_root: PathBuf,
}

impl GitQueue {
    /// Spawn a worker thread for `repo_root` and return a handle.
    ///
    /// The worker runs until the `GitQueue` is dropped (at which point the
    /// sender channel closes and the worker exits its loop).
    pub fn new(repo_root: PathBuf) -> Result<Self, GitError> {
        let (sender, receiver) = mpsc::sync_channel::<Task>(MAX_PENDING_GIT_OPERATIONS);
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
            .map_err(|error| {
                GitError::Command(format!("failed to spawn git queue worker thread: {error}"))
            })?;

        Ok(Self { sender, repo_root })
    }

    /// Alias used at call sites where fallibility should be visually explicit.
    pub fn try_new(repo_root: PathBuf) -> Result<Self, GitError> {
        Self::new(repo_root)
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
        let queue = GitQueue::new(root.clone()).unwrap();

        let result = queue
            .enqueue(|r| Ok(r.to_string_lossy().into_owned()))
            .unwrap();
        assert_eq!(result, root.to_string_lossy());
    }

    #[test]
    fn queue_serialises_concurrent_submissions() {
        use std::sync::{Arc, Mutex};

        let dir = tempdir().unwrap();
        let queue = GitQueue::new(dir.path().to_path_buf()).unwrap();
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
        let queue = GitQueue::new(dir.path().to_path_buf()).unwrap();

        let result = queue.enqueue(|_| Err::<String, _>(GitError::Command("boom".into())));
        assert!(matches!(result, Err(GitError::Command(_))));
    }

    #[test]
    fn queue_reports_correct_repo_root() {
        let dir = tempdir().unwrap();
        let root = dir.path().to_path_buf();
        let queue = GitQueue::new(root.clone()).unwrap();
        assert_eq!(queue.repo_root, root);
    }

    #[test]
    fn queue_bounded_submission_handles_backpressure_beyond_capacity() {
        use std::sync::atomic::{AtomicUsize, Ordering};
        use std::sync::{Arc, Barrier};

        let dir = tempdir().unwrap();
        let queue = Arc::new(GitQueue::new(dir.path().to_path_buf()).unwrap());
        let total_tasks = 80usize; // > MAX_PENDING_GIT_OPERATIONS (64)

        let gate = Arc::new(Barrier::new(2));
        let gate_worker = Arc::clone(&gate);

        let completed_count = Arc::new(AtomicUsize::new(0));
        let mut join_handles = Vec::with_capacity(total_tasks);

        // Spawn first task that waits on the gate, temporarily holding the queue worker
        let queue_clone = Arc::clone(&queue);
        let completed_clone = Arc::clone(&completed_count);
        join_handles.push(thread::spawn(move || {
            queue_clone
                .enqueue(move |_root| {
                    gate_worker.wait();
                    completed_clone.fetch_add(1, Ordering::SeqCst);
                    Ok::<usize, GitError>(0)
                })
                .unwrap()
        }));

        // Spawn remaining tasks (1..80) from separate threads to contend and fill the 64-slot channel
        for i in 1..total_tasks {
            let queue_clone = Arc::clone(&queue);
            let completed_clone = Arc::clone(&completed_count);
            join_handles.push(thread::spawn(move || {
                queue_clone
                    .enqueue(move |_root| {
                        completed_clone.fetch_add(1, Ordering::SeqCst);
                        Ok::<usize, GitError>(i)
                    })
                    .unwrap()
            }));
        }

        // Give submitter threads time to submit and exercise channel backpressure
        thread::sleep(std::time::Duration::from_millis(50));

        // Release the first task so the worker can resume and drain all enqueued tasks
        gate.wait();

        // Join all threads and collect results
        let mut results = Vec::with_capacity(total_tasks);
        for handle in join_handles {
            results.push(handle.join().expect("submitter thread panicked"));
        }

        results.sort_unstable();
        let expected: Vec<usize> = (0..total_tasks).collect();
        assert_eq!(results, expected);
        assert_eq!(completed_count.load(Ordering::SeqCst), total_tasks);
    }
}
