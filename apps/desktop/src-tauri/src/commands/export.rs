use std::sync::Arc;

use scriptor_export_runner::{
    cancel_active_export, default_export_directory, discover_pandoc, run_export_job_with_cancel,
    ExportJobInput, ExportJobOutput, ExportProgressCallback, PandocDiscovery,
};
use scriptor_vault::{read_note, RelativeVaultPath, VaultSession};
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter};
use uuid::Uuid;

use crate::AppState;
use crate::state::{active_session, use_headless_engine};

use super::daemon::{
    bridge_export_cancel, bridge_export_job_status, bridge_export_run_markdown, bridge_export_run_note,
    bridge_export_start_note,
};
use super::shared::parse_daemon_json;

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
                    error: report.error.unwrap_or_else(|| "daemon export failed".into()),
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

    let output_directory = match output_subdirectory {
        Some(subdir) => session.root.root().join(subdir),
        None => default_export_directory(session.root.root()),
    };

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
    })
}

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

    let output_directory = match output_subdirectory {
        Some(subdir) => session.root.root().join(subdir),
        None => default_export_directory(session.root.root()),
    };

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

    run_export_job_with_cancel(input, Some(&state.export_cancel), None).map_err(|error| error.to_string())
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
    run_export_job_with_cancel(input, Some(&state.export_cancel), None).map_err(|error| error.to_string())
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
    input_path: String,
    lang_in: Option<String>,
    lang_out: Option<String>,
    output_path: Option<String>,
) -> Result<PdfTranslateOutput, String> {
    use std::path::{Path, PathBuf};

    let pdf2zh = std::env::var("SCRIPTOR_PDF2ZH_PATH").unwrap_or_else(|_| "pdf2zh".into());
    let mut command = std::process::Command::new(&pdf2zh);
    command
        .arg(&input_path)
        .arg("-li")
        .arg(lang_in.unwrap_or_else(|| "en".into()))
        .arg("-lo")
        .arg(lang_out.unwrap_or_else(|| "zh".into()));
    if let Some(out) = output_path {
        command.arg("-o").arg(out);
    }

    let status = command.status().map_err(|error| {
        format!(
            "pdf2zh was not found ({error}). Install PDFMathTranslate (pip install pdf2zh) or set SCRIPTOR_PDF2ZH_PATH."
        )
    })?;
    if !status.success() {
        return Err("pdf2zh exited with an error.".into());
    }

    let input = PathBuf::from(&input_path);
    let stem = input
        .file_stem()
        .and_then(|value| value.to_str())
        .unwrap_or("document");
    let parent = input.parent().unwrap_or_else(|| Path::new("."));
    let inferred = parent.join(format!("{stem}-dual.pdf"));
    Ok(PdfTranslateOutput {
        output_path: inferred.display().to_string(),
    })
}
