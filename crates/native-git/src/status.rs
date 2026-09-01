use std::collections::HashSet;
use std::ffi::OsString;
use std::fs;
use std::path::{Component, Path, PathBuf};
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use scriptor_system_bridge::{ProcessReceipt, ProcessSpec, run_process};
use serde::{Deserialize, Serialize};

use crate::error::GitError;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct GitChangedFile {
    pub path: String,
    pub status: String,
    pub conflict: bool,
    /// For rename/copy entries, where the file came from. `None` otherwise.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub original_path: Option<String>,
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

/// Fingerprint of the files whose change implies a different `git status`
/// result: HEAD, the index, and every ref. Reads four stat calls instead of
/// spawning three to four git subprocesses (~30-80ms each on Windows).
fn status_fingerprint(repo_root: &Path) -> Option<(u128, u128, Option<u128>)> {
    let head = fs::metadata(repo_root.join(".git").join("HEAD")).ok()?;
    let index = fs::metadata(repo_root.join(".git").join("index")).ok()?;
    let refs_mod = fs::read_dir(repo_root.join(".git").join("refs"))
        .ok()?
        .filter_map(|entry| entry.ok())
        .filter_map(|entry| entry.metadata().ok())
        .filter_map(|meta| meta.modified().ok())
        .max();
    let sys_time_to_nanos = |time: std::time::SystemTime| -> u128 {
        time.duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_nanos())
            .unwrap_or(0)
    };
    Some((
        sys_time_to_nanos(head.modified().ok()?),
        sys_time_to_nanos(index.modified().ok()?),
        refs_mod.map(sys_time_to_nanos),
    ))
}

/// Cache entry: HEAD/index/refs fingerprint plus the status it produced.
type StatusCacheEntry = (u128, u128, Option<u128>, GitStatus);

/// Process-wide status cache: one vault per daemon/desktop process, so the
/// fingerprint alone identifies the entry. Mutations (commit, pull, push,
/// conflict resolution) invalidate implicitly by touching .git.
static STATUS_CACHE: std::sync::Mutex<Option<StatusCacheEntry>> = std::sync::Mutex::new(None);

fn cache_get(fingerprint: &Option<(u128, u128, Option<u128>)>) -> Option<GitStatus> {
    let fingerprint = fingerprint.as_ref()?;
    let guard = STATUS_CACHE.lock().ok()?;
    let (head, index, refs, status) = guard.as_ref()?;
    if *head == fingerprint.0 && *index == fingerprint.1 && refs == &fingerprint.2 {
        return Some(status.clone());
    }
    None
}

fn cache_store(fingerprint: &Option<(u128, u128, Option<u128>)>, status: &GitStatus) {
    let Some(fingerprint) = fingerprint else {
        return;
    };
    if let Ok(mut guard) = STATUS_CACHE.lock() {
        *guard = Some((fingerprint.0, fingerprint.1, fingerprint.2, status.clone()));
    }
}

pub fn git_status(repo_root: &Path) -> Result<GitStatus, GitError> {
    // Only real repositories get cached; the not-a-repo result is cheap and
    // its fingerprint would be None anyway.
    let fingerprint = if is_git_repo(repo_root).unwrap_or(false) {
        status_fingerprint(repo_root)
    } else {
        None
    };
    if let Some(cached) = cache_get(&fingerprint) {
        return Ok(cached);
    }
    let status = git_status_uncached(repo_root)?;
    cache_store(&fingerprint, &status);
    Ok(status)
}

