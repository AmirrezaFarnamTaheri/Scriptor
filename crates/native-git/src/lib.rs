//! Native Git adapter with explicit argument boundaries.

pub mod conflict;
pub mod error;
pub mod merge3;
pub mod queue;
pub mod status;
pub mod sync;

pub use conflict::{
    AutoMergeInput, AutoMergeOutcome, GitConflictResolveOutput, git_apply_merged_conflict,
    git_automerge_conflict_cmd, git_resolve_conflict, read_conflict_markers,
};
pub use error::GitError;
pub use merge3::{ConflictPolicy, MergeOutput, merge3};
pub use queue::{GitQueue, QueuedOp};
pub use status::{
    GitChangedFile, GitCommitOutput, GitStatus, git_commit_selected, git_show_head_file,
    git_show_merge_base_file, git_status,
};
pub use sync::{GitPullOutput, GitPushOutput, PullStrategy, git_pull, git_push};
