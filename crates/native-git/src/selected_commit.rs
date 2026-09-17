use std::collections::HashSet;
use std::ffi::OsString;
use std::path::{Component, Path, PathBuf};
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use scriptor_system_bridge::{ProcessReceipt, ProcessSpec, run_process};

use crate::error::GitError;
use crate::status::{GitCommitOutput, GitStatus, git_status, run_git};

/// Commit a reviewed set of paths without bypassing Git's normal commit
/// machinery. Ordinary selected-file commits use a temporary index so
/// unrelated staging is preserved while hooks/signing still run. In-progress
/// merges deliberately use the real merge index: it is the authoritative
/// resolved tree and must not be reconstructed from the worktree.
pub fn git_commit_selected(
    repo_root: &Path,
    files: &[String],
    message: &str,
) -> Result<GitCommitOutput, GitError> {
    if files.is_empty() {
        return Err(GitError::Command("no files selected for commit".into()));
    }
    if message.trim().is_empty() {
        return Err(GitError::Command("commit message must not be empty".into()));
    }
    let status = git_status(repo_root)?;
    if !status.is_repo {
        return Err(GitError::NotARepository(repo_root.display().to_string()));
    }
    for file in files {
        validate_selected_path(file)?;
    }
    if is_sequencer_in_progress(repo_root)? {
        return Err(GitError::Command(
            "cannot commit while cherry-pick or revert sequencer is in progress".into(),
        ));
    }

    let selected_paths = expand_selected_paths(&status, files);
    let old_head = git_metadata(run_git(repo_root, &["rev-parse", "HEAD"])?)?;
    let is_merging = git_path(repo_root, "MERGE_HEAD")?.exists();

    let new_commit = if is_merging {
        commit_merge_index(repo_root, &status, &selected_paths, message)?
    } else {
        commit_selected_with_temporary_index(repo_root, &selected_paths, message, &old_head)?
    };

    let committed = run_git(
        repo_root,
        &[
            "diff-tree",
            "--no-commit-id",
            "--name-only",
            "-r",
            "--root",
            "-m",
            &new_commit,
        ],
    )?;
    let mut files_committed: Vec<String> = committed
        .lines()
        .filter(|line| !line.trim().is_empty())
        .map(str::to_string)
        .collect();
    files_committed.sort();
    files_committed.dedup();

    Ok(GitCommitOutput {
        commit_hash: new_commit,
        files_committed,
    })
}

fn commit_merge_index(
    repo_root: &Path,
    status: &GitStatus,
    selected_paths: &[String],
    message: &str,
) -> Result<String, GitError> {
    if status.has_conflicts {
        return Err(GitError::Command(
            "cannot commit while merge conflicts are unresolved".into(),
        ));
    }

    // During a merge the real index is the resolved merge tree. Only staged
    // index paths are part of that tree; unrelated unstaged/untracked worktree
    // files must not block the merge.
    let staged = staged_paths(repo_root)?;
    let selected: HashSet<&str> = selected_paths.iter().map(String::as_str).collect();
    if staged.iter().any(|path| !selected.contains(path.as_str())) {
        return Err(GitError::Command(
            "cannot do a partial commit during a merge".into(),
        ));
    }

    // `git commit` owns the merge transaction. It commits the staged merge
    // resolution (not later unstaged edits), runs hooks/signing, advances HEAD,
    // and only then removes MERGE_HEAD/MERGE_MSG/etc. Git itself therefore
    // provides transactional merge-state cleanup instead of hand-deleting
    // state files before the ref update.
    run_git(repo_root, &["commit", "-m", message])?;
    git_metadata(run_git(repo_root, &["rev-parse", "HEAD"])?)
}