fn git_status_uncached(repo_root: &Path) -> Result<GitStatus, GitError> {
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
    if message.trim().is_empty() {
        return Err(GitError::Command("commit message must not be empty".into()));
    }
    if !is_git_repo(repo_root)? {
        return Err(GitError::NotARepository(repo_root.display().to_string()));
    }

    for file in files {
        validate_selected_path(file)?;
    }

    let selected_paths = expand_selected_paths(repo_root, files)?;
    let head = run_git(repo_root, &["rev-parse", "HEAD"])?;
    let branch_ref = run_git(repo_root, &["symbolic-ref", "-q", "HEAD"])?;
    let real_index = repository_index_path(repo_root)?;
    let original_index = std::fs::read(&real_index).ok();
    let temp_index = temporary_index_path(repo_root)?;
    let temp_index_guard = TemporaryIndex::new(temp_index.clone());

    run_git_with_index(repo_root, &temp_index, &["read-tree", &head])?;
    let mut add_args = vec![
        "--literal-pathspecs".to_string(),
        "add".to_string(),
        "--all".to_string(),
        "--".to_string(),
    ];
    add_args.extend(selected_paths.iter().cloned());
    run_git_with_index_owned(repo_root, &temp_index, &add_args)?;

    let tree = run_git_with_index(repo_root, &temp_index, &["write-tree"])?;
    let new_commit = run_git(
        repo_root,
        &["commit-tree", &tree, "-p", &head, "-m", message],
    )?;
    run_git(repo_root, &["update-ref", &branch_ref, &new_commit, &head])?;

    if let Err(error) = reset_committed_paths_in_real_index(repo_root, &selected_paths) {
        let rollback_result = run_git(repo_root, &["update-ref", &branch_ref, &head, &new_commit]);
        let restore_result = restore_index(&real_index, original_index.as_deref());
        return Err(GitError::Command(format!(
            "failed to reconcile selected paths after commit: {error}; branch rollback: {}; index restore: {}",
            format_result(&rollback_result),
            format_result(&restore_result)
        )));
    }

    let committed = run_git(
        repo_root,
        &[
            "diff-tree",
            "--no-commit-id",
            "--name-only",
            "-r",
            "--root",
            &new_commit,
        ],
    )?;
    let files_committed = committed
        .lines()
        .filter(|line| !line.trim().is_empty())
        .map(str::to_string)
        .collect();

    drop(temp_index_guard);
    Ok(GitCommitOutput {
        commit_hash: new_commit,
        files_committed,
    })
}

fn expand_selected_paths(repo_root: &Path, files: &[String]) -> Result<Vec<String>, GitError> {
    let status = git_status(repo_root)?;
    let selected = files.iter().map(String::as_str).collect::<HashSet<_>>();
    let mut expanded = files.to_vec();

    for changed in status.changed_files {
        let original_selected = changed
            .original_path
            .as_deref()
            .is_some_and(|original| selected.contains(original));
        if selected.contains(changed.path.as_str()) || original_selected {
            expanded.push(changed.path);
            if let Some(original) = changed.original_path {
                expanded.push(original);
            }
        }
    }

    expanded.sort();
    expanded.dedup();
    Ok(expanded)
}

fn repository_index_path(repo_root: &Path) -> Result<PathBuf, GitError> {
    let path = run_git(repo_root, &["rev-parse", "--git-path", "index"])?;
    let path = PathBuf::from(path);
    Ok(if path.is_absolute() {
        path
    } else {
        repo_root.join(path)
    })
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

fn temporary_index_path(repo_root: &Path) -> Result<PathBuf, GitError> {
    let git_dir = run_git(repo_root, &["rev-parse", "--absolute-git-dir"])?;
    let nonce = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_nanos();
    Ok(PathBuf::from(git_dir).join(format!("scriptor-index-{}-{nonce}", std::process::id())))
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
        let _ = std::fs::remove_file(std::path::PathBuf::from(lock_path));
    }
}

fn run_git_with_index(repo_root: &Path, index: &Path, args: &[&str]) -> Result<String, GitError> {
    run_git_command(repo_root, args, Some(index))
}

fn run_git_with_index_owned(
    repo_root: &Path,
    index: &Path,
    args: &[String],
) -> Result<String, GitError> {
    let borrowed: Vec<&str> = args.iter().map(String::as_str).collect();
    run_git_with_index(repo_root, index, &borrowed)
}

fn is_git_repo(repo_root: &Path) -> Result<bool, GitError> {
    let output = run_git_receipt(repo_root, &["rev-parse", "--is-inside-work-tree"])?;

    if output.exit_code != 0 {
        return Ok(false);
    }

    Ok(output.stdout.trim() == "true")
}

fn current_branch(repo_root: &Path) -> Result<String, GitError> {
    run_git(repo_root, &["rev-parse", "--abbrev-ref", "HEAD"])
}

pub(crate) fn run_git(repo_root: &Path, args: &[&str]) -> Result<String, GitError> {
    run_git_command(repo_root, args, None)
}

