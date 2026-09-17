use std::process::Command;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::TryLockError;
use std::thread;
use std::time::Duration;

use scriptor_daemon::{read_endpoint, rpc_call, DaemonEndpoint};
use scriptor_ipc::{RpcMethod, RpcPayload, RpcRequest, RpcResult};
use serde::Serialize;
use tauri::path::BaseDirectory;
use tauri::Manager;

use crate::authorization::{require_sensitive_operation, SensitiveOperation};
use crate::state::{lock_recover, verify_daemon_vault};
use crate::AppState;

static RPC_ID: AtomicU64 = AtomicU64::new(1);

#[derive(Debug, Clone, Serialize)]
pub struct DaemonPingOutput {
    pub version: String,
}

fn next_rpc_id() -> u64 {
    RPC_ID.fetch_add(1, Ordering::Relaxed)
}

pub(crate) fn daemon_rpc(method: RpcMethod) -> Result<RpcPayload, String> {
    let response = rpc_call(RpcRequest::new(next_rpc_id(), method)).map_err(|error| error.to_string())?;
    match response.result {
        RpcResult::Ok(payload) => Ok(payload),
        RpcResult::Error(error) => Err(error.to_string()),
    }
}

fn with_verified_vault<T>(
    state: &AppState,
    operation: &'static str,
    run: impl FnOnce() -> Result<T, String>,
) -> Result<T, String> {
    // Verification and dispatch share the switch critical section, but a
    // vault-bound caller may already hold an ActiveSession read lease. Never
    // wait here if a writer owns the switch lock and is waiting for that read
    // lease; fail closed so the caller can release its lease and the switch can
    // complete instead of creating a lock-order deadlock.
    let _switch = match state.vault_switch_lock.try_lock() {
        Ok(guard) => guard,
        Err(TryLockError::WouldBlock) => {
            return Err(format!(
                "{operation}: a vault transition is in progress; retry after it completes"
            ));
        }
        Err(TryLockError::Poisoned(poisoned)) => {
            tracing::error!(lock = "vault switch", "recovering poisoned vault-switch lock");
            state.vault_switch_lock.clear_poison();
            poisoned.into_inner()
        }
    };
    verify_daemon_vault(state)?;
    run()
}

fn resolve_daemon_binary(app: &tauri::AppHandle) -> std::path::PathBuf {
    if let Ok(path) = std::env::var("SCRIPTOR_DAEMON_BIN") {
        return std::path::PathBuf::from(path);
    }
    #[cfg(windows)]
    let candidates = vec![
        "binaries/scriptor-daemon.exe".to_string(),
        "binaries/scriptor-daemon".to_string(),
        "scriptor-daemon".to_string(),
        "scriptor-daemon.exe".to_string(),
    ];
    #[cfg(not(windows))]
    let candidates = vec!["binaries/scriptor-daemon".to_string(), "scriptor-daemon".to_string()];
    for candidate in candidates {
        if let Ok(resource) = app.path().resolve(&candidate, BaseDirectory::Resource)
            && resource.is_file()
        {
            return resource;
        }
    }
    #[cfg(windows)]
    { std::path::PathBuf::from("scriptor-daemon.exe") }
    #[cfg(not(windows))]
    { std::path::PathBuf::from("scriptor-daemon") }
}

