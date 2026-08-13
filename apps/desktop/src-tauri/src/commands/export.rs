use std::sync::Arc;

use scriptor_export_runner::{
    ExportJobInput, ExportJobOutput, ExportProgressCallback, PandocDiscovery, cancel_active_export,
    default_export_directory, discover_pandoc, run_export_job_with_cancel,
};
use scriptor_vault::{RelativeVaultPath, VaultSession, load_plugin_state, read_note};
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter};
use uuid::Uuid;

use crate::AppState;
use crate::authorization::{SensitiveOperation, require_sensitive_operation};
use crate::state::{active_session, use_headless_engine};

use super::daemon::{
    bridge_export_cancel, bridge_export_job_status, bridge_export_run_markdown,
    bridge_export_run_note, bridge_export_start_note,
};
use super::shared::parse_daemon_json;

fn require_export_capability(state: &tauri::State<AppState>) -> Result<(), String> {
    let session = active_session(state)?;
    let plugin_state = load_plugin_state(session.root.root()).map_err(|error| error.to_string())?;
    if plugin_state.is_enabled("scriptor.export") { Ok(()) }
    else { Err("Plugin capability 'scriptor.export' is disabled in active vault".into()) }
}

#[derive(Debug, Clone, Serialize)]
pub(crate) struct ExportJobStarted {
    job_id: String,
    note_path: String,
    format: String,
}

#[derive(Debug, Clone, Serialize)]
struct ExportJobFinished {
    job_id: String,
    result: ExportJobOutput,
}

#[derive(Debug, Clone, Serialize)]
struct ExportJobFailed {
    job_id: String,
    error: String,
}

#[derive(Debug, Clone, Serialize)]
struct ExportJobProgress {
    job_id: String,
    stream: String,
    chunk: String,
}

#[derive(Debug, Deserialize)]
struct DaemonExportProgressReport {
    job_id: String,
    status: String,
    phase: String,
    event_index: u32,
    result_json: Option<String>,
    error: Option<String>,
}

pub(crate) fn poll_headless_export_job(app: &AppHandle, job_id: String) -> Result<(), String> {
    let mut last_event_index = 0u32;
    loop {
        std::thread::sleep(std::time::Duration::from_millis(100));
        let json = bridge_export_job_status()?;
        let report = parse_daemon_json::<DaemonExportProgressReport>(&json)?;
        if report.job_id != job_id {
            return Err(format!(
                "daemon export status job mismatch: expected {}, got {}",
                job_id, report.job_id
            ));
        }
        if report.event_index > last_event_index {
            let _ = app.emit(
                "export:progress",
                &ExportJobProgress {
                    job_id: job_id.clone(),
                    stream: "status".into(),
                    chunk: report.phase.clone(),
                },
            );
            last_event_index = report.event_index;
        }
        match report.status.as_str() {
            "complete" => {
                let output_json = report
                    .result_json
                    .ok_or_else(|| "daemon export completed without result payload".to_string())?;
                let mut output = parse_daemon_json::<ExportJobOutput>(&output_json)?;
                output.job_id = job_id.clone();
                let _ = app.emit(
                    "export:finished",
                    &ExportJobFinished {
                        job_id,
                        result: output,
                    },
                );
                return Ok(());
            }
            "failed" => {
                let failed = ExportJobFailed {
                    job_id,
                    error: report
                        .error
                        .unwrap_or_else(|| "daemon export failed".into()),
                };
                let _ = app.emit("export:failed", &failed);
                return Ok(());
            }
            "cancelled" => {
                let failed = ExportJobFailed {
                    job_id,
                    error: "export cancelled".into(),
                };
                let _ = app.emit("export:failed", &failed);
                return Ok(());
            }
            _ => {}
        }
    }
}