fn run_git_command(
    repo_root: &Path,
    args: &[&str],
    index: Option<&Path>,
) -> Result<String, GitError> {
    let output = run_git_receipt_with_index(repo_root, args, index)?;

    if output.exit_code != 0 {
        return Err(GitError::Command(format!(
            "git {} failed: {}",
            args.join(" "),
            output.stderr.trim()
        )));
    }

    Ok(output.stdout.trim().to_string())
}

fn run_git_receipt(repo_root: &Path, args: &[&str]) -> Result<ProcessReceipt, GitError> {
    run_git_receipt_with_index(repo_root, args, None)
}

fn run_git_receipt_with_index(
    repo_root: &Path,
    args: &[&str],
    index: Option<&Path>,
) -> Result<ProcessReceipt, GitError> {
    let mut spec = ProcessSpec::new("git")
        .args(args.iter().copied())
        .current_dir(repo_root)
        .timeout(Duration::from_secs(30))
        .max_output_bytes(256 * 1024)
        .env("GIT_TERMINAL_PROMPT", "0")
        .env("GCM_INTERACTIVE", "Never");
    if let Some(index) = index {
        spec = spec.env("GIT_INDEX_FILE", index.as_os_str());
    }
    for (key, value) in git_transport_environment() {
        spec = spec.env(key, value);
    }
    let receipt = run_process(spec).map_err(GitError::Process)?;
    reject_truncated_output(&args.join(" "), receipt)
}

/// The bridge intentionally starts subprocesses with a minimal environment.
/// Keep only the transport credential hand-off variables Git needs for SSH
/// agents and non-interactive askpass helpers; do not inherit arbitrary Git
/// configuration or execution overrides.
const GIT_TRANSPORT_ENVIRONMENT: [&str; 5] = [
    "SSH_AUTH_SOCK",
    "SSH_AGENT_PID",
    "GIT_ASKPASS",
    "SSH_ASKPASS",
    "SSH_ASKPASS_REQUIRE",
];

fn git_transport_environment() -> Vec<(OsString, OsString)> {
    git_transport_environment_from(|key| std::env::var_os(key))
}

