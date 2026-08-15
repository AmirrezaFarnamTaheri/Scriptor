use thiserror::Error;

#[derive(Debug, Error)]
pub enum GitError {
    #[error("git is not available on PATH")]
    GitMissing,
    #[error("not a git repository: {0}")]
    NotARepository(String),
    #[error("git command failed: {0}")]
    Command(String),
    #[error("io error: {0}")]
    Io(#[from] std::io::Error),
    /// Three-way merge produced conflict markers. `conflict_text` is the full
    /// file content with `<<<<<<<` / `=======` / `>>>>>>>` markers included.
    #[error("merge conflict in file")]
    MergeConflict { conflict_text: String },
}
