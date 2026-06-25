use std::path::Path;
use std::process::Command;

use serde::{Deserialize, Serialize};

use crate::error::GitError;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct GitChangedFile {
    pub path: String,
    pub status: String,
    pub conflict: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct GitStatus {
    pub is_repo: bool,
    pub branch: Option<String>,
    pub changed_files: Vec<GitChangedFile>,
    pub clean: bool,
    pub ahead: u32,
    pub behind: u32,
    pub has_upstream: bool,
    pub has_conflicts: bool,
    pub conflicted_files: Vec<GitChangedFile>,
}

pub fn git_status(repo_root: &Path) -> Result<GitStatus, GitError> {
    if !is_git_repo(repo_root)? {
        return Ok(GitStatus {
            is_repo: false,
            branch: None,
            changed_files: Vec::new(),
            clean: true,
            ahead: 0,
            behind: 0,
            has_upstream: false,
            has_conflicts: false,
            conflicted_files: Vec::new(),
        });
    }

    let branch = current_branch(repo_root).ok();
    let porcelain = run_git(repo_root, &["status", "--porcelain=1", "-uall"])?;
    let changed_files = parse_porcelain(&porcelain);
    let conflicted_files: Vec<GitChangedFile> = changed_files
        .iter()
        .filter(|file| file.conflict)
        .cloned()
        .collect();
    let has_conflicts = !conflicted_files.is_empty();
    let clean = changed_files.is_empty();
    let (ahead, behind, has_upstream) = read_sync_counts(repo_root);

    Ok(GitStatus {
        is_repo: true,
        branch,
        changed_files,
        clean,
        ahead,
        behind,
        has_upstream,
        has_conflicts,
        conflicted_files,
    })
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct GitCommitOutput {
    pub commit_hash: String,
    pub files_committed: Vec<String>,
}

pub fn git_commit_selected(
    repo_root: &Path,
    files: &[String],
    message: &str,
) -> Result<GitCommitOutput, GitError> {
    if files.is_empty() {
        return Err(GitError::Command("no files selected for commit".into()));
    }

    if !is_git_repo(repo_root)? {
        return Err(GitError::NotARepository(repo_root.display().to_string()));
    }

    let mut add_args = vec!["add".to_string(), "--".to_string()];
    add_args.extend(files.iter().cloned());
    run_git(repo_root, &add_args.iter().map(String::as_str).collect::<Vec<_>>())?;

    run_git(repo_root, &["commit", "-m", message])?;

    let hash = run_git(repo_root, &["rev-parse", "HEAD"])?;

    Ok(GitCommitOutput {
        commit_hash: hash,
        files_committed: files.to_vec(),
    })
}

fn is_git_repo(repo_root: &Path) -> Result<bool, GitError> {
    let output = Command::new("git")
        .current_dir(repo_root)
        .args(["rev-parse", "--is-inside-work-tree"])
        .output()
        .map_err(|_| GitError::GitMissing)?;

    if !output.status.success() {
        return Ok(false);
    }

    Ok(String::from_utf8_lossy(&output.stdout).trim() == "true")
}

fn current_branch(repo_root: &Path) -> Result<String, GitError> {
    run_git(
        repo_root,
        &["rev-parse", "--abbrev-ref", "HEAD"],
    )
}

pub(crate) fn run_git(repo_root: &Path, args: &[&str]) -> Result<String, GitError> {
    let output = Command::new("git")
        .current_dir(repo_root)
        .args(args)
        .output()
        .map_err(|_| GitError::GitMissing)?;

    if !output.status.success() {
        return Err(GitError::Command(format!(
            "git {} failed: {}",
            args.join(" "),
            String::from_utf8_lossy(&output.stderr)
        )));
    }

    Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
}

fn parse_porcelain(output: &str) -> Vec<GitChangedFile> {
    output
        .lines()
        .filter_map(|line| {
            if line.len() < 3 {
                return None;
            }
            let raw_code = &line[..2];
            let path = line[2..].trim_start();
            if path.is_empty() {
                return None;
            }
            Some(GitChangedFile {
                path: path.to_string(),
                status: map_status(raw_code.trim()),
                conflict: is_conflict_code(raw_code),
            })
        })
        .collect()
}

fn map_status(code: &str) -> String {
    match code {
        "M" | "MM" | "AM" => "modified".into(),
        "A" | "??" => "added".into(),
        "D" => "deleted".into(),
        "R" => "renamed".into(),
        "UU" | "AA" | "DD" | "AU" | "UA" | "DU" | "UD" => "conflict".into(),
        _ => code.to_ascii_lowercase(),
    }
}

fn is_conflict_code(code: &str) -> bool {
    matches!(code, "UU" | "AA" | "DD" | "AU" | "UA" | "DU" | "UD")
}

fn read_sync_counts(repo_root: &Path) -> (u32, u32, bool) {
    let has_upstream = std::process::Command::new("git")
        .current_dir(repo_root)
        .args(["rev-parse", "--abbrev-ref", "@{upstream}"])
        .output()
        .map(|output| output.status.success())
        .unwrap_or(false);

    if !has_upstream {
        return (0, 0, false);
    }

    let Ok(output) = run_git(
        repo_root,
        &["rev-list", "--left-right", "--count", "HEAD...@{upstream}"],
    ) else {
        return (0, 0, true);
    };

    let mut parts = output.split('\t');
    let behind = parts.next().and_then(|value| value.parse().ok()).unwrap_or(0);
    let ahead = parts.next().and_then(|value| value.parse().ok()).unwrap_or(0);
    (ahead, behind, true)
}

pub fn git_show_head_file(repo_root: &Path, path: &str) -> Result<Option<String>, GitError> {
    if !is_git_repo(repo_root)? {
        return Ok(None);
    }

    let normalized = path.replace('\\', "/");
    let spec = format!("HEAD:{normalized}");
    match run_git(repo_root, &["show", &spec]) {
        Ok(content) => Ok(Some(content)),
        Err(GitError::Command(_)) => Ok(None),
        Err(error) => Err(error),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::process::Command;
    use tempfile::tempdir;

    fn configure_git_identity(repo: &Path) -> Result<(), Box<dyn std::error::Error>> {
        for (key, value) in [("user.name", "Scriptor Test"), ("user.email", "scriptor@test.local")] {
            let output = Command::new("git")
                .current_dir(repo)
                .args(["config", key, value])
                .output()?;
            if !output.status.success() {
                return Err(format!(
                    "git config {key} failed: {}",
                    String::from_utf8_lossy(&output.stderr)
                )
                .into());
            }
        }
        Ok(())
    }

    fn git_commit(repo: &Path, message: &str) -> Result<(), Box<dyn std::error::Error>> {
        let output = Command::new("git")
            .current_dir(repo)
            .args(["commit", "-m", message])
            .output()?;
        if !output.status.success() {
            return Err(format!(
                "git commit failed: {}",
                String::from_utf8_lossy(&output.stderr)
            )
            .into());
        }
        Ok(())
    }

    #[test]
    fn detects_conflict_entries_from_porcelain() {
        let files = parse_porcelain("UU notes/conflict.md\n");
        assert_eq!(files.len(), 1);
        assert!(files[0].conflict);
        assert_eq!(files[0].status, "conflict");
    }

    #[test]
    fn reports_changes_in_fixture_repo() -> Result<(), Box<dyn std::error::Error>> {
        let dir = tempdir()?;
        Command::new("git")
            .args(["init", dir.path().to_str().unwrap()])
            .output()?;
        fs::write(dir.path().join("note.md"), "# Note\n")?;

        let status = git_status(dir.path())?;
        assert!(status.is_repo);
        assert!(!status.clean);
        assert_eq!(status.changed_files.len(), 1);
        Ok(())
    }

    #[test]
    fn show_head_returns_committed_content() -> Result<(), Box<dyn std::error::Error>> {
        let dir = tempdir()?;
        Command::new("git")
            .args(["init", dir.path().to_str().unwrap()])
            .output()?;
        fs::write(dir.path().join("note.md"), "# Committed\n")?;
        Command::new("git")
            .current_dir(dir.path())
            .args(["add", "note.md"])
            .output()?;
        configure_git_identity(dir.path())?;
        git_commit(dir.path(), "init")?;
        fs::write(dir.path().join("note.md"), "# Working\n")?;

        let head = git_show_head_file(dir.path(), "note.md")?.unwrap_or_default();
        assert!(head.contains("Committed"));
        Ok(())
    }
}
