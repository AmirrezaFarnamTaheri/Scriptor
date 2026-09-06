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
        let json = bridge_git_status()?;
        return parse_daemon_json(&json);
    }
    let session = active_session(&state)?;
    git_status(session.root.root()).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn git_commit_cmd(
    state: tauri::State<AppState>,
    files: Vec<String>,
    message: String,
) -> Result<GitCommitOutput, String> {
    let session = active_session(&state)?;
    let queue = git_queue_handle(&state, session.root.root())?;
    queue
        .enqueue(move |root| git_commit_selected(root, &files, &message))
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn git_pull_cmd(
    state: tauri::State<AppState>,
    authorization_token: String,
) -> Result<GitPullOutput, String> {
    let session = active_session(&state)?;
    require_sensitive_operation(
        &state,
        &authorization_token,
        SensitiveOperation::GitPull,
        Some(&session.descriptor.id),
    )?;
    let queue = git_queue_handle(&state, session.root.root())?;
    queue
        .enqueue(move |root| git_pull(root, PullStrategy::FastForward))
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
    require_sensitive_operation(
        &state,
        &authorization_token,
        SensitiveOperation::ApplyGitConflict,
        Some(&path),
    )?;
    let session = active_session(&state)?;
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
    require_sensitive_operation(
        &state,
        &authorization_token,
        SensitiveOperation::ApplyGitConflict,
        Some(&path),
    )?;
    let session = active_session(&state)?;
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