fn reload_config_impl() -> Result<String, String> {
    match daemon_rpc(RpcMethod::ReloadConfig)? {
        RpcPayload::ConfigReloaded { json, .. } => Ok(json),
        _ => Err("unexpected daemon reload config response".into()),
    }
}
fn health_diagnostics_impl() -> Result<String, String> {
    match daemon_rpc(RpcMethod::HealthDiagnostics)? {
        RpcPayload::HealthDiagnostics { json } => Ok(json),
        _ => Err("unexpected daemon health response".into()),
    }
}
fn health_report_impl() -> Result<String, String> {
    match daemon_rpc(RpcMethod::HealthReport)? {
        RpcPayload::HealthReport { json } => Ok(json),
        _ => Err("unexpected daemon health report response".into()),
    }
}
fn rebuild_index_impl() -> Result<String, String> {
    let rebuild = match daemon_rpc(RpcMethod::RebuildIndex)? {
        RpcPayload::RebuildSummary { indexed_notes, skipped_notes, links_written } => serde_json::json!({
            "indexed_notes": indexed_notes,
            "skipped_notes": skipped_notes,
            "links_written": links_written,
        }),
        _ => return Err("unexpected daemon rebuild response".into()),
    };
    let health_json = health_report_impl()?;
    let health: serde_json::Value = serde_json::from_str(&health_json).map_err(|error| error.to_string())?;
    let cache_status = health.get("cache_status").cloned().unwrap_or_else(|| serde_json::Value::String("unknown".into()));
    serde_json::to_string(&serde_json::json!({
        "indexed_notes": rebuild["indexed_notes"],
        "skipped_notes": rebuild["skipped_notes"],
        "links_written": rebuild["links_written"],
        "cache_status": cache_status,
        "health": health,
    })).map_err(|error| error.to_string())
}
fn search_impl(query: String, limit: u32) -> Result<String, String> {
    match daemon_rpc(RpcMethod::SearchNotes { query, limit })? {
        RpcPayload::SearchHits { hits } => {
            let mapped: Vec<serde_json::Value> = hits.into_iter().map(|hit| serde_json::json!({
                "note_id": hit.path,
                "path": hit.path,
                "title": hit.title,
                "snippet": hit.snippet,
            })).collect();
            serde_json::to_string(&mapped).map_err(|error| error.to_string())
        }
        _ => Err("unexpected daemon search response".into()),
    }
}
fn list_note_summaries_impl() -> Result<String, String> {
    match daemon_rpc(RpcMethod::ListNotes)? {
        RpcPayload::NoteList { notes } => {
            let mapped: Vec<serde_json::Value> = notes.into_iter().map(|note| serde_json::json!({
                "path": note.path,
                "title": note.title,
                "modified_at": "",
                "note_type": null,
                "organized": false,
                "archived": false,
                "tags": [],
            })).collect();
            serde_json::to_string(&mapped).map_err(|error| error.to_string())
        }
        _ => Err("unexpected daemon note list response".into()),
    }
}
fn backlinks_impl(path: String) -> Result<String, String> {
    match daemon_rpc(RpcMethod::Backlinks { path })? {
        RpcPayload::Backlinks { json, .. } => Ok(json),
        _ => Err("unexpected daemon backlinks response".into()),
    }
}
fn graph_impl(focus_path: Option<String>, depth: u32) -> Result<String, String> {
    match daemon_rpc(RpcMethod::GraphSummary { path: focus_path, depth })? {
        RpcPayload::GraphSummary { json } => Ok(json),
        _ => Err("unexpected daemon graph response".into()),
    }
}
fn git_status_impl() -> Result<String, String> {
    match daemon_rpc(RpcMethod::GitStatus)? {
        RpcPayload::GitStatus { json } => Ok(json),
        _ => Err("unexpected daemon git status response".into()),
    }
}
fn save_note_impl(path: String, markdown: String, expected_content_hash: Option<String>, dry_run: Option<bool>) -> Result<String, String> {
    match daemon_rpc(RpcMethod::SaveNote { path, markdown, expected_content_hash, dry_run: dry_run.unwrap_or(false) })? {
        RpcPayload::NoteSaved { json } => Ok(json),
        _ => Err("unexpected daemon save response".into()),
    }
}
fn update_note_index_impl(path: String) -> Result<bool, String> {
    match daemon_rpc(RpcMethod::UpdateNoteIndex { path })? {
        RpcPayload::Unit => Ok(true),
        _ => Err("unexpected daemon index update response".into()),
    }
}
fn rename_apply_impl(from_path: String, to_path: String, update_links: bool, expected_source_hash: Option<String>) -> Result<String, String> {
    match daemon_rpc(RpcMethod::RenameNoteApply { from_path, to_path, update_links, expected_source_hash })? {
        RpcPayload::RenameApplied { json } => Ok(json),
        _ => Err("unexpected daemon rename response".into()),
    }
}
fn export_run_note_impl(note_path: String, format: String, dry_run: Option<bool>, extra_pandoc_args: Option<Vec<String>>, output_subdirectory: Option<String>) -> Result<String, String> {
    match daemon_rpc(RpcMethod::ExportRunNote { note_path, format, dry_run: dry_run.unwrap_or(false), extra_pandoc_args: extra_pandoc_args.unwrap_or_default(), output_subdirectory })? {
        RpcPayload::ExportResult { json } => Ok(json),
        _ => Err("unexpected daemon export response".into()),
    }
}
fn export_run_markdown_impl(note_path: String, source_markdown: String, format: String, dry_run: Option<bool>, extra_pandoc_args: Option<Vec<String>>, output_subdirectory: Option<String>) -> Result<String, String> {
    match daemon_rpc(RpcMethod::ExportRunMarkdown { note_path, source_markdown, format, dry_run: dry_run.unwrap_or(false), extra_pandoc_args: extra_pandoc_args.unwrap_or_default(), output_subdirectory })? {
        RpcPayload::ExportResult { json } => Ok(json),
        _ => Err("unexpected daemon export markdown response".into()),
    }
}
fn export_start_note_impl(note_path: String, format: String, dry_run: Option<bool>, extra_pandoc_args: Option<Vec<String>>, output_subdirectory: Option<String>) -> Result<String, String> {
    match daemon_rpc(RpcMethod::ExportStartNote { note_path, format, dry_run: dry_run.unwrap_or(false), extra_pandoc_args: extra_pandoc_args.unwrap_or_default(), output_subdirectory })? {
        RpcPayload::ExportStarted { job_id } => Ok(job_id),
        _ => Err("unexpected daemon export start response".into()),
    }
}
fn export_job_status_impl() -> Result<String, String> {
    match daemon_rpc(RpcMethod::ExportJobStatus)? {
        RpcPayload::ExportJobStatus { json } => Ok(json),
        _ => Err("unexpected daemon export status response".into()),
    }
}
fn export_cancel_impl(job_id: Option<String>) -> Result<(), String> {
    match daemon_rpc(RpcMethod::ExportCancel { job_id })? {
        RpcPayload::Unit => Ok(()),
        _ => Err("unexpected daemon export cancel response".into()),
    }
}

