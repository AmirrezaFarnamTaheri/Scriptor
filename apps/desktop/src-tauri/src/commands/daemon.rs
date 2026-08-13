use std::process::Command;
use std::sync::atomic::{AtomicU64, Ordering};
use std::thread;
use std::time::Duration;

use scriptor_daemon::{DaemonEndpoint, read_endpoint, rpc_call};
use scriptor_ipc::{RpcMethod, RpcPayload, RpcRequest, RpcResult};
use serde::Serialize;
use tauri::Manager;
use tauri::path::BaseDirectory;

use crate::AppState;
use crate::authorization::{SensitiveOperation, require_sensitive_operation};

static RPC_ID: AtomicU64 = AtomicU64::new(1);

#[derive(Debug, Clone, Serialize)]
pub struct DaemonPingOutput {
    pub version: String,
}

fn next_rpc_id() -> u64 {
    RPC_ID.fetch_add(1, Ordering::Relaxed)
}

pub(crate) fn daemon_rpc(method: RpcMethod) -> Result<RpcPayload, String> {
    let response =
        rpc_call(RpcRequest::new(next_rpc_id(), method)).map_err(|error| error.to_string())?;
    match response.result {
        RpcResult::Ok(payload) => Ok(payload),
        RpcResult::Error(error) => Err(error.to_string()),
        RpcResult::Err(message) => Err(message),
    }
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
    let candidates = vec![
        "binaries/scriptor-daemon".to_string(),
        "scriptor-daemon".to_string(),
    ];
    for candidate in candidates {
        if let Ok(resource) = app.path().resolve(&candidate, BaseDirectory::Resource)
            && resource.is_file()
        {
            return resource;
        }
    }
    #[cfg(windows)]
    {
        std::path::PathBuf::from("scriptor-daemon.exe")
    }
    #[cfg(not(windows))]
    {
        std::path::PathBuf::from("scriptor-daemon")
    }
}

#[tauri::command]
pub fn daemon_reload_config() -> Result<String, String> {
    match daemon_rpc(RpcMethod::ReloadConfig)? {
        RpcPayload::ConfigReloaded { json, .. } => Ok(json),
        _ => Err("unexpected daemon reload config response".into()),
    }
}

pub(crate) fn bridge_reload_config() -> Result<String, String> {
    daemon_reload_config()
}

#[tauri::command]
pub fn daemon_ping() -> Result<DaemonPingOutput, String> {
    match daemon_rpc(RpcMethod::Ping)? {
        RpcPayload::Pong { version } => Ok(DaemonPingOutput { version }),
        _ => Err("unexpected daemon ping response".into()),
    }
}

#[tauri::command]
pub fn daemon_endpoint() -> Result<DaemonEndpoint, String> {
    read_endpoint().map_err(|error| error.to_string())
}

#[tauri::command]
pub fn daemon_start(
    app: tauri::AppHandle,
    state: tauri::State<AppState>,
    authorization_token: String,
) -> Result<DaemonEndpoint, String> {
    require_sensitive_operation(
        &state,
        &authorization_token,
        SensitiveOperation::DaemonControl,
        Some("background-daemon"),
    )?;
    if daemon_ping().is_ok() {
        return read_endpoint().map_err(|error| error.to_string());
    }

    let binary = resolve_daemon_binary(&app);
    let binary_display = binary.display().to_string();
    // PROCESS_BROKER_EXCEPTION(desktop-daemon-start)
    Command::new(&binary)
        .arg("serve")
        .spawn()
        .map_err(|error| format!("failed to start {binary_display}: {error}"))?;

    thread::sleep(Duration::from_secs(2));
    read_endpoint().map_err(|error| error.to_string())
}

#[tauri::command]
pub fn daemon_open_vault(root_path: String) -> Result<(), String> {
    match daemon_rpc(RpcMethod::OpenVault { path: root_path })? {
        RpcPayload::VaultOpened { .. } => Ok(()),
        _ => Err("unexpected daemon open vault response".into()),
    }
}

#[tauri::command]
pub fn daemon_health_diagnostics() -> Result<String, String> {
    match daemon_rpc(RpcMethod::HealthDiagnostics)? {
        RpcPayload::HealthDiagnostics { json } => Ok(json),
        _ => Err("unexpected daemon health response".into()),
    }
}

#[tauri::command]
pub fn daemon_health_report() -> Result<String, String> {
    match daemon_rpc(RpcMethod::HealthReport)? {
        RpcPayload::HealthReport { json } => Ok(json),
        _ => Err("unexpected daemon health report response".into()),
    }
}