fn commit_selected_with_temporary_index(
    repo_root: &Path,
    selected_paths: &[String],
    message: &str,
    old_head: &str,
) -> Result<String, GitError> {
    let real_index = repository_index_path(repo_root)?;
    let original_index = std::fs::read(&real_index).ok();
    let temp_index = temporary_index_path(repo_root)?;
    let _temp_index_guard = TemporaryIndex::new(temp_index.clone());

    run_git_with_index(repo_root, &temp_index, &["read-tree", old_head])?;
    let mut add_args = vec![
        "--literal-pathspecs".to_string(),
        "add".to_string(),
        "--all".to_string(),
        "--".to_string(),
    ];
    add_args.extend(selected_paths.iter().cloned());
    run_git_with_index_owned(repo_root, &temp_index, &add_args)?;

    // A real `git commit` preserves normal repository policy: pre-commit,
    // prepare-commit-msg, commit-msg, post-commit and configured commit signing.
    // The temporary index contains only the reviewed selection.
    run_git_with_index(repo_root, &temp_index, &["commit", "-m", message])?;
    let new_commit = git_metadata(run_git(repo_root, &["rev-parse", "HEAD"])?)?;

    if let Err(error) = reset_committed_paths_in_real_index(repo_root, selected_paths) {
        let rollback_result = run_git(repo_root, &["update-ref", "HEAD", old_head, &new_commit]);
        let restore_result = restore_index(&real_index, original_index.as_deref());
        return Err(GitError::Command(format!(
            "failed to reconcile selected paths after commit: {error}; branch rollback: {}; index restore: {}",
            format_result(&rollback_result),
            format_result(&restore_result)
        )));
    }

    Ok(new_commit)
}

fn staged_paths(repo_root: &Path) -> Result<Vec<String>, GitError> {
    let output = run_git(
        repo_root,
        &["diff", "--cached", "--name-only", "-z", "HEAD", "--"],
    )?;
    Ok(output
        .split('\0')
        .filter(|path| !path.is_empty())
        .map(str::to_string)
        .collect())
}

fn expand_selected_paths(status: &GitStatus, files: &[String]) -> Vec<String> {
    let selected = files.iter().map(String::as_str).collect::<HashSet<_>>();
    let mut expanded = files.to_vec();
    for changed in &status.changed_files {
        let original_selected = changed
            .original_path
            .as_deref()
            .is_some_and(|original| selected.contains(original));
        if selected.contains(changed.path.as_str()) || original_selected {
            expanded.push(changed.path.clone());
            if let Some(original) = &changed.original_path {
                expanded.push(original.clone());
            }
        }
    }
    expanded.sort();
    expanded.dedup();
    expanded
}

fn validate_selected_path(path: &str) -> Result<(), GitError> {
    if path.is_empty() || path.contains('\0') {
        return Err(GitError::Command(
            "selected path is empty or contains NUL".into(),
        ));
    }
    let parsed = Path::new(path);
    if parsed.is_absolute()
        || parsed.components().any(|component| {
            matches!(
                component,
                Component::ParentDir | Component::RootDir | Component::Prefix(_)
            )
        })
    {
        return Err(GitError::Command(format!(
            "selected path escapes repository: {path}"
        )));
    }
    Ok(())
}

fn is_sequencer_in_progress(repo_root: &Path) -> Result<bool, GitError> {
    Ok(git_path(repo_root, "CHERRY_PICK_HEAD")?.exists()
        || git_path(repo_root, "REVERT_HEAD")?.exists())
}

fn git_path(repo_root: &Path, name: &str) -> Result<PathBuf, GitError> {
    let raw = git_metadata(run_git(repo_root, &["rev-parse", "--git-path", name])?)?;
    let path = PathBuf::from(raw);
    Ok(if path.is_absolute() {
        path
    } else {
        repo_root.join(path)
    })
}

fn repository_index_path(repo_root: &Path) -> Result<PathBuf, GitError> {
    git_path(repo_root, "index")
}

fn temporary_index_path(repo_root: &Path) -> Result<PathBuf, GitError> {
    let git_dir = git_metadata(run_git(repo_root, &["rev-parse", "--absolute-git-dir"])?)?;
    let nonce = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_nanos();
    Ok(PathBuf::from(git_dir).join(format!(
        "scriptor-selected-index-{}-{nonce}",
        std::process::id()
    )))
}

struct TemporaryIndex {
    path: PathBuf,
}

impl TemporaryIndex {
    fn new(path: PathBuf) -> Self {
        Self { path }
    }
}

impl Drop for TemporaryIndex {
    fn drop(&mut self) {
        let _ = std::fs::remove_file(&self.path);
        let mut lock_path = self.path.as_os_str().to_os_string();
        lock_path.push(".lock");
        let _ = std::fs::remove_file(PathBuf::from(lock_path));
    }
}