#[tauri::command]
pub fn daemon_ping() -> Result<DaemonPingOutput, String> {
    match daemon_rpc(RpcMethod::Ping)? {
        RpcPayload::Pong { version } => Ok(DaemonPingOutput { version }),
        _ => Err("unexpected daemon ping response".into()),
    }
}
#[tauri::command]
pub fn daemon_endpoint() -> Result<DaemonEndpoint, String> { read_endpoint().map_err(|error| error.to_string()) }
#[tauri::command]
pub fn daemon_start(app: tauri::AppHandle, state: tauri::State<AppState>, authorization_token: String) -> Result<DaemonEndpoint, String> {
    require_sensitive_operation(&state, &authorization_token, SensitiveOperation::DaemonControl, Some("background-daemon"), None)?;
    if daemon_ping().is_ok() { return read_endpoint().map_err(|error| error.to_string()); }
    let binary = resolve_daemon_binary(&app);
    let binary_display = binary.display().to_string();
    Command::new(&binary).arg("serve").spawn().map_err(|error| format!("failed to start {binary_display}: {error}"))?;
    thread::sleep(Duration::from_secs(2));
    read_endpoint().map_err(|error| error.to_string())
}
#[tauri::command]
pub fn daemon_open_vault(state: tauri::State<AppState>, root_path: String) -> Result<(), String> {
    let _switch = lock_recover(&state.vault_switch_lock, "daemon open vault");
    match daemon_rpc(RpcMethod::OpenVault { path: root_path.clone() })? {
        RpcPayload::VaultOpened { .. } => { crate::state::set_daemon_vault(&state, root_path); Ok(()) }
        _ => Err("unexpected daemon open vault response".into()),
    }
}
#[tauri::command]
pub fn daemon_reload_config(state: tauri::State<AppState>) -> Result<String, String> { bridge_reload_config(&state) }
#[tauri::command]
pub fn daemon_health_diagnostics(state: tauri::State<AppState>) -> Result<String, String> { bridge_health_diagnostics(&state) }
#[tauri::command]
pub fn daemon_health_report(state: tauri::State<AppState>) -> Result<String, String> { bridge_health_report(&state) }
#[tauri::command]
pub fn daemon_rebuild_index(state: tauri::State<AppState>) -> Result<String, String> { bridge_rebuild_index(&state) }
#[tauri::command]
pub fn daemon_search(state: tauri::State<AppState>, query: String, limit: u32) -> Result<String, String> { bridge_search(&state, query, limit) }
#[tauri::command]
pub fn daemon_list_note_summaries(state: tauri::State<AppState>) -> Result<String, String> { bridge_list_note_summaries(&state) }
#[tauri::command]
pub fn daemon_backlinks(state: tauri::State<AppState>, path: String) -> Result<String, String> { bridge_backlinks(&state, path) }
#[tauri::command]
pub fn daemon_graph(state: tauri::State<AppState>, focus_path: Option<String>, depth: u32) -> Result<String, String> { bridge_graph(&state, focus_path, depth) }
#[tauri::command]
pub fn daemon_git_status(state: tauri::State<AppState>) -> Result<String, String> { bridge_git_status(&state) }
#[tauri::command]
pub fn daemon_save_note(state: tauri::State<AppState>, path: String, markdown: String, expected_content_hash: Option<String>, dry_run: Option<bool>) -> Result<String, String> { bridge_save_note(&state, path, markdown, expected_content_hash, dry_run) }
#[tauri::command]
pub fn daemon_update_note_index(state: tauri::State<AppState>, path: String) -> Result<bool, String> { bridge_update_note_index(&state, path) }
#[tauri::command]
pub fn daemon_rename_apply(state: tauri::State<AppState>, from_path: String, to_path: String, update_links: bool, expected_source_hash: Option<String>) -> Result<String, String> { bridge_rename_apply(&state, from_path, to_path, update_links, expected_source_hash) }
#[tauri::command]
pub fn daemon_export_run_note(state: tauri::State<AppState>, note_path: String, format: String, dry_run: Option<bool>, extra_pandoc_args: Option<Vec<String>>, output_subdirectory: Option<String>) -> Result<String, String> { bridge_export_run_note(&state, note_path, format, dry_run, extra_pandoc_args, output_subdirectory) }
#[tauri::command]
pub fn daemon_export_run_markdown(state: tauri::State<AppState>, note_path: String, source_markdown: String, format: String, dry_run: Option<bool>, extra_pandoc_args: Option<Vec<String>>, output_subdirectory: Option<String>) -> Result<String, String> { bridge_export_run_markdown(&state, note_path, source_markdown, format, dry_run, extra_pandoc_args, output_subdirectory) }
#[tauri::command]
pub fn daemon_export_start_note(state: tauri::State<AppState>, note_path: String, format: String, dry_run: Option<bool>, extra_pandoc_args: Option<Vec<String>>, output_subdirectory: Option<String>) -> Result<String, String> { bridge_export_start_note(&state, note_path, format, dry_run, extra_pandoc_args, output_subdirectory) }
#[tauri::command]
pub fn daemon_export_job_status(state: tauri::State<AppState>) -> Result<String, String> { bridge_export_job_status(&state) }
#[tauri::command]
pub fn daemon_export_cancel(state: tauri::State<AppState>, job_id: Option<String>) -> Result<(), String> { bridge_export_cancel(&state, job_id) }

