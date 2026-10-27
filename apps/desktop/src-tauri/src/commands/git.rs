use scriptor_native_git::{
    GitCommitOutput, GitConflictResolveOutput, GitPullOutput, GitPushOutput, GitStatus,
    PullStrategy, git_apply_merged_conflict, git_commit_selected, git_pull, git_push,
    git_resolve_conflict, git_show_head_file, git_show_merge_base_file, git_status,
    read_conflict_markers,
};
use scriptor_vault::RelativeVaultPath;

use crate::AppState;
use crate::authorization::{SensitiveOperation, require_sensitive_operation};
use crate::state::{active_session, git_queue_handle, use_headless_engine};

use super::daemon::bridge_git_status;
use super::shared::parse_daemon_json;

#[tauri::command]
pub fn git_status_cmd(state: tauri::State<AppState>) -> Result<GitStatus, String> {
    if use_headless_engine(&state) {
        let json = bridge_git_status(&state)?;
        return parse_daemon_json(&json);
    }
    let session = active_session(&state)?;
    git_status(session.root.root()).map_err(|error| error.to_string())
}

/// Fail before queue acquisition if the invoking renderer belongs to an old vault.
fn with_expected_git_vault<T>(
    active_vault_id: &str,
    expected_vault_id: &str,
    write: impl FnOnce() -> Result<T, String>,
) -> Result<T, String> {
    if expected_vault_id.trim().is_empty() {
        return Err("Git commit requires an initiating vault identity.".into());
    }
    crate::commands::vault::validate_expected_vault(active_vault_id, Some(expected_vault_id))
        .map_err(|_| "Git commit was not started because the active vault changed.".to_string())?;
    write()
}

#[tauri::command]
pub fn git_commit_cmd(
    state: tauri::State<AppState>,
    files: Vec<String>,
    message: String,
    expected_vault_id: String,
) -> Result<GitCommitOutput, String> {
    let session = active_session(&state)?;
    with_expected_git_vault(&session.descriptor.id, &expected_vault_id, || {
        let queue = git_queue_handle(&state, session.root.root())?;
        queue
            .enqueue(move |root| git_commit_selected(root, &files, &message))
            .map_err(|error| error.to_string())
    })
}

#[tauri::command]
pub fn git_pull_cmd(
    state: tauri::State<AppState>,
    strategy: PullStrategy,
    authorization_token: String,
) -> Result<GitPullOutput, String> {
    let session = active_session(&state)?;
    require_sensitive_operation(
        &state,
        &authorization_token,
        SensitiveOperation::GitPull,
        Some(&session.descriptor.id),
        Some(&session.descriptor.id),
    )?;
    let queue = git_queue_handle(&state, session.root.root())?;
    queue
        .enqueue(move |root| git_pull(root, strategy))
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn git_push_cmd(
    state: tauri::State<AppState>,
    authorization_token: String,
) -> Result<GitPushOutput, String> {
    let session = active_session(&state)?;
    require_sensitive_operation(
        &state,
        &authorization_token,
        SensitiveOperation::GitPush,
        Some(&session.descriptor.id),
        Some(&session.descriptor.id),
    )?;
    let queue = git_queue_handle(&state, session.root.root())?;
    queue
        .enqueue(move |root| git_push(root))
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn git_resolve_conflict_cmd(
    state: tauri::State<AppState>,
    path: String,
    strategy: String,
    authorization_token: String,
) -> Result<GitConflictResolveOutput, String> {
    let session = active_session(&state)?;
    require_sensitive_operation(
        &state,
        &authorization_token,
        SensitiveOperation::ApplyGitConflict,
        Some(&path),
        Some(&session.descriptor.id),
    )?;
    let queue = git_queue_handle(&state, session.root.root())?;
    queue
        .enqueue(move |root| git_resolve_conflict(root, &path, &strategy))
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn git_apply_merged_conflict_cmd(
    state: tauri::State<AppState>,
    path: String,
    merged_markdown: String,
    authorization_token: String,
) -> Result<GitConflictResolveOutput, String> {
    let session = active_session(&state)?;
    require_sensitive_operation(
        &state,
        &authorization_token,
        SensitiveOperation::ApplyGitConflict,
        Some(&path),
        Some(&session.descriptor.id),
    )?;
    let queue = git_queue_handle(&state, session.root.root())?;
    queue
        .enqueue(move |root| git_apply_merged_conflict(root, &path, &merged_markdown))
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn git_show_merge_base_file_cmd(
    state: tauri::State<AppState>,
    path: String,
) -> Result<Option<String>, String> {
    let session = active_session(&state)?;
    let relative = RelativeVaultPath::parse(&path).map_err(|error| error.to_string())?;
    let resolved = session
        .root
        .resolve_relative(&relative)
        .map_err(|error| error.to_string())?;
    let rel_str = resolved
        .strip_prefix(session.root.root())
        .unwrap_or(&resolved);
    git_show_merge_base_file(session.root.root(), &rel_str.to_string_lossy())
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn git_read_conflict_markers_cmd(
    state: tauri::State<AppState>,
    path: String,
) -> Result<Vec<String>, String> {
    let session = active_session(&state)?;
    let relative = RelativeVaultPath::parse(&path).map_err(|error| error.to_string())?;
    let file_path = session
        .root
        .resolve_relative(&relative)
        .map_err(|error| error.to_string())?;
    read_conflict_markers(&file_path).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn git_show_head_file_cmd(
    state: tauri::State<AppState>,
    path: String,
) -> Result<Option<String>, String> {
    let session = active_session(&state)?;
    let relative = RelativeVaultPath::parse(&path).map_err(|error| error.to_string())?;
    let resolved = session
        .root
        .resolve_relative(&relative)
        .map_err(|error| error.to_string())?;
    let rel_str = resolved
        .strip_prefix(session.root.root())
        .unwrap_or(&resolved);
    git_show_head_file(session.root.root(), &rel_str.to_string_lossy())
        .map_err(|error| error.to_string())
}

#[cfg(test)]
mod tests {
    use std::cell::Cell;

    use super::with_expected_git_vault;

    #[test]
    fn git_commit_rejects_stale_and_missing_vault_before_queueing() {
        let attempted_writes = Cell::new(0);
        for expected in ["old-vault", ""] {
            let result = with_expected_git_vault("new-vault", expected, || {
                attempted_writes.set(attempted_writes.get() + 1);
                Ok(1_u8)
            });
            assert!(result.is_err(), "an incorrect vault must reject the mutation");
        }
        assert_eq!(attempted_writes.get(), 0, "no Git write may start on a mismatched vault");
    }

    #[test]
    fn git_commit_accepts_matching_vault_and_runs_one_write() {
        let attempted_writes = Cell::new(0);
        let output = with_expected_git_vault("same-vault", "same-vault", || {
            attempted_writes.set(attempted_writes.get() + 1);
            Ok("accepted")
        })
        .expect("same-vault operation is allowed");
        assert_eq!(output, "accepted");
        assert_eq!(attempted_writes.get(), 1);
    }
}