fn reset_committed_paths_in_real_index(repo_root: &Path, paths: &[String]) -> Result<(), GitError> {
    let mut args = vec![
        "--literal-pathspecs".to_string(),
        "reset".to_string(),
        "--quiet".to_string(),
        "HEAD".to_string(),
        "--".to_string(),
    ];
    args.extend(paths.iter().cloned());
    let borrowed = args.iter().map(String::as_str).collect::<Vec<_>>();
    run_git(repo_root, &borrowed).map(|_| ())
}

fn restore_index(path: &Path, original: Option<&[u8]>) -> Result<(), GitError> {
    match original {
        Some(bytes) => std::fs::write(path, bytes)
            .map_err(|error| GitError::Command(format!("failed to restore index: {error}"))),
        None => match std::fs::remove_file(path) {
            Ok(()) => Ok(()),
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(()),
            Err(error) => Err(GitError::Command(format!(
                "failed to remove newly created index: {error}"
            ))),
        },
    }
}

fn format_result<T>(result: &Result<T, GitError>) -> String {
    match result {
        Ok(_) => "ok".to_string(),
        Err(error) => error.to_string(),
    }
}

fn git_metadata(output: String) -> Result<String, GitError> {
    let value = output.trim_end_matches(['\r', '\n']).to_string();
    if value.is_empty() {
        return Err(GitError::Command("git returned empty metadata".into()));
    }
    Ok(value)
}

fn run_git_with_index(repo_root: &Path, index: &Path, args: &[&str]) -> Result<String, GitError> {
    let receipt = run_git_receipt_with_index(repo_root, args, index)?;
    if receipt.exit_code != 0 {
        return Err(GitError::Command(format!(
            "git {} failed: {}",
            args.join(" "),
            receipt.stderr.trim()
        )));
    }
    Ok(receipt.stdout)
}

fn run_git_with_index_owned(
    repo_root: &Path,
    index: &Path,
    args: &[String],
) -> Result<String, GitError> {
    let borrowed = args.iter().map(String::as_str).collect::<Vec<_>>();
    run_git_with_index(repo_root, index, &borrowed)
}

fn run_git_receipt_with_index(
    repo_root: &Path,
    args: &[&str],
    index: &Path,
) -> Result<ProcessReceipt, GitError> {
    let mut spec = ProcessSpec::new("git")
        .args(args.iter().copied())
        .current_dir(repo_root)
        .timeout(Duration::from_secs(30))
        .max_output_bytes(256 * 1024)
        .env("GIT_TERMINAL_PROMPT", "0")
        .env("GCM_INTERACTIVE", "Never")
        .env("GIT_INDEX_FILE", index.as_os_str());
    for (key, value) in git_transport_environment() {
        spec = spec.env(key, value);
    }
    let receipt = run_process(spec).map_err(GitError::Process)?;
    reject_truncated_output(&args.join(" "), receipt)
}

const GIT_TRANSPORT_ENVIRONMENT: [&str; 5] = [
    "SSH_AUTH_SOCK",
    "SSH_AGENT_PID",
    "GIT_ASKPASS",
    "SSH_ASKPASS",
    "SSH_ASKPASS_REQUIRE",
];

fn git_transport_environment() -> Vec<(OsString, OsString)> {
    GIT_TRANSPORT_ENVIRONMENT
        .iter()
        .filter_map(|key| std::env::var_os(key).map(|value| ((*key).into(), value)))
        .collect()
}

