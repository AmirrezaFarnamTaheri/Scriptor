use std::path::Path;

use serde::{Deserialize, Serialize};

use crate::error::GitError;
use crate::status::{git_status, run_git};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct GitPullOutput {
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct GitPushOutput {
    pub message: String,
}

pub fn git_pull(repo_root: &Path) -> Result<GitPullOutput, GitError> {
    if !has_upstream(repo_root) {
        return Err(GitError::Command("no upstream branch configured".into()));
    }

    let status = git_status(repo_root)?;
    if status.has_conflicts {
        return Err(GitError::Command(
            "resolve merge conflicts before pulling".into(),
        ));
    }

    let message = run_git(repo_root, &["pull", "--ff-only"])?;
    Ok(GitPullOutput { message })
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

fn has_upstream(repo_root: &Path) -> bool {
    std::process::Command::new("git")
        .current_dir(repo_root)
        .args(["rev-parse", "--abbrev-ref", "@{upstream}"])
        .output()
        .map(|output| output.status.success())
        .unwrap_or(false)
}
