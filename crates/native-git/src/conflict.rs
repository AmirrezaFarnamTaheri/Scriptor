use std::fs;
use std::path::Path;

use serde::{Deserialize, Serialize};

use crate::error::GitError;
use crate::merge3::{ConflictPolicy, merge3};
use crate::status::{git_show_merge_base_file, git_status, run_git};
// W2-9 (W1-3 hookup): write conflicted sidecar alongside the conflicted file.
use vault::{atomic_write, write_conflicted_sidecar};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct GitConflictResolveOutput {
    pub path: String,
    pub strategy: String,
}

// ── W1-2: Auto-merge command ─────────────────────────────────────────────────

/// Input for `git_automerge_conflict_cmd`.
///
/// The three-way merge is performed purely in Rust (no external merge tool).
/// `policy` is the tiebreaker when the algorithm cannot cleanly merge a hunk:
/// - `"ours"` / `"theirs"` → accept the chosen side automatically.
/// - `"diff3"` (default) → emit conflict markers for the user to review.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct AutoMergeInput {
    pub repo_root: String,
    pub path: String,
    /// Tiebreaker policy: `"ours"`, `"theirs"`, or `"diff3"` (default).
    #[serde(default = "default_policy")]
    pub policy: String,
}

fn default_policy() -> String {
    "diff3".into()
}

/// Outcome of `git_automerge_conflict_cmd`.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(tag = "outcome", rename_all = "snake_case")]
pub enum AutoMergeOutcome {
    /// No conflict markers remain; `merged` is the final file content.
    Clean { merged: String },
    /// One or more hunks could not be resolved; `merged` contains the diff3
    /// conflict markers for the `ConflictResolverModal` to render.
    Conflicted {
        merged: String,
        conflict_count: usize,
    },
}

/// Attempt a three-way merge of a conflicted file using the repo's three stages.
///
/// Reads `base` from the merge-base, `ours` and `theirs` from the respective
/// git object stores using `git show`, then applies `merge3` with the chosen
/// policy. Writes the result back to disk and stages it (via `git add`) only
/// when the merge is clean. If conflicts remain, the file is left unchanged
/// and the caller is expected to show the `ConflictResolverModal`.
pub fn git_automerge_conflict_cmd(
    repo_root: &Path,
    input: &AutoMergeInput,
) -> Result<AutoMergeOutcome, GitError> {
    let status = git_status(repo_root)?;
    if !status.is_repo {
        return Err(GitError::NotARepository(repo_root.display().to_string()));
    }

    let file_path = validate_conflict_path(repo_root, &input.path)?;
    if !file_path.exists() {
        return Err(GitError::Command(format!(
            "conflicted file not found: {}",
            input.path
        )));
    }

    let base = git_show_merge_base_file(repo_root, &input.path)
        .ok()
        .flatten()
        .unwrap_or_default();
    // Stage :2 = ours (HEAD side), :3 = theirs (MERGE_HEAD side).
    // git_show_stage returns a plain String (empty on missing stage).
    let ours = git_show_stage(repo_root, &input.path, 2);
    let theirs = git_show_stage(repo_root, &input.path, 3);

    // For auto-merge we use ConflictPolicy::Error so merge3 returns Err when
    // conflicts exist, giving us the conflict-marker text in GitError::MergeConflict.
    // Ours/Theirs policies resolve all hunks eagerly (no markers in output).
    let policy = match input.policy.as_str() {
        "ours" => ConflictPolicy::Ours,
        "theirs" => ConflictPolicy::Theirs,
        _ => ConflictPolicy::Error, // diff3: preserve markers for UI
    };

    match merge3(&base, &ours, &theirs, policy, None) {
        Ok(merge_output) => {
            // Clean merge — write and stage.
            write_resolved_conflict(&file_path, &merge_output.merged)?;
            run_git(repo_root, &["--literal-pathspecs", "add", "--", &input.path])?;
            Ok(AutoMergeOutcome::Clean {
                merged: merge_output.merged,
            })
        }
        Err(GitError::MergeConflict { conflict_text }) => {
            // Conflicts remain; count the markers so the UI knows how many.
            let conflict_count = conflict_text
                .lines()
                .filter(|l| l.starts_with("<<<<<<<"))
                .count();

            // W2-9 (W1-3 hookup): write a .conflicted.md sidecar atomically so
            // the conflict-marker text is never silently lost. A failure here is
            // non-fatal — we log a warning and continue so the UI still gets the
            // conflict information.
            if let Err(sidecar_err) = write_conflicted_sidecar(&file_path, &conflict_text) {
                eprintln!(
                    "[native-git] warning: could not write .conflicted.md sidecar for {:?}: {sidecar_err}",
                    input.path
                );
            }

            Ok(AutoMergeOutcome::Conflicted {
                merged: conflict_text,
                conflict_count,
            })
        }
        Err(other) => Err(other),
    }
}

