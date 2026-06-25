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
}