fn reject_truncated_output(
    command: &str,
    receipt: ProcessReceipt,
) -> Result<ProcessReceipt, GitError> {
    if receipt.stdout_truncated {
        return Err(GitError::OutputTruncated {
            command: command.to_string(),
            stream: "stdout",
        });
    }
    if receipt.stderr_truncated {
        return Err(GitError::OutputTruncated {
            command: command.to_string(),
            stream: "stderr",
        });
    }
    Ok(receipt)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::process::Command;
    use tempfile::tempdir;

    fn git(repo: &Path, args: &[&str]) -> Result<String, Box<dyn std::error::Error>> {
        let output = Command::new("git").current_dir(repo).args(args).output()?;
        if !output.status.success() {
            return Err(format!(
                "git {} failed: {}",
                args.join(" "),
                String::from_utf8_lossy(&output.stderr)
            )
            .into());
        }
        Ok(String::from_utf8(output.stdout)?)
    }

    fn init(repo: &Path) -> Result<(), Box<dyn std::error::Error>> {
        git(repo, &["init", "-b", "main"])?;
        git(repo, &["config", "user.name", "Scriptor Test"])?;
        git(repo, &["config", "user.email", "scriptor@test.local"])?;
        Ok(())
    }

    fn create_conflicted_merge(repo: &Path) -> Result<(), Box<dyn std::error::Error>> {
        init(repo)?;
        fs::write(repo.join("file.md"), "base\n")?;
        fs::write(repo.join("unrelated.md"), "unchanged\n")?;
        git(repo, &["add", "."])?;
        git(repo, &["commit", "-m", "base"])?;
        git(repo, &["checkout", "-b", "feature"])?;
        fs::write(repo.join("file.md"), "feature\n")?;
        git(repo, &["commit", "-am", "feature"])?;
        git(repo, &["checkout", "main"])?;
        fs::write(repo.join("file.md"), "main\n")?;
        git(repo, &["commit", "-am", "main"])?;
        let merge = Command::new("git")
            .current_dir(repo)
            .args(["merge", "feature"])
            .output()?;
        if merge.status.success() {
            return Err("test merge unexpectedly succeeded".into());
        }
        Ok(())
    }

    #[test]
    fn selected_commit_preserves_unrelated_staging_and_commits_untracked_file()
    -> Result<(), Box<dyn std::error::Error>> {
        let dir = tempdir()?;
        init(dir.path())?;
        fs::write(dir.path().join("base.md"), "base\n")?;
        fs::write(dir.path().join("unrelated.md"), "u0\n")?;
        git(dir.path(), &["add", "."])?;
        git(dir.path(), &["commit", "-m", "base"])?;

        fs::write(dir.path().join("unrelated.md"), "u1 staged\n")?;
        git(dir.path(), &["add", "unrelated.md"])?;
        let unrelated_before = git(dir.path(), &["ls-files", "--stage", "--", "unrelated.md"])?;
        fs::write(dir.path().join("new.md"), "selected new file\n")?;

        let output = git_commit_selected(dir.path(), &["new.md".into()], "selected")?;
        assert_eq!(
            git(dir.path(), &["show", "HEAD:new.md"])?,
            "selected new file\n"
        );
        assert!(output.files_committed.iter().any(|path| path == "new.md"));
        assert_eq!(
            git(dir.path(), &["ls-files", "--stage", "--", "unrelated.md"])?,
            unrelated_before
        );
        assert_eq!(
            git(dir.path(), &["diff", "--cached", "--name-only"])?,
            "unrelated.md\n"
        );
        Ok(())
    }

    #[test]
    fn merge_commit_uses_staged_resolution_and_ignores_unstaged_and_untracked_files()
    -> Result<(), Box<dyn std::error::Error>> {
        let dir = tempdir()?;
        create_conflicted_merge(dir.path())?;

        fs::write(dir.path().join("file.md"), "RESOLUTION-A\n")?;
        git(dir.path(), &["add", "file.md"])?;
        fs::write(dir.path().join("file.md"), "RESOLUTION-B\n")?;
        fs::write(dir.path().join("unrelated.md"), "local draft\n")?;
        fs::write(dir.path().join("scratch.md"), "scratch\n")?;

        git_commit_selected(dir.path(), &["file.md".into()], "merge resolution")?;

        assert_eq!(
            git(dir.path(), &["show", "HEAD:file.md"])?,
            "RESOLUTION-A\n"
        );
        assert_eq!(
            fs::read_to_string(dir.path().join("file.md"))?,
            "RESOLUTION-B\n"
        );
        assert_eq!(
            fs::read_to_string(dir.path().join("unrelated.md"))?,
            "local draft\n"
        );
        assert!(dir.path().join("scratch.md").exists());
        assert_eq!(
            git(dir.path(), &["log", "-1", "--format=%P"])?
                .split_whitespace()
                .count(),
            2
        );
        assert!(!git_path(dir.path(), "MERGE_HEAD")?.exists());
        Ok(())
    }

    #[test]
    fn merge_rejects_only_missing_staged_merge_paths_not_unstaged_worktree_noise()
    -> Result<(), Box<dyn std::error::Error>> {
        let dir = tempdir()?;
        init(dir.path())?;
        fs::write(dir.path().join("a.md"), "base a\n")?;
        fs::write(dir.path().join("b.md"), "base b\n")?;
        git(dir.path(), &["add", "."])?;
        git(dir.path(), &["commit", "-m", "base"])?;
        git(dir.path(), &["checkout", "-b", "feature"])?;
        fs::write(dir.path().join("a.md"), "feature a\n")?;
        fs::write(dir.path().join("b.md"), "feature b\n")?;
        git(dir.path(), &["commit", "-am", "feature"])?;
        git(dir.path(), &["checkout", "main"])?;
        fs::write(dir.path().join("a.md"), "main a\n")?;
        fs::write(dir.path().join("b.md"), "main b\n")?;
        git(dir.path(), &["commit", "-am", "main"])?;
        let _ = Command::new("git")
            .current_dir(dir.path())
            .args(["merge", "feature"])
            .output()?;
        fs::write(dir.path().join("a.md"), "resolved a\n")?;
        fs::write(dir.path().join("b.md"), "resolved b\n")?;
        git(dir.path(), &["add", "a.md", "b.md"])?;
        fs::write(dir.path().join("scratch.md"), "untracked\n")?;

        let error = git_commit_selected(dir.path(), &["a.md".into()], "partial")
            .expect_err("partial staged merge tree must be rejected");
        assert!(error.to_string().contains("partial commit during a merge"));
        assert!(git_path(dir.path(), "MERGE_HEAD")?.exists());
        Ok(())
    }

    #[cfg(unix)]
    #[test]
    fn selected_commit_runs_commit_msg_hook() -> Result<(), Box<dyn std::error::Error>> {
        use std::os::unix::fs::PermissionsExt;

        let dir = tempdir()?;
        init(dir.path())?;
        fs::write(dir.path().join("base.md"), "base\n")?;
        git(dir.path(), &["add", "."])?;
        git(dir.path(), &["commit", "-m", "base"])?;
        fs::write(dir.path().join("selected.md"), "selected\n")?;

        let hook = dir.path().join(".git/hooks/commit-msg");
        fs::write(&hook, "#!/bin/sh\nprintf ran > .git/scriptor-hook-ran\n")?;
        let mut permissions = fs::metadata(&hook)?.permissions();
        permissions.set_mode(0o755);
        fs::set_permissions(&hook, permissions)?;

        git_commit_selected(dir.path(), &["selected.md".into()], "hooked")?;
        assert_eq!(
            fs::read_to_string(dir.path().join(".git/scriptor-hook-ran"))?,
            "ran"
        );
        Ok(())
    }

    #[test]
    fn selected_commit_preserves_unrelated_staging_and_cleans_selected_path()
    -> Result<(), Box<dyn std::error::Error>> {
        let dir = tempdir()?;
        init(dir.path())?;
        fs::write(dir.path().join("selected.md"), "# Selected\n")?;
        fs::write(dir.path().join("unrelated.md"), "# Unrelated\n")?;
        git(dir.path(), &["add", "."])?;
        git(dir.path(), &["commit", "-m", "initial"])?;

        fs::write(dir.path().join("selected.md"), "# Selected changed\n")?;
        fs::write(dir.path().join("unrelated.md"), "# Unrelated staged\n")?;
        git(dir.path(), &["add", "--", "unrelated.md"])?;
        let unrelated_stage_before =
            git(dir.path(), &["ls-files", "--stage", "--", "unrelated.md"])?;

        let output = git_commit_selected(dir.path(), &["selected.md".into()], "selected only")?;

        assert_eq!(output.files_committed, vec!["selected.md"]);
        assert_eq!(
            git(dir.path(), &["show", "HEAD:selected.md"])?,
            "# Selected changed\n"
        );
        assert_eq!(
            git(dir.path(), &["show", "HEAD:unrelated.md"])?,
            "# Unrelated\n"
        );
        assert_eq!(
            git(dir.path(), &["ls-files", "--stage", "--", "unrelated.md"])?,
            unrelated_stage_before,
            "unrelated staged content must remain unchanged"
        );
        assert_eq!(
            git(dir.path(), &["diff", "--cached", "--name-only"])?,
            "unrelated.md\n"
        );
        assert!(
            git(
                dir.path(),
                &["status", "--porcelain=1", "--", "selected.md"]
            )?
            .is_empty(),
            "committed selection must be clean in both index and worktree"
        );
        Ok(())
    }

    #[test]
    fn selected_commit_handles_deletions() -> Result<(), Box<dyn std::error::Error>> {
        let dir = tempdir()?;
        init(dir.path())?;
        fs::write(dir.path().join("deleted.md"), "# Delete me\n")?;
        git(dir.path(), &["add", "."])?;
        git(dir.path(), &["commit", "-m", "initial"])?;
        fs::remove_file(dir.path().join("deleted.md"))?;

        let output = git_commit_selected(dir.path(), &["deleted.md".into()], "delete selected")?;

        assert_eq!(output.files_committed, vec!["deleted.md"]);
        assert!(git(dir.path(), &["status", "--porcelain=1"])?.is_empty());
        assert!(git(dir.path(), &["show", "HEAD:deleted.md"]).is_err());
        Ok(())
    }

    #[test]
    fn selected_commit_expands_renames_to_both_paths() -> Result<(), Box<dyn std::error::Error>> {
        let dir = tempdir()?;
        init(dir.path())?;
        fs::write(dir.path().join("old.md"), "# Renamed\n")?;
        git(dir.path(), &["add", "."])?;
        git(dir.path(), &["commit", "-m", "initial"])?;
        git(dir.path(), &["mv", "old.md", "new.md"])?;

        let output = git_commit_selected(dir.path(), &["new.md".into()], "rename selected")?;

        assert!(output.files_committed.iter().any(|path| path == "new.md"));
        assert!(git(dir.path(), &["status", "--porcelain=1"])?.is_empty());
        assert_eq!(git(dir.path(), &["show", "HEAD:new.md"])?, "# Renamed\n");
        assert!(git(dir.path(), &["show", "HEAD:old.md"]).is_err());
        Ok(())
    }

    #[test]
    fn selected_commit_treats_pathspec_metacharacters_literally()
    -> Result<(), Box<dyn std::error::Error>> {
        let dir = tempdir()?;
        init(dir.path())?;
        let literal = if cfg!(windows) {
            "glob_literal[1].md"
        } else {
            ":(glob)literal[1].md"
        };
        fs::write(dir.path().join(literal), "# Literal\n")?;
        git(dir.path(), &["add", "."])?;
        git(dir.path(), &["commit", "-m", "initial"])?;
        fs::write(dir.path().join(literal), "# Changed\n")?;
        let output = git_commit_selected(dir.path(), &[literal.into()], "literal path")?;
        assert_eq!(output.files_committed, vec![literal]);
        Ok(())
    }

    #[test]
    fn selected_commit_during_merge_creates_multi_parent_commit_and_cleans_merge_head()
    -> Result<(), Box<dyn std::error::Error>> {
        let dir = tempdir()?;
        create_conflicted_merge(dir.path())?;

        // Resolve conflict
        fs::write(dir.path().join("file.md"), "# Resolved\n")?;
        git(dir.path(), &["add", "file.md"])?;

        assert!(
            git_path(dir.path(), "MERGE_HEAD")?.exists(),
            "MERGE_HEAD must exist during merge"
        );

        let output = git_commit_selected(dir.path(), &["file.md".into()], "Merge resolution")?;
        assert_eq!(output.files_committed, vec!["file.md"]);

        // Verify commit has 2 parents
        let parents = git(dir.path(), &["log", "-1", "--format=%P"])?;
        let parent_hashes: Vec<&str> = parents.split_whitespace().collect();
        assert_eq!(
            parent_hashes.len(),
            2,
            "merge commit must have exactly two parents"
        );

        // Verify MERGE_HEAD was cleaned up
        assert!(
            !git_path(dir.path(), "MERGE_HEAD")?.exists(),
            "MERGE_HEAD must be cleaned up after merge commit"
        );

        Ok(())
    }

    #[test]
    fn selected_commit_during_merge_rejects_unresolved_conflicts()
    -> Result<(), Box<dyn std::error::Error>> {
        let dir = tempdir()?;
        create_conflicted_merge(dir.path())?;

        // Do not resolve conflicts
        let result = git_commit_selected(dir.path(), &["file.md".into()], "premature commit");
        assert!(result.is_err());
        let err_msg = result.unwrap_err().to_string();
        assert!(
            err_msg.contains("unresolved"),
            "error must indicate unresolved conflicts: {err_msg}"
        );
        Ok(())
    }
}
