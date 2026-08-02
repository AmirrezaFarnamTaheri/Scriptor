use scriptor_native_git::{
    git_apply_merged_conflict, git_commit_selected, git_pull, git_push, git_resolve_conflict,
    git_show_head_file, git_show_merge_base_file, git_status, read_conflict_markers, GitCommitOutput,
    GitConflictResolveOutput, GitPullOutput, GitPushOutput, GitStatus,
};
use scriptor_vault::RelativeVaultPath;

use crate::authorization::{SensitiveOperation, require_sensitive_operation};
use crate::AppState;
use crate::state::{active_session, use_headless_engine};

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
    git_commit_selected(session.root.root(), &files, &message).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn git_pull_cmd(
    state: tauri::State<AppState>,
    authorization_token: String,
) -> Result<GitPullOutput, String> {
    require_sensitive_operation(&state, &authorization_token, SensitiveOperation::GitPull, Some("active-vault"))?;
    let session = active_session(&state)?;
    git_pull(session.root.root()).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn git_push_cmd(
    state: tauri::State<AppState>,
    authorization_token: String,
) -> Result<GitPushOutput, String> {
    require_sensitive_operation(&state, &authorization_token, SensitiveOperation::GitPush, Some("active-vault"))?;
    let session = active_session(&state)?;
    git_push(session.root.root()).map_err(|error| error.to_string())
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
    git_resolve_conflict(session.root.root(), &path, &strategy).map_err(|error| error.to_string())
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
    git_apply_merged_conflict(session.root.root(), &path, &merged_markdown)
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn git_show_merge_base_file_cmd(
    state: tauri::State<AppState>,
    path: String,
) -> Result<Option<String>, String> {
    let session = active_session(&state)?;
    let relative = RelativeVaultPath::parse(&path).map_err(|error| error.to_string())?;
    let resolved = session.root.resolve_relative(&relative).map_err(|error| error.to_string())?;
    let rel_str = resolved.strip_prefix(session.root.root()).unwrap_or(&resolved);
    git_show_merge_base_file(session.root.root(), &rel_str.to_string_lossy()).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn git_read_conflict_markers_cmd(state: tauri::State<AppState>, path: String) -> Result<Vec<String>, String> {
    let session = active_session(&state)?;
    let relative = RelativeVaultPath::parse(&path).map_err(|error| error.to_string())?;
    let file_path = session.root.resolve_relative(&relative).map_err(|error| error.to_string())?;
    read_conflict_markers(&file_path).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn git_show_head_file_cmd(state: tauri::State<AppState>, path: String) -> Result<Option<String>, String> {
    let session = active_session(&state)?;
    let relative = RelativeVaultPath::parse(&path).map_err(|error| error.to_string())?;
    let resolved = session.root.resolve_relative(&relative).map_err(|error| error.to_string())?;
    let rel_str = resolved.strip_prefix(session.root.root()).unwrap_or(&resolved);
    git_show_head_file(session.root.root(), &rel_str.to_string_lossy()).map_err(|error| error.to_string())
}
