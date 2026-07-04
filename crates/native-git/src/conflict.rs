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

fn validate_conflict_path(repo_root: &Path, path: &str) -> Result<std::path::PathBuf, GitError> {
    if path.contains('\0') || path.contains('\n') || path.contains('\r') {
        return Err(GitError::Command(format!("invalid path characters: {path}")));
    }
    if path.contains("..") {
        return Err(GitError::Command(format!("path traversal not allowed: {path}")));
    }
    let file_path = repo_root.join(path);
    let canonical_root = repo_root
        .canonicalize()
        .map_err(|e| GitError::Command(format!("cannot canonicalize repo root: {e}")))?;
    if file_path.exists() {
        let canonical_file = file_path
            .canonicalize()
            .map_err(|e| GitError::Command(format!("cannot canonicalize file path: {e}")))?;
        if !canonical_file.starts_with(&canonical_root) {
            return Err(GitError::Command(format!("path escapes repository root: {path}")));
        }
    } else {
        let normalized = normalize_path_components(&file_path);
        if !normalized.starts_with(&canonical_root) {
            return Err(GitError::Command(format!("path escapes repository root: {path}")));
        }
    }
    Ok(file_path)
}

fn normalize_path_components(path: &std::path::Path) -> std::path::PathBuf {
    let mut output = std::path::PathBuf::new();
    for component in path.components() {
        match component {
            std::path::Component::ParentDir => { output.pop(); }
            std::path::Component::CurDir => {}
            std::path::Component::Normal(part) => output.push(part),
            std::path::Component::RootDir => output.push(std::path::MAIN_SEPARATOR_STR),
            std::path::Component::Prefix(prefix) => output.push(prefix.as_os_str()),
        }
    }
    output
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

    let file_path = validate_conflict_path(repo_root, path)?;
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

pub fn git_apply_merged_conflict(
    repo_root: &Path,
    path: &str,
    merged_markdown: &str,
) -> Result<GitConflictResolveOutput, GitError> {
    let status = git_status(repo_root)?;
    if !status.is_repo {
        return Err(GitError::NotARepository(repo_root.display().to_string()));
    }

    let file_path = validate_conflict_path(repo_root, path)?;
    if !file_path.exists() {
        return Err(GitError::Command(format!("conflicted file not found: {path}")));
    }

    fs::write(&file_path, merged_markdown).map_err(GitError::Io)?;
    run_git(repo_root, &["add", "--", path])?;

    Ok(GitConflictResolveOutput {
        path: path.to_string(),
        strategy: "merged".into(),
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