pub(crate) fn bridge_reload_config(state: &AppState) -> Result<String, String> { with_verified_vault(state, "daemon reload config", reload_config_impl) }
pub(crate) fn bridge_rebuild_index(state: &AppState) -> Result<String, String> { with_verified_vault(state, "daemon rebuild index", rebuild_index_impl) }
pub(crate) fn bridge_update_note_index(state: &AppState, path: String) -> Result<bool, String> { with_verified_vault(state, "daemon update note index", || update_note_index_impl(path)) }
pub(crate) fn bridge_search(state: &AppState, query: String, limit: u32) -> Result<String, String> { with_verified_vault(state, "daemon search", || search_impl(query, limit)) }
pub(crate) fn bridge_list_note_summaries(state: &AppState) -> Result<String, String> { with_verified_vault(state, "daemon list note summaries", list_note_summaries_impl) }
pub(crate) fn bridge_backlinks(state: &AppState, path: String) -> Result<String, String> { with_verified_vault(state, "daemon backlinks", || backlinks_impl(path)) }
pub(crate) fn bridge_graph(state: &AppState, focus_path: Option<String>, depth: u32) -> Result<String, String> { with_verified_vault(state, "daemon graph", || graph_impl(focus_path, depth)) }
pub(crate) fn bridge_git_status(state: &AppState) -> Result<String, String> { with_verified_vault(state, "daemon git status", git_status_impl) }
pub(crate) fn bridge_save_note(state: &AppState, path: String, markdown: String, expected_content_hash: Option<String>, dry_run: Option<bool>) -> Result<String, String> { with_verified_vault(state, "daemon save note", || save_note_impl(path, markdown, expected_content_hash, dry_run)) }
pub(crate) fn bridge_rename_apply(state: &AppState, from_path: String, to_path: String, update_links: bool, expected_source_hash: Option<String>) -> Result<String, String> { with_verified_vault(state, "daemon rename", || rename_apply_impl(from_path, to_path, update_links, expected_source_hash)) }
pub(crate) fn bridge_health_report(state: &AppState) -> Result<String, String> { with_verified_vault(state, "daemon health report", health_report_impl) }
pub(crate) fn bridge_health_diagnostics(state: &AppState) -> Result<String, String> { with_verified_vault(state, "daemon health diagnostics", health_diagnostics_impl) }
pub(crate) fn bridge_export_run_note(state: &AppState, note_path: String, format: String, dry_run: Option<bool>, extra_pandoc_args: Option<Vec<String>>, output_subdirectory: Option<String>) -> Result<String, String> { with_verified_vault(state, "daemon export note", || export_run_note_impl(note_path, format, dry_run, extra_pandoc_args, output_subdirectory)) }
pub(crate) fn bridge_export_run_markdown(state: &AppState, note_path: String, source_markdown: String, format: String, dry_run: Option<bool>, extra_pandoc_args: Option<Vec<String>>, output_subdirectory: Option<String>) -> Result<String, String> { with_verified_vault(state, "daemon export markdown", || export_run_markdown_impl(note_path, source_markdown, format, dry_run, extra_pandoc_args, output_subdirectory)) }
pub(crate) fn bridge_export_start_note(state: &AppState, note_path: String, format: String, dry_run: Option<bool>, extra_pandoc_args: Option<Vec<String>>, output_subdirectory: Option<String>) -> Result<String, String> { with_verified_vault(state, "daemon export start", || export_start_note_impl(note_path, format, dry_run, extra_pandoc_args, output_subdirectory)) }
pub(crate) fn bridge_export_job_status(state: &AppState) -> Result<String, String> { with_verified_vault(state, "daemon export status", export_job_status_impl) }
pub(crate) fn bridge_export_cancel(state: &AppState, job_id: Option<String>) -> Result<(), String> { with_verified_vault(state, "daemon export cancel", || export_cancel_impl(job_id)) }