fn git_transport_environment_from(
    mut value_for: impl FnMut(&str) -> Option<OsString>,
) -> Vec<(OsString, OsString)> {
    GIT_TRANSPORT_ENVIRONMENT
        .iter()
        .filter_map(|key| value_for(key).map(|value| ((*key).into(), value)))
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

fn parse_porcelain(output: &str) -> Vec<GitChangedFile> {
    output
        .lines()
        .filter_map(|line| {
            if line.len() < 3 {
                return None;
            }
            let raw_code = &line[..2];
            let rest = line[2..].trim_start();
            if rest.is_empty() {
                return None;
            }

            // Rename/copy entries carry both endpoints: `R  ORIG -> PATH`.
            let (original, path) = match split_rename(rest) {
                Some((original, path)) => (Some(unquote_path(original)), unquote_path(path)),
                None => (None, unquote_path(rest)),
            };
            if path.is_empty() {
                return None;
            }

            Some(GitChangedFile {
                path,
                status: map_status(raw_code.trim()),
                conflict: is_conflict_code(raw_code),
                original_path: original,
            })
        })
        .collect()
}

const RENAME_SEPARATOR: &str = " -> ";

/// Splits `ORIG -> PATH`, skipping over a C-quoted left-hand side so a
/// separator-looking sequence inside a quoted filename is not mistaken for the
/// real separator.
fn split_rename(rest: &str) -> Option<(&str, &str)> {
    let search_from = if rest.starts_with('"') {
        closing_quote_index(rest)? + 1
    } else {
        0
    };
    let offset = rest[search_from..].find(RENAME_SEPARATOR)?;
    let split_at = search_from + offset;
    Some((
        &rest[..split_at],
        &rest[split_at + RENAME_SEPARATOR.len()..],
    ))
}

/// Byte index of the quote that closes the one at index 0, honouring backslash escapes.
fn closing_quote_index(value: &str) -> Option<usize> {
    let bytes = value.as_bytes();
    let mut index = 1;
    while index < bytes.len() {
        match bytes[index] {
            b'\\' => index += 2,
            b'"' => return Some(index),
            _ => index += 1,
        }
    }
    None
}

/// Reverses git's C-style quoting (`core.quotePath`, on by default), which
/// renders every non-ASCII byte as an octal escape inside a quoted string.
/// Unquoted paths are returned as-is.
fn unquote_path(raw: &str) -> String {
    let raw = raw.trim();
    if raw.len() < 2 || !raw.starts_with('"') || !raw.ends_with('"') {
        return raw.to_string();
    }

    let inner = &raw.as_bytes()[1..raw.len() - 1];
    let mut out: Vec<u8> = Vec::with_capacity(inner.len());
    let mut index = 0;
    while index < inner.len() {
        if inner[index] != b'\\' {
            out.push(inner[index]);
            index += 1;
            continue;
        }
        index += 1;
        let Some(&escape) = inner.get(index) else {
            // Trailing backslash: keep it rather than losing a byte.
            out.push(b'\\');
            break;
        };
        index += 1;
        match escape {
            b'a' => out.push(0x07),
            b'b' => out.push(0x08),
            b'f' => out.push(0x0c),
            b'n' => out.push(b'\n'),
            b'r' => out.push(b'\r'),
            b't' => out.push(b'\t'),
            b'v' => out.push(0x0b),
            b'"' | b'\\' => out.push(escape),
            b'0'..=b'7' => {
                // Up to three octal digits, e.g. `\303` for one UTF-8 byte.
                let mut value = u32::from(escape - b'0');
                let mut digits = 1;
                while digits < 3 {
                    match inner.get(index) {
                        Some(&digit @ b'0'..=b'7') => {
                            value = value * 8 + u32::from(digit - b'0');
                            index += 1;
                            digits += 1;
                        }
                        _ => break,
                    }
                }
                out.push(value as u8);
            }
            other => out.push(other),
        }
    }

    String::from_utf8_lossy(&out).into_owned()
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
    let has_upstream = run_git(repo_root, &["rev-parse", "--abbrev-ref", "@{upstream}"]).is_ok();

    if !has_upstream {
        return (0, 0, false);
    }

    let Ok(output) = run_git(
        repo_root,
        &["rev-list", "--left-right", "--count", "HEAD...@{upstream}"],
    ) else {
        return (0, 0, true);
    };

    let (ahead, behind) = parse_sync_counts(&output);
    (ahead, behind, true)
}

/// Parses `git rev-list --left-right --count HEAD...@{upstream}` output.
/// The left field counts commits only reachable from HEAD (ahead of upstream);
/// the right field counts commits only reachable from upstream (behind).
fn parse_sync_counts(output: &str) -> (u32, u32) {
    let mut parts = output.split('\t');
    let ahead = parts
        .next()
        .and_then(|value| value.trim().parse().ok())
        .unwrap_or(0);
    let behind = parts
        .next()
        .and_then(|value| value.trim().parse().ok())
        .unwrap_or(0);
    (ahead, behind)
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

/// Common ancestor version of a path during an in-progress merge (`:1:` index stage).
pub fn git_show_merge_base_file(repo_root: &Path, path: &str) -> Result<Option<String>, GitError> {
    if !is_git_repo(repo_root)? {
        return Ok(None);
    }

    let normalized = path.replace('\\', "/");
    let stage_spec = format!(":1:{normalized}");
    match run_git(repo_root, &["show", &stage_spec]) {
        Ok(content) => Ok(Some(content)),
        Err(GitError::Command(_)) => {
            let merge_head = run_git(repo_root, &["rev-parse", "-q", "MERGE_HEAD"]).ok();
            let head = run_git(repo_root, &["rev-parse", "HEAD"]).ok();
            if let (Some(merge_head), Some(head)) = (merge_head, head)
                && let Ok(base) = run_git(repo_root, &["merge-base", &head, &merge_head])
            {
                let spec = format!("{base}:{normalized}");
                return match run_git(repo_root, &["show", &spec]) {
                    Ok(content) => Ok(Some(content)),
                    Err(GitError::Command(_)) => Ok(None),
                    Err(error) => Err(error),
                };
            }
            Ok(None)
        }
        Err(error) => Err(error),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use scriptor_system_bridge::BridgeError;
    use std::fs;
    use std::process::Command;
    use tempfile::tempdir;

    #[test]
    fn keeps_only_reviewed_git_transport_environment() {
        let environment = git_transport_environment_from(|key| match key {
            "SSH_AUTH_SOCK" => Some("agent.sock".into()),
            "SSH_AGENT_PID" => Some("1234".into()),
            "GIT_ASKPASS" => Some("git-askpass".into()),
            "SSH_ASKPASS" => Some("ssh-askpass".into()),
            "SSH_ASKPASS_REQUIRE" => Some("force".into()),
            _ => None,
        });

        assert_eq!(
            environment,
            vec![
                ("SSH_AUTH_SOCK".into(), "agent.sock".into()),
                ("SSH_AGENT_PID".into(), "1234".into()),
                ("GIT_ASKPASS".into(), "git-askpass".into()),
                ("SSH_ASKPASS".into(), "ssh-askpass".into()),
                ("SSH_ASKPASS_REQUIRE".into(), "force".into()),
            ]
        );
    }

    #[test]
    fn rejects_truncated_git_output() {
        for (stdout_truncated, stderr_truncated, stream) in
            [(true, false, "stdout"), (false, true, "stderr")]
        {
            let receipt = ProcessReceipt {
                program: "git".into(),
                resolved_program: "git".into(),
                program_sha256: None,
                exit_code: 0,
                duration_ms: 0,
                timed_out: false,
                stdout: String::new(),
                stderr: String::new(),
                stdout_truncated,
                stderr_truncated,
            };

            assert!(matches!(
                reject_truncated_output("status --porcelain=1", receipt),
                Err(GitError::OutputTruncated {
                    command,
                    stream: actual_stream,
                }) if command == "status --porcelain=1" && actual_stream == stream
            ));
        }
    }

    #[test]
    fn preserves_bridge_failures_instead_of_reporting_git_missing() {
        let directory = tempdir().expect("tempdir");
        let nonexistent_root = directory.path().join("does-not-exist");

        assert!(matches!(
            run_git(&nonexistent_root, &["status", "--porcelain=1"]),
            Err(GitError::Process(BridgeError::ProcessSpawn { .. }))
        ));
    }

    fn configure_git_identity(repo: &Path) -> Result<(), Box<dyn std::error::Error>> {
        for (key, value) in [
            ("user.name", "Scriptor Test"),
            ("user.email", "scriptor@test.local"),
        ] {
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
    fn parse_sync_counts_maps_left_field_to_ahead() {
        // `rev-list --left-right --count HEAD...@{upstream}` prints <ahead>\t<behind>.
        assert_eq!(parse_sync_counts("2\t5"), (2, 5));
        assert_eq!(parse_sync_counts("0\t0"), (0, 0));
        assert_eq!(parse_sync_counts("garbage"), (0, 0));
    }

    #[test]
    fn ahead_counts_local_commits_not_pushed() -> Result<(), Box<dyn std::error::Error>> {
        let origin = tempdir()?;
        Command::new("git")
            .args(["init", origin.path().to_str().unwrap()])
            .output()?;
        configure_git_identity(origin.path())?;
        fs::write(origin.path().join("note.md"), "# One\n")?;
        Command::new("git")
            .current_dir(origin.path())
            .args(["add", "note.md"])
            .output()?;
        git_commit(origin.path(), "init")?;

        let clones = tempdir()?;
        let work = clones.path().join("work");
        let clone_output = Command::new("git")
            .args([
                "clone",
                origin.path().to_str().unwrap(),
                work.to_str().unwrap(),
            ])
            .output()?;
        if !clone_output.status.success() {
            return Err(format!(
                "git clone failed: {}",
                String::from_utf8_lossy(&clone_output.stderr)
            )
            .into());
        }
        configure_git_identity(&work)?;
        fs::write(work.join("note.md"), "# Two\n")?;
        Command::new("git")
            .current_dir(&work)
            .args(["add", "note.md"])
            .output()?;
        git_commit(&work, "local change")?;

        let status = git_status(&work)?;
        assert!(status.has_upstream);
        assert_eq!(status.ahead, 1, "local-only commit must count as ahead");
        assert_eq!(status.behind, 0);
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
    fn parses_c_quoted_unicode_path() {
        // `core.quotePath` is on by default, so git emits non-ASCII names
        // octal-escaped inside double quotes.
        let files = parse_porcelain("?? \"na\\303\\257ve note.md\"\n");
        assert_eq!(files.len(), 1);
        assert_eq!(files[0].path, "naïve note.md");
        assert_eq!(files[0].status, "added");
        assert!(files[0].original_path.is_none());
    }

    #[test]
    fn parses_rename_entry_into_both_endpoints() {
        let files = parse_porcelain("R  old.md -> new.md\n");
        assert_eq!(files.len(), 1);
        assert_eq!(files[0].path, "new.md");
        assert_eq!(files[0].original_path.as_deref(), Some("old.md"));
        assert_eq!(files[0].status, "renamed");
    }

    #[test]
    fn parses_rename_entry_with_quoted_unicode_endpoints() {
        let files = parse_porcelain("R  \"caf\\303\\251.md\" -> \"r\\303\\251sum\\303\\251.md\"\n");
        assert_eq!(files.len(), 1);
        assert_eq!(files[0].path, "résumé.md");
        assert_eq!(files[0].original_path.as_deref(), Some("café.md"));
    }

    #[test]
    fn rename_separator_inside_a_quoted_name_is_not_a_split_point() {
        let files = parse_porcelain("R  \"a -> b.md\" -> \"c.md\"\n");
        assert_eq!(files.len(), 1);
        assert_eq!(files[0].original_path.as_deref(), Some("a -> b.md"));
        assert_eq!(files[0].path, "c.md");
    }

    #[test]
    fn unquotes_escaped_control_characters() {
        assert_eq!(unquote_path(r#""tab\there.md""#), "tab\there.md");
        assert_eq!(unquote_path(r#""quote\"name.md""#), "quote\"name.md");
        assert_eq!(unquote_path(r#""back\\slash.md""#), "back\\slash.md");
        assert_eq!(unquote_path("plain.md"), "plain.md");
    }

    #[test]
    fn reports_unicode_and_renamed_paths_from_a_real_repo() -> Result<(), Box<dyn std::error::Error>>
    {
        let dir = tempdir()?;
        Command::new("git")
            .args(["init", dir.path().to_str().unwrap()])
            .output()?;
        configure_git_identity(dir.path())?;
        fs::write(dir.path().join("old.md"), "# Old\n")?;
        Command::new("git")
            .current_dir(dir.path())
            .args(["add", "old.md"])
            .output()?;
        git_commit(dir.path(), "init")?;

        Command::new("git")
            .current_dir(dir.path())
            .args(["mv", "old.md", "new.md"])
            .output()?;
        fs::write(dir.path().join("café.md"), "# Café\n")?;

        let status = git_status(dir.path())?;
        let unicode = status
            .changed_files
            .iter()
            .find(|file| file.path == "café.md")
            .ok_or("unicode path missing from status")?;
        assert!(unicode.original_path.is_none());

        let renamed = status
            .changed_files
            .iter()
            .find(|file| file.status == "renamed")
            .ok_or("rename entry missing from status")?;
        assert_eq!(renamed.path, "new.md");
        assert_eq!(renamed.original_path.as_deref(), Some("old.md"));
        Ok(())
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

    #[test]
    fn show_merge_base_returns_none_without_merge() -> Result<(), Box<dyn std::error::Error>> {
        let dir = tempdir()?;
        Command::new("git")
            .args(["init", dir.path().to_str().unwrap()])
            .output()?;
        fs::write(dir.path().join("note.md"), "# Note\n")?;
        Command::new("git")
            .current_dir(dir.path())
            .args(["add", "note.md"])
            .output()?;
        configure_git_identity(dir.path())?;
        git_commit(dir.path(), "init")?;

        let base = git_show_merge_base_file(dir.path(), "note.md")?;
        assert!(base.is_none());
        Ok(())
    }

    #[test]
    fn selected_commit_preserves_unrelated_staging_and_cleans_selected_path()
    -> Result<(), Box<dyn std::error::Error>> {
        let dir = tempdir()?;
        Command::new("git")
            .args(["init", dir.path().to_str().unwrap()])
            .output()?;
        configure_git_identity(dir.path())?;
        fs::write(dir.path().join("selected.md"), "# Selected\n")?;
        fs::write(dir.path().join("unrelated.md"), "# Unrelated\n")?;
        Command::new("git")
            .current_dir(dir.path())
            .args(["add", "."])
            .output()?;
        git_commit(dir.path(), "initial")?;

        fs::write(dir.path().join("selected.md"), "# Selected changed\n")?;
        fs::write(dir.path().join("unrelated.md"), "# Unrelated staged\n")?;
        Command::new("git")
            .current_dir(dir.path())
            .args(["add", "--", "unrelated.md"])
            .output()?;
        let unrelated_stage_before =
            run_git(dir.path(), &["ls-files", "--stage", "--", "unrelated.md"])?;

        let output = git_commit_selected(dir.path(), &["selected.md".into()], "selected only")?;

        assert_eq!(output.files_committed, vec!["selected.md"]);
        assert_eq!(
            run_git(dir.path(), &["show", "HEAD:selected.md"])?,
            "# Selected changed"
        );
        assert_eq!(
            run_git(dir.path(), &["show", "HEAD:unrelated.md"])?,
            "# Unrelated"
        );
        assert_eq!(
            run_git(dir.path(), &["ls-files", "--stage", "--", "unrelated.md"])?,
            unrelated_stage_before,
            "unrelated staged content must remain unchanged"
        );
        assert_eq!(
            run_git(dir.path(), &["diff", "--cached", "--name-only"])?,
            "unrelated.md"
        );
        assert!(
            run_git(
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
        Command::new("git")
            .args(["init", dir.path().to_str().unwrap()])
            .output()?;
        configure_git_identity(dir.path())?;
        fs::write(dir.path().join("deleted.md"), "# Delete me\n")?;
        Command::new("git")
            .current_dir(dir.path())
            .args(["add", "."])
            .output()?;
        git_commit(dir.path(), "initial")?;
        fs::remove_file(dir.path().join("deleted.md"))?;

        let output = git_commit_selected(dir.path(), &["deleted.md".into()], "delete selected")?;

        assert_eq!(output.files_committed, vec!["deleted.md"]);
        assert!(run_git(dir.path(), &["status", "--porcelain=1"])?.is_empty());
        assert!(run_git(dir.path(), &["show", "HEAD:deleted.md"]).is_err());
        Ok(())
    }

    #[test]
    fn selected_commit_expands_renames_to_both_paths() -> Result<(), Box<dyn std::error::Error>> {
        let dir = tempdir()?;
        Command::new("git")
            .args(["init", dir.path().to_str().unwrap()])
            .output()?;
        configure_git_identity(dir.path())?;
        fs::write(dir.path().join("old.md"), "# Renamed\n")?;
        Command::new("git")
            .current_dir(dir.path())
            .args(["add", "."])
            .output()?;
        git_commit(dir.path(), "initial")?;
        Command::new("git")
            .current_dir(dir.path())
            .args(["mv", "old.md", "new.md"])
            .output()?;

        let output = git_commit_selected(dir.path(), &["new.md".into()], "rename selected")?;

        assert!(output.files_committed.iter().any(|path| path == "new.md"));
        assert!(run_git(dir.path(), &["status", "--porcelain=1"])?.is_empty());
        assert_eq!(run_git(dir.path(), &["show", "HEAD:new.md"])?, "# Renamed");
        assert!(run_git(dir.path(), &["show", "HEAD:old.md"]).is_err());
        Ok(())
    }

    #[test]
    fn selected_commit_treats_pathspec_metacharacters_literally()
    -> Result<(), Box<dyn std::error::Error>> {
        let dir = tempdir()?;
        Command::new("git")
            .args(["init", dir.path().to_str().unwrap()])
            .output()?;
        configure_git_identity(dir.path())?;
        let literal = if cfg!(windows) {
            "glob_literal[1].md"
        } else {
            ":(glob)literal[1].md"
        };
        fs::write(dir.path().join(literal), "# Literal\n")?;
        Command::new("git")
            .current_dir(dir.path())
            .args(["add", "."])
            .output()?;
        git_commit(dir.path(), "initial")?;
        fs::write(dir.path().join(literal), "# Changed\n")?;
        let output = git_commit_selected(dir.path(), &[literal.into()], "literal path")?;
        assert_eq!(output.files_committed, vec![literal]);
        Ok(())
    }
}
