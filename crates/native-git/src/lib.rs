//! Native Git adapter with explicit argument boundaries.

pub mod conflict;
pub mod error;
pub mod status;
pub mod sync;

pub use conflict::{git_resolve_conflict, read_conflict_markers, GitConflictResolveOutput};
pub use error::GitError;
pub use status::{
    git_commit_selected, git_show_head_file, git_status, GitChangedFile, GitCommitOutput, GitStatus,
};
pub use sync::{git_pull, git_push, GitPullOutput, GitPushOutput};
