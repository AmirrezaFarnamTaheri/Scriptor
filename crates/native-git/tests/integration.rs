use std::fs;
use std::process::Command;

use scriptor_native_git::{git_commit_selected, git_status, GitError};

fn run_git(repo: &std::path::Path, args: &[&str]) -> Result<String, GitError> {
    let output = Command::new("git")
        .current_dir(repo)
        .args(args)
        .output()
        .map_err(|error| GitError::Command(error.to_string()))?;
    if !output.status.success() {
        return Err(GitError::Command(
            String::from_utf8_lossy(&output.stderr).trim().to_string(),
        ));
    }
    Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
}

fn init_repo(root: &std::path::Path) {
    run_git(root, &["init", "-b", "main"]).expect("git init");
    run_git(root, &["config", "user.email", "test@example.com"]).expect("email");
    run_git(root, &["config", "user.name", "Scriptor Test"]).expect("name");
}

#[test]
fn fixture_repo_reports_changed_file_after_edit() -> Result<(), GitError> {
    let dir = tempfile::tempdir().expect("tempdir");
    let root = dir.path();
    init_repo(root);
    fs::write(root.join("note.md"), "# Hello\n").expect("write");
    run_git(root, &["add", "note.md"]).expect("add");
    run_git(root, &["commit", "-m", "init"]).expect("commit");

    fs::write(root.join("note.md"), "# Hello\n\nedited\n").expect("edit");
    let status = git_status(root)?;
    assert!(status.is_repo);
    assert!(!status.clean);
    assert_eq!(status.changed_files.len(), 1);
    assert_eq!(status.changed_files[0].path, "note.md");
    Ok(())
}

#[test]
fn fixture_repo_commit_selected_stages_only_requested_paths() -> Result<(), GitError> {
    let dir = tempfile::tempdir().expect("tempdir");
    let root = dir.path();
    init_repo(root);
    fs::write(root.join("a.md"), "# A\n").expect("write a");
    fs::write(root.join("b.md"), "# B\n").expect("write b");
    run_git(root, &["add", "."]).expect("add");
    run_git(root, &["commit", "-m", "init"]).expect("commit");

    fs::write(root.join("a.md"), "# A\n\nedit\n").expect("edit a");
    fs::write(root.join("b.md"), "# B\n\nedit\n").expect("edit b");

    let output = git_commit_selected(root, &["a.md".into()], "commit a only")?;
    assert_eq!(output.files_committed, vec!["a.md".to_string()]);

    let status = git_status(root)?;
    assert_eq!(status.changed_files.len(), 1);
    assert_eq!(status.changed_files[0].path, "b.md");
    Ok(())
}

#[test]
fn fixture_repo_detects_merge_conflict_state() -> Result<(), GitError> {
    let dir = tempfile::tempdir().expect("tempdir");
    let root = dir.path();
    init_repo(root);
    fs::write(root.join("note.md"), "base\n").expect("write");
    run_git(root, &["add", "note.md"]).expect("add");
    run_git(root, &["commit", "-m", "base"]).expect("commit");
    run_git(root, &["checkout", "-b", "feature"]).expect("branch");
    fs::write(root.join("note.md"), "feature line\n").expect("feature edit");
    run_git(root, &["commit", "-am", "feature"]).expect("feature commit");
    run_git(root, &["checkout", "main"]).expect("checkout main");
    fs::write(root.join("note.md"), "main line\n").expect("main edit");
    run_git(root, &["commit", "-am", "main"]).expect("main commit");

    let merge = Command::new("git")
        .current_dir(root)
        .args(["merge", "feature"])
        .output()
        .expect("merge");
    assert!(!merge.status.success());

    let status = git_status(root)?;
    assert!(status.has_conflicts);
    assert!(!status.conflicted_files.is_empty());
    Ok(())
}
