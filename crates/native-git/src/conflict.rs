use std::fs;
use std::path::Path;

use serde::{Deserialize, Serialize};

use crate::error::GitError;
use crate::status::git_status;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct GitConflictResolveOutput {
    pub path: String,
    pub strategy: String,
}

pub fn git_resolve_conflict(
    repo_root: &Path,
    path: &str,
    strategy: &str,
) -> Result<GitConflictResolveOutput, GitError> {
    let status = git_status(repo_root)?;
    if !status.is_repo {
        return Err(GitError::NotARepository(repo_root.display().to_string()));
    }

    let allowed = ["ours", "theirs"];
    if !allowed.contains(&strategy) {
        return Err(GitError::Command(format!(
            "unsupported conflict strategy: {strategy}"
        )));
    }

    let file_path = repo_root.join(path);
    if !file_path.exists() {
        return Err(GitError::Command(format!("conflicted file not found: {path}")));
    }

    let stage_flag = if strategy == "ours" { "--ours" } else { "--theirs" };
    run_git(repo_root, &["checkout", stage_flag, "--", path])?;
    run_git(repo_root, &["add", "--", path])?;

    Ok(GitConflictResolveOutput {
        path: path.to_string(),
        strategy: strategy.to_string(),
    })
}

pub fn read_conflict_markers(path: &Path) -> Result<Vec<String>, GitError> {
    let raw = fs::read_to_string(path).map_err(GitError::Io)?;
    let mut blocks = Vec::new();
    let mut current = String::new();
    let mut in_conflict = false;
    for line in raw.lines() {
        if line.starts_with("<<<<<<<") {
            in_conflict = true;
            current.clear();
            continue;
        }
        if line.starts_with("=======") && in_conflict {
            blocks.push(current.trim().to_string());
            current.clear();
            continue;
        }
        if line.starts_with(">>>>>>>") && in_conflict {
            blocks.push(current.trim().to_string());
            in_conflict = false;
            continue;
        }
        if in_conflict {
            current.push_str(line);
            current.push('\n');
        }
    }
    Ok(blocks)
}

fn run_git(repo_root: &Path, args: &[&str]) -> Result<String, GitError> {
    let output = std::process::Command::new("git")
        .current_dir(repo_root)
        .args(args)
        .output()
        .map_err(GitError::Io)?;
    if !output.status.success() {
        return Err(GitError::Command(
            String::from_utf8_lossy(&output.stderr).trim().to_string(),
        ));
    }
    Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
}