#[tauri::command]
pub fn daemon_rebuild_index() -> Result<String, String> {
    let rebuild = match daemon_rpc(RpcMethod::RebuildIndex)? {
        RpcPayload::RebuildSummary {
            indexed_notes,
            skipped_notes,
            links_written,
        } => serde_json::json!({
            "indexed_notes": indexed_notes,
            "skipped_notes": skipped_notes,
            "links_written": links_written,
        }),
        _ => return Err("unexpected daemon rebuild response".into()),
    };
    let health_json = daemon_health_report()?;
    let health: serde_json::Value =
        serde_json::from_str(&health_json).map_err(|error| error.to_string())?;
    let cache_status = health
        .get("cache_status")
        .cloned()
        .unwrap_or_else(|| serde_json::Value::String("unknown".into()));
    let summary = serde_json::json!({
        "indexed_notes": rebuild["indexed_notes"],
        "skipped_notes": rebuild["skipped_notes"],
        "links_written": rebuild["links_written"],
        "cache_status": cache_status,
        "health": health,
    });
    serde_json::to_string(&summary).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn daemon_search(query: String, limit: u32) -> Result<String, String> {
    match daemon_rpc(RpcMethod::SearchNotes { query, limit })? {
        RpcPayload::SearchHits { hits } => {
            let mapped: Vec<serde_json::Value> = hits
                .into_iter()
                .map(|hit| {
                    serde_json::json!({
                        "note_id": hit.path,
                        "path": hit.path,
                        "title": hit.title,
                        "snippet": hit.snippet,
                    })
                })
                .collect();
            serde_json::to_string(&mapped).map_err(|error| error.to_string())
        }
        _ => Err("unexpected daemon search response".into()),
    }
}

#[tauri::command]
pub fn daemon_list_note_summaries() -> Result<String, String> {
    match daemon_rpc(RpcMethod::ListNotes)? {
        RpcPayload::NoteList { notes } => {
            let mapped: Vec<serde_json::Value> = notes
                .into_iter()
                .map(|note| {
                    serde_json::json!({
                        "path": note.path,
                        "title": note.title,
                        "modified_at": "",
                        "note_type": null,
                        "organized": false,
                        "archived": false,
                        "tags": [],
                    })
                })
                .collect();
            serde_json::to_string(&mapped).map_err(|error| error.to_string())
        }
        _ => Err("unexpected daemon note list response".into()),
    }
}

#[tauri::command]
pub fn daemon_backlinks(path: String) -> Result<String, String> {
    match daemon_rpc(RpcMethod::Backlinks { path })? {
        RpcPayload::Backlinks { json, .. } => Ok(json),
        _ => Err("unexpected daemon backlinks response".into()),
    }
}

#[tauri::command]
pub fn daemon_graph(focus_path: Option<String>, depth: u32) -> Result<String, String> {
    match daemon_rpc(RpcMethod::GraphSummary {
        path: focus_path,
        depth,
    })? {
        RpcPayload::GraphSummary { json } => Ok(json),
        _ => Err("unexpected daemon graph response".into()),
    }
}

#[tauri::command]
pub fn daemon_git_status() -> Result<String, String> {
    match daemon_rpc(RpcMethod::GitStatus)? {
        RpcPayload::GitStatus { json } => Ok(json),
        _ => Err("unexpected daemon git status response".into()),
    }
}

#[tauri::command]
pub fn daemon_save_note(
    path: String,
    markdown: String,
    expected_content_hash: Option<String>,
    dry_run: Option<bool>,
) -> Result<String, String> {
    match daemon_rpc(RpcMethod::SaveNote {
        path,
        markdown,
        expected_content_hash,
        dry_run: dry_run.unwrap_or(false),
    })? {
        RpcPayload::NoteSaved { json } => Ok(json),
        _ => Err("unexpected daemon save response".into()),
    }
}

#[tauri::command]
pub fn daemon_update_note_index(path: String) -> Result<bool, String> {
    match daemon_rpc(RpcMethod::UpdateNoteIndex { path })? {
        RpcPayload::Unit => Ok(true),
        _ => Err("unexpected daemon index update response".into()),
    }
}

#[tauri::command]
pub fn daemon_rename_apply(
    from_path: String,
    to_path: String,
    update_links: bool,
) -> Result<String, String> {
    match daemon_rpc(RpcMethod::RenameNoteApply {
        from_path,
        to_path,
        update_links,
    })? {
        RpcPayload::RenameApplied { json } => Ok(json),
        _ => Err("unexpected daemon rename response".into()),
    }
}

#[tauri::command]
pub fn daemon_export_run_note(
    note_path: String,
    format: String,
    dry_run: Option<bool>,
    extra_pandoc_args: Option<Vec<String>>,
    output_subdirectory: Option<String>,
) -> Result<String, String> {
    match daemon_rpc(RpcMethod::ExportRunNote {
        note_path,
        format,
        dry_run: dry_run.unwrap_or(false),
        extra_pandoc_args: extra_pandoc_args.unwrap_or_default(),
        output_subdirectory,
    })? {
        RpcPayload::ExportResult { json } => Ok(json),
        _ => Err("unexpected daemon export response".into()),
    }
}

#[tauri::command]
pub fn daemon_export_run_markdown(
    note_path: String,
    source_markdown: String,
    format: String,
    dry_run: Option<bool>,
    extra_pandoc_args: Option<Vec<String>>,
    output_subdirectory: Option<String>,
) -> Result<String, String> {
    match daemon_rpc(RpcMethod::ExportRunMarkdown {
        note_path,
        source_markdown,
        format,
        dry_run: dry_run.unwrap_or(false),
        extra_pandoc_args: extra_pandoc_args.unwrap_or_default(),
        output_subdirectory,
    })? {
        RpcPayload::ExportResult { json } => Ok(json),
        _ => Err("unexpected daemon export markdown response".into()),
    }
}

#[tauri::command]
pub fn daemon_export_start_note(
    note_path: String,
    format: String,
    dry_run: Option<bool>,
    extra_pandoc_args: Option<Vec<String>>,
    output_subdirectory: Option<String>,
) -> Result<String, String> {
    match daemon_rpc(RpcMethod::ExportStartNote {
        note_path,
        format,
        dry_run: dry_run.unwrap_or(false),
        extra_pandoc_args: extra_pandoc_args.unwrap_or_default(),
        output_subdirectory,
    })? {
        RpcPayload::ExportStarted { job_id } => Ok(job_id),
        _ => Err("unexpected daemon export start response".into()),
    }
}

#[tauri::command]
pub fn daemon_export_job_status() -> Result<String, String> {
    match daemon_rpc(RpcMethod::ExportJobStatus)? {
        RpcPayload::ExportJobStatus { json } => Ok(json),
        _ => Err("unexpected daemon export status response".into()),
    }
}

#[tauri::command]
pub fn daemon_export_cancel(job_id: Option<String>) -> Result<(), String> {
    match daemon_rpc(RpcMethod::ExportCancel { job_id })? {
        RpcPayload::Unit => Ok(()),
        _ => Err("unexpected daemon export cancel response".into()),
    }
}

pub(crate) fn bridge_export_start_note(
    note_path: String,
    format: String,
    dry_run: Option<bool>,
    extra_pandoc_args: Option<Vec<String>>,
    output_subdirectory: Option<String>,
) -> Result<String, String> {
    daemon_export_start_note(
        note_path,
        format,
        dry_run,
        extra_pandoc_args,
        output_subdirectory,
    )
}

pub(crate) fn bridge_export_job_status() -> Result<String, String> {
    daemon_export_job_status()
}

pub(crate) fn bridge_export_cancel(job_id: Option<String>) -> Result<(), String> {
    daemon_export_cancel(job_id)
}

pub(crate) fn bridge_rebuild_index() -> Result<String, String> {
    daemon_rebuild_index()
}

pub(crate) fn bridge_update_note_index(path: String) -> Result<bool, String> {
    daemon_update_note_index(path)
}

pub(crate) fn bridge_search(query: String, limit: u32) -> Result<String, String> {
    daemon_search(query, limit)
}

pub(crate) fn bridge_list_note_summaries() -> Result<String, String> {
    daemon_list_note_summaries()
}

pub(crate) fn bridge_backlinks(path: String) -> Result<String, String> {
    daemon_backlinks(path)
}

pub(crate) fn bridge_graph(focus_path: Option<String>, depth: u32) -> Result<String, String> {
    daemon_graph(focus_path, depth)
}

pub(crate) fn bridge_git_status() -> Result<String, String> {
    daemon_git_status()
}

pub(crate) fn bridge_save_note(
    path: String,
    markdown: String,
    expected_content_hash: Option<String>,
    dry_run: Option<bool>,
) -> Result<String, String> {
    daemon_save_note(path, markdown, expected_content_hash, dry_run)
}

pub(crate) fn bridge_rename_apply(
    from_path: String,
    to_path: String,
    update_links: bool,
) -> Result<String, String> {
    daemon_rename_apply(from_path, to_path, update_links)
}

pub(crate) fn bridge_health_report() -> Result<String, String> {
    daemon_health_report()
}

pub(crate) fn bridge_health_diagnostics() -> Result<String, String> {
    daemon_health_diagnostics()
}

pub(crate) fn bridge_export_run_note(
    note_path: String,
    format: String,
    dry_run: Option<bool>,
    extra_pandoc_args: Option<Vec<String>>,
    output_subdirectory: Option<String>,
) -> Result<String, String> {
    daemon_export_run_note(
        note_path,
        format,
        dry_run,
        extra_pandoc_args,
        output_subdirectory,
    )
}

pub(crate) fn bridge_export_run_markdown(
    note_path: String,
    source_markdown: String,
    format: String,
    dry_run: Option<bool>,
    extra_pandoc_args: Option<Vec<String>>,
    output_subdirectory: Option<String>,
) -> Result<String, String> {
    daemon_export_run_markdown(
        note_path,
        source_markdown,
        format,
        dry_run,
        extra_pandoc_args,
        output_subdirectory,
    )
}