/// Resolve a caller-supplied export subdirectory against the vault root.
///
/// Delegates to `VaultRoot::resolve_relative`, which rejects absolute paths and
/// traversal *and* canonicalizes every existing path prefix. The prefix walk
/// matters here because the directory is created afterwards: a lexical
/// `starts_with` check would still follow an existing symlinked parent that
/// redirects the export outside the vault.
fn resolve_output_directory(
    session: &VaultSession,
    output_subdirectory: Option<String>,
) -> Result<std::path::PathBuf, String> {
    match output_subdirectory {
        Some(subdir) => {
            let relative = RelativeVaultPath::parse(&subdir)
                .map_err(|error| format!("invalid output_subdirectory: {error}"))?;
            session
                .root
                .resolve_relative(&relative)
                .map_err(|error| format!("invalid output_subdirectory: {error}"))
        }
        None => Ok(default_export_directory(session.root.root())),
    }
}

fn build_export_job_input(
    session: &VaultSession,
    note_path: &str,
    format: &str,
    dry_run: bool,
    extra_pandoc_args: Vec<String>,
    output_subdirectory: Option<String>,
    job_id: Option<String>,
) -> Result<ExportJobInput, String> {
    let relative = RelativeVaultPath::parse(note_path).map_err(|error| error.to_string())?;
    let note = read_note(&session.descriptor.id, &session.root, &relative)
        .map_err(|error| error.to_string())?;
    let stem = note_path
        .trim_end_matches(".md")
        .rsplit('/')
        .next()
        .unwrap_or("note");

    let output_directory = resolve_output_directory(session, output_subdirectory)?;

    let config = scriptor_vault::load_vault_config(session.root.root())
        .map_err(|error| error.to_string())?;
    let trusted_pandoc_hash = config.trusted_binaries.and_then(|tb| tb.pandoc_hash);

    Ok(ExportJobInput {
        format: format.to_string(),
        source_markdown: note.markdown,
        output_directory: output_directory.display().to_string(),
        source_stem: stem.to_string(),
        title: Some(note.metadata.title),
        dry_run,
        extra_pandoc_args,
        vault_root: session.root.root().display().to_string(),
        job_id,
        preserve_temp_on_failure: false,
        trusted_pandoc_hash,
        redact_secrets: false,
    })
}

#[allow(clippy::too_many_arguments)]
fn build_export_job_from_markdown(
    session: &VaultSession,
    note_path: &str,
    source_markdown: String,
    format: &str,
    dry_run: bool,
    extra_pandoc_args: Vec<String>,
    output_subdirectory: Option<String>,
    job_id: Option<String>,
) -> Result<ExportJobInput, String> {
    let relative = RelativeVaultPath::parse(note_path).map_err(|error| error.to_string())?;
    let note = read_note(&session.descriptor.id, &session.root, &relative)
        .map_err(|error| error.to_string())?;
    let stem = note_path
        .trim_end_matches(".md")
        .rsplit('/')
        .next()
        .unwrap_or("note");

    let output_directory = resolve_output_directory(session, output_subdirectory)?;

    let config = scriptor_vault::load_vault_config(session.root.root())
        .map_err(|error| error.to_string())?;
    let trusted_pandoc_hash = config.trusted_binaries.and_then(|tb| tb.pandoc_hash);

    Ok(ExportJobInput {
        format: format.to_string(),
        source_markdown,
        output_directory: output_directory.display().to_string(),
        source_stem: stem.to_string(),
        title: Some(note.metadata.title),
        dry_run,
        extra_pandoc_args,
        vault_root: session.root.root().display().to_string(),
        job_id,
        preserve_temp_on_failure: false,
        trusted_pandoc_hash,
        redact_secrets: false,
    })
}

#[tauri::command]
pub fn export_discover() -> Result<PandocDiscovery, String> {
    discover_pandoc().map_err(|error| error.to_string())
}

