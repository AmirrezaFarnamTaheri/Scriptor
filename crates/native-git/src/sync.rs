use std::path::Path;

use serde::{Deserialize, Serialize};

use crate::error::GitError;
use crate::status::{git_status, run_git};

// ── Output types ──────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct GitPullOutput {
    pub message: String,
    /// Which strategy was actually used.
    pub strategy: PullStrategy,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct GitPushOutput {
    pub message: String,
}

// ── PullStrategy ──────────────────────────────────────────────────────────────

/// The merge strategy to use when pulling from a remote.
///
/// This is always an explicit user choice. `git_pull` never infers a default:
/// callers must supply a `PullStrategy`. This matches the plan requirement that
/// "strategy is always a user choice, never inferred" (W1-5).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "kebab-case")]
pub enum PullStrategy {
    /// Equivalent to `git pull --ff-only`. Fails if the remote has diverged.
    #[default]
    FastForward,
    /// Equivalent to `git pull --no-rebase`. Creates a merge commit on divergence.
    Merge,
    /// Equivalent to `git pull --rebase`. Rewrites local commits on top of the remote.
    Rebase,
}

impl PullStrategy {
    fn as_git_flag(self) -> &'static str {
        match self {
            PullStrategy::FastForward => "--ff-only",
            PullStrategy::Merge => "--no-rebase",
            PullStrategy::Rebase => "--rebase",
        }
    }
}

// ── Public functions ──────────────────────────────────────────────────────────

/// Pull from the configured upstream using an explicit `strategy`.
///
/// Pre-flight: refuses when the working tree has unresolved conflicts
/// (matches the invariant that `has_conflicts` must be clear before any sync
/// operation).
pub fn git_pull(repo_root: &Path, strategy: PullStrategy) -> Result<GitPullOutput, GitError> {
    if !has_upstream(repo_root) {
        return Err(GitError::Command("no upstream branch configured".into()));
    }

    let status = git_status(repo_root)?;
    if status.has_conflicts {
        return Err(GitError::Command(
            "resolve merge conflicts before pulling".into(),
        ));
    }

    let message = run_git(repo_root, &["pull", strategy.as_git_flag()])?;
    Ok(GitPullOutput { message, strategy })
}

pub fn git_push(repo_root: &Path) -> Result<GitPushOutput, GitError> {
    if !has_upstream(repo_root) {
        return Err(GitError::Command("no upstream branch configured".into()));
    }

    let status = git_status(repo_root)?;
    if status.has_conflicts {
        return Err(GitError::Command(
            "resolve merge conflicts before pushing".into(),
        ));
    }

    let message = run_git(repo_root, &["push"])?;
    Ok(GitPushOutput { message })
}

// ── Helpers ───────────────────────────────────────────────────────────────────

fn has_upstream(repo_root: &Path) -> bool {
    std::process::Command::new("git")
        .current_dir(repo_root)
        .args(["rev-parse", "--abbrev-ref", "@{upstream}"])
        .output()
        .map(|output| output.status.success())
        .unwrap_or(false)
}

// ── Tests ─────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn pull_strategy_serialises_to_kebab_case() {
        let ff = serde_json::to_string(&PullStrategy::FastForward).unwrap();
        let mg = serde_json::to_string(&PullStrategy::Merge).unwrap();
        let rb = serde_json::to_string(&PullStrategy::Rebase).unwrap();
        assert_eq!(ff, "\"fast-forward\"");
        assert_eq!(mg, "\"merge\"");
        assert_eq!(rb, "\"rebase\"");
    }

    #[test]
    fn pull_strategy_git_flags() {
        assert_eq!(PullStrategy::FastForward.as_git_flag(), "--ff-only");
        assert_eq!(PullStrategy::Merge.as_git_flag(), "--no-rebase");
        assert_eq!(PullStrategy::Rebase.as_git_flag(), "--rebase");
    }

    #[test]
    fn pull_output_roundtrips_strategy() {
        let out = GitPullOutput {
            message: "ok".into(),
            strategy: PullStrategy::Rebase,
        };
        let json = serde_json::to_string(&out).unwrap();
        let back: GitPullOutput = serde_json::from_str(&json).unwrap();
        assert_eq!(back.strategy, PullStrategy::Rebase);
    }
}