fn validate_conflict_path(repo_root: &Path, path: &str) -> Result<std::path::PathBuf, GitError> {
    if path.contains('\0') || path.contains('\n') || path.contains('\r') {
        return Err(GitError::Command(format!(
            "invalid path characters: {path}"
        )));
    }
    // Reject only real parent-directory components. A substring check on ".."
    // also rejected legitimate names such as `notes..md` or `v1..2/report.md`.
    if std::path::Path::new(path)
        .components()
        .any(|component| matches!(component, std::path::Component::ParentDir))
    {
        return Err(GitError::Command(format!(
            "path traversal not allowed: {path}"
        )));
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
            return Err(GitError::Command(format!(
                "path escapes repository root: {path}"
            )));
        }
    } else {
        let normalized = normalize_path_components(&file_path);
        if !normalized.starts_with(&canonical_root) {
            return Err(GitError::Command(format!(
                "path escapes repository root: {path}"
            )));
        }
    }
    Ok(file_path)
}

fn normalize_path_components(path: &std::path::Path) -> std::path::PathBuf {
    let mut output = std::path::PathBuf::new();
    for component in path.components() {
        match component {
            std::path::Component::ParentDir => {
                output.pop();
            }
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
        return Err(GitError::Command(format!(
            "conflicted file not found: {path}"
        )));
    }

    let stage_flag = if strategy == "ours" {
        "--ours"
    } else {
        "--theirs"
    };
    run_git(
        repo_root,
        &["--literal-pathspecs", "checkout", stage_flag, "--", path],
    )?;
    run_git(repo_root, &["--literal-pathspecs", "add", "--", path])?;

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
        return Err(GitError::Command(format!(
            "conflicted file not found: {path}"
        )));
    }

    write_resolved_conflict(&file_path, merged_markdown)?;
    run_git(repo_root, &["--literal-pathspecs", "add", "--", path])?;

    Ok(GitConflictResolveOutput {
        path: path.to_string(),
        strategy: "merged".into(),
    })
}

fn write_resolved_conflict(path: &Path, markdown: &str) -> Result<(), GitError> {
    atomic_write(path, markdown.as_bytes()).map_err(|error| {
        GitError::Command(format!(
            "failed to atomically write resolved conflict {}: {error}",
            path.display()
        ))
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

/// Read a file from the git index at the given stage (1=base, 2=ours, 3=theirs).
///
/// Returns `Ok("")` when the stage does not exist (e.g. the file was added on
/// one side only), so callers can treat an absent ancestor as an empty string.
fn git_show_stage(repo_root: &Path, path: &str, stage: u8) -> String {
    let normalized = path.replace('\\', "/");
    let spec = format!(":{stage}:{normalized}");
    run_git(repo_root, &["show", &spec]).unwrap_or_default()
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn accepts_filenames_containing_a_literal_double_dot() {
        let dir = tempdir().expect("tempdir");
        let root = dir.path().canonicalize().expect("canonicalize");
        for name in [
            "notes..md",
            "v1..2/report.md",
            "..leading.md",
            "trailing..md",
        ] {
            validate_conflict_path(&root, name)
                .unwrap_or_else(|error| panic!("{name} should be accepted: {error}"));
        }
    }

    #[test]
    fn rejects_parent_directory_components() {
        let dir = tempdir().expect("tempdir");
        let root = dir.path().canonicalize().expect("canonicalize");
        for name in ["../escape.md", "notes/../../escape.md", ".."] {
            assert!(
                validate_conflict_path(&root, name).is_err(),
                "{name} should be rejected"
            );
        }
    }

    #[test]
    fn rejects_control_characters() {
        let dir = tempdir().expect("tempdir");
        let root = dir.path().canonicalize().expect("canonicalize");
        assert!(validate_conflict_path(&root, "bad\nname.md").is_err());
        assert!(validate_conflict_path(&root, "bad\0name.md").is_err());
    }

    #[test]
    fn writes_resolved_content_through_atomic_write_boundary() {
        let dir = tempdir().expect("tempdir");
        let file = dir.path().join("conflict.md");
        fs::write(&file, "old content").expect("seed file");

        write_resolved_conflict(&file, "resolved content").expect("atomic write");

        assert_eq!(
            fs::read_to_string(&file).expect("read result"),
            "resolved content"
        );
    }
}