#[tauri::command]
pub fn export_run_note(
    state: tauri::State<AppState>,
    note_path: String,
    format: String,
    dry_run: Option<bool>,
    extra_pandoc_args: Option<Vec<String>>,
    output_subdirectory: Option<String>,
) -> Result<ExportJobOutput, String> {
    require_export_capability(&state)?;
    if use_headless_engine(&state) {
        let json = bridge_export_run_note(
            note_path,
            format,
            dry_run,
            extra_pandoc_args,
            output_subdirectory,
        )?;
        return parse_daemon_json(&json);
    }
    let session = active_session(&state)?;
    let input = build_export_job_input(
        &session,
        &note_path,
        &format,
        dry_run.unwrap_or(false),
        extra_pandoc_args.unwrap_or_default(),
        output_subdirectory,
        None,
    )?;

    run_export_job_with_cancel(input, Some(&state.export_cancel), None)
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn export_run_markdown(
    state: tauri::State<AppState>,
    note_path: String,
    source_markdown: String,
    format: String,
    dry_run: Option<bool>,
    extra_pandoc_args: Option<Vec<String>>,
    output_subdirectory: Option<String>,
) -> Result<ExportJobOutput, String> {
    require_export_capability(&state)?;
    if use_headless_engine(&state) {
        let json = bridge_export_run_markdown(
            note_path,
            source_markdown,
            format,
            dry_run,
            extra_pandoc_args,
            output_subdirectory,
        )?;
        return parse_daemon_json(&json);
    }
    let session = active_session(&state)?;
    let input = build_export_job_from_markdown(
        &session,
        &note_path,
        source_markdown,
        &format,
        dry_run.unwrap_or(false),
        extra_pandoc_args.unwrap_or_default(),
        output_subdirectory,
        None,
    )?;
    run_export_job_with_cancel(input, Some(&state.export_cancel), None)
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn export_start_note(
    app: AppHandle,
    state: tauri::State<'_, AppState>,
    note_path: String,
    format: String,
    dry_run: Option<bool>,
    extra_pandoc_args: Option<Vec<String>>,
    output_subdirectory: Option<String>,
) -> Result<ExportJobStarted, String> {
    require_export_capability(&state)?;
    let job_id = Uuid::new_v4().to_string();
    let started = ExportJobStarted {
        job_id: job_id.clone(),
        note_path: note_path.clone(),
        format: format.clone(),
    };

    if use_headless_engine(&state) {
        let _ = app.emit("export:started", &started);
        let app_handle = app.clone();
        let poll_job_id = job_id.clone();
        let fail_job_id = job_id.clone();
        tauri::async_runtime::spawn(async move {
            let app_for_poll = app_handle.clone();
            let blocking = tauri::async_runtime::spawn_blocking(move || {
                bridge_export_start_note(
                    note_path,
                    format,
                    dry_run,
                    extra_pandoc_args,
                    output_subdirectory,
                )?;
                poll_headless_export_job(&app_for_poll, poll_job_id)
            });
            match blocking.await {
                Ok(Ok(())) => {}
                Ok(Err(error)) => {
                    let _ = app_handle.emit(
                        "export:failed",
                        &ExportJobFailed {
                            job_id: fail_job_id,
                            error,
                        },
                    );
                }
                Err(join_error) => {
                    let _ = app_handle.emit(
                        "export:failed",
                        &ExportJobFailed {
                            job_id: fail_job_id,
                            error: join_error.to_string(),
                        },
                    );
                }
            }
        });
        return Ok(started);
    }

    let session = active_session(&state)?;
    let input = build_export_job_input(
        &session,
        &note_path,
        &format,
        dry_run.unwrap_or(false),
        extra_pandoc_args.unwrap_or_default(),
        output_subdirectory,
        Some(job_id.clone()),
    )?;
    let cancel_slot = state.export_cancel.clone();
    let _ = app.emit("export:started", &started);

    let app_handle = app.clone();
    tauri::async_runtime::spawn(async move {
        let progress_job_id = job_id.clone();
        let progress_app = app_handle.clone();
        let progress: ExportProgressCallback = Arc::new(move |chunk: &str| {
            let _ = progress_app.emit(
                "export:progress",
                &ExportJobProgress {
                    job_id: progress_job_id.clone(),
                    stream: "stderr".into(),
                    chunk: chunk.to_string(),
                },
            );
        });

        let result = tauri::async_runtime::spawn_blocking(move || {
            run_export_job_with_cancel(input, Some(&cancel_slot), Some(progress))
        })
        .await;

        match result {
            Ok(Ok(output)) => {
                let finished = ExportJobFinished {
                    job_id: output.job_id.clone(),
                    result: output,
                };
                let _ = app_handle.emit("export:finished", &finished);
            }
            Ok(Err(error)) => {
                let failed = ExportJobFailed {
                    job_id,
                    error: error.to_string(),
                };
                let _ = app_handle.emit("export:failed", &failed);
            }
            Err(join_error) => {
                let failed = ExportJobFailed {
                    job_id,
                    error: join_error.to_string(),
                };
                let _ = app_handle.emit("export:failed", &failed);
            }
        }
    });

    Ok(started)
}

#[tauri::command]
pub fn export_cancel(state: tauri::State<AppState>) -> Result<bool, String> {
    require_export_capability(&state)?;
    if use_headless_engine(&state) {
        bridge_export_cancel(None)?;
        return Ok(true);
    }
    Ok(cancel_active_export(&state.export_cancel).is_some())
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PdfTranslateOutput {
    output_path: String,
}

#[tauri::command]
pub fn pdf_translate(
    state: tauri::State<AppState>,
    input_path: String,
    lang_in: Option<String>,
    lang_out: Option<String>,
    output_path: Option<String>,
    authorization_token: String,
) -> Result<PdfTranslateOutput, String> {
    use std::path::Path;

    require_sensitive_operation(
        &state,
        &authorization_token,
        SensitiveOperation::PdfTranslation,
        Some(&input_path),
    )?;
    let session = active_session(&state)?;
    let relative = RelativeVaultPath::parse(&input_path)
        .map_err(|error| format!("invalid input_path: {error}"))?;
    let resolved = session
        .root
        .resolve_relative(&relative)
        .map_err(|error| error.to_string())?;
    let resolved_str = resolved.display().to_string();

    let pdf2zh = std::env::var("SCRIPTOR_PDF2ZH_PATH").unwrap_or_else(|_| "pdf2zh".into());
    let mut args = vec![
        resolved_str,
        "-li".into(),
        lang_in.unwrap_or_else(|| "en".into()),
        "-lo".into(),
        lang_out.unwrap_or_else(|| "zh".into()),
    ];
    let explicit_output = if let Some(out) = output_path {
        let out_relative = RelativeVaultPath::parse(&out)
            .map_err(|error| format!("invalid output_path: {error}"))?;
        let out_resolved = session
            .root
            .resolve_relative(&out_relative)
            .map_err(|error| error.to_string())?;
        args.push("-o".into());
        args.push(out_resolved.display().to_string());
        Some(out_resolved)
    } else {
        None
    };

    let receipt = scriptor_system_bridge::run_process(
        scriptor_system_bridge::ProcessSpec::new(&pdf2zh)
            .args(args)
            .current_dir(session.root.root())
            .timeout(std::time::Duration::from_secs(15 * 60))
            .max_output_bytes(512 * 1024)
            .network_policy(scriptor_system_bridge::NetworkPolicy::Allow)
            .expected_sha256(std::env::var("SCRIPTOR_PDF2ZH_SHA256").ok()),
    )
    .map_err(|error| {
        format!(
            "PDF translation failed ({error}). Install PDFMathTranslate or configure SCRIPTOR_PDF2ZH_PATH and SCRIPTOR_PDF2ZH_SHA256."
        )
    })?;
    if receipt.exit_code != 0 {
        return Err(format!(
            "pdf2zh exited with code {}: {}",
            receipt.exit_code,
            receipt.stderr.trim()
        ));
    }

    let stem = resolved
        .file_stem()
        .and_then(|value| value.to_str())
        .unwrap_or("document");
    let parent = resolved.parent().unwrap_or_else(|| Path::new("."));
    let output = explicit_output.unwrap_or_else(|| parent.join(format!("{stem}-dual.pdf")));
    Ok(PdfTranslateOutput {
        output_path: output.display().to_string(),
    })
}
