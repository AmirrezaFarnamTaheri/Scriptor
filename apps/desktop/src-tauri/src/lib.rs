use std::sync::Arc;

use scriptor_export_runner::{
    cancel_active_export, default_export_directory, discover_pandoc, run_export_job_with_cancel,
    ExportJobInput, ExportJobOutput, ExportProgressCallback, PandocDiscovery,
};
use scriptor_system_bridge::{detect_system_info, keychain_delete, keychain_get, keychain_set, SystemInfo};
use scriptor_indexer::{
    backlinks_for_path, evaluate_view_filter_json, execute_dql_query, health_diagnostics_json, health_report_json,
    incremental_note_index, incremental_notes_index, list_bibliography_entries, list_dead_end_notes,
    list_inbox_notes, list_note_summaries, list_orphan_notes, list_recent_files, list_unresolved_link_targets, list_vault_tags, list_view_notes,
    notes_for_tag, open_cache_for_session, parse_note_markdown, query_focused_graph, rebuild_index,
    record_recent_access, resolve_wikilink_target_with_aliases, search_notes, traverse_graph, BacklinkHit,
    BibliographyEntry, DqlResultRow, GraphQueryOutput, GraphTraverseStep, IncrementalIndexSummary,
    KnowledgeNoteSummary, NoteIndexSummary, RecentFileHit, RebuildSummary, SearchHit, TagSummary, TaggedNote, UnresolvedLinkTarget,
    ViewNoteHit, WikilinkResolution,
};
use scriptor_native_git::{
    git_commit_selected, git_pull, git_push, git_resolve_conflict, git_show_head_file, git_status,
    read_conflict_markers, GitCommitOutput, GitConflictResolveOutput, GitPullOutput, GitPushOutput, GitStatus,
};
use chrono::NaiveDate;
use serde::Serialize;
use tauri::{AppHandle, Emitter};
use uuid::Uuid;
use scriptor_vault::{
    append_stats_history, block_rename_apply, block_rename_dry_run, delete_note, export_text_bundle, lint_vault_fix,
    list_recent_notes, load_vault_config, load_vault_snippets, load_vault_template, open_vault, open_vault_output,
    plan_daily_note, build_note_markdown,
    read_note, read_stats_history, record_recent_note, redact_json_value, redact_sensitive_text, rename_apply,
    rename_dry_run, save_note, save_note_with_options, save_vault_config, save_vault_snippets, scan_vault, scan_vault_with_roots,
    section_rename_apply, section_rename_dry_run, set_frontmatter_field, tag_rename_apply, tag_rename_dry_run,
    DailyNotePlan, DeleteNoteOutput, FrontmatterFieldOutput, LinkRewriteApplyOutput, LinkRewritePreview,
    LintApplyOutput, OpenVaultOutput, RecentNoteEntry, RelativeVaultPath, RenameNoteApplyOutput,
    RenameNoteDryRunOutput, SaveNoteOptions, SaveNoteOutput, ScannedEntry, StatsHistoryEntry, TextBundleExportOutput,
    VaultConfig, VaultSession, VaultSnippet, VaultWatcher, VaultWatchEvent, RULE_MISSING_HEADING,
    RULE_STALE_DEFINITIONS,
};

mod commands;
mod state;

pub use state::AppState;
use state::active_session;

use commands::canvas::{
    canvas_apply_template, canvas_hit_test, canvas_list_documents, canvas_list_templates, canvas_load_document,
    canvas_query_blocks, canvas_render_svg, canvas_restore_template, canvas_save_document, canvas_snapshot,
    canvas_template_dry_run,
};
use commands::code_chunk::{code_chunk_run, vault_publish_starlight};
use commands::daemon::{
    daemon_backlinks, daemon_endpoint, daemon_export_run_markdown, daemon_export_run_note,
    daemon_git_status, daemon_graph, daemon_health_diagnostics, daemon_health_report,
    daemon_list_note_summaries, daemon_open_vault, daemon_ping, daemon_rebuild_index,
    daemon_rename_apply, daemon_save_note, daemon_search, daemon_start, daemon_update_note_index,
};
use commands::media::{render_plantuml_svg, save_vault_asset, PlantUmlRenderOutput};

#[derive(Debug, Clone, Serialize)]
struct VaultFilesystemChanged {
    events: Vec<VaultWatchEvent>,
}

fn restart_vault_watcher(app: &AppHandle, state: &AppState, session: &VaultSession) -> Result<(), String> {
    {
        let mut guard = state.vault_watcher.lock().expect("vault watcher lock");
        *guard = None;
    }

    let app_handle = app.clone();
    let watcher = VaultWatcher::start(&session.root, 300, move |events| {
        let payload = VaultFilesystemChanged { events };
        let _ = app_handle.emit("vault:filesystem-changed", &payload);
    })
    .map_err(|error| error.to_string())?;

    *state
        .vault_watcher
        .lock()
        .expect("vault watcher lock") = Some(watcher);
    Ok(())
}

#[tauri::command]
fn vault_open(app: AppHandle, state: tauri::State<AppState>, root_path: String) -> Result<OpenVaultOutput, String> {
    let session = open_vault(&root_path).map_err(|error| error.to_string())?;
    let output = open_vault_output(&session);
    *state.session.lock().expect("session lock") = Some(session.clone());
    restart_vault_watcher(&app, &state, &session)?;
    Ok(output)
}

#[tauri::command]
fn vault_scan(state: tauri::State<AppState>) -> Result<Vec<ScannedEntry>, String> {
    let session = active_session(&state)?;
    let config = load_vault_config(session.root.root()).unwrap_or_default();
    scan_vault_with_roots(&session.root, &config.extra_roots).map_err(|error| error.to_string())
}

#[tauri::command]
fn vault_read_note(state: tauri::State<AppState>, path: String) -> Result<scriptor_vault::NoteDocument, String> {
    let session = active_session(&state)?;
    let relative = RelativeVaultPath::parse(&path).map_err(|error| error.to_string())?;
    read_note(&session.descriptor.id, &session.root, &relative).map_err(|error| error.to_string())
}

#[tauri::command]
fn vault_save_note(
    state: tauri::State<AppState>,
    path: String,
    markdown: String,
    expected_content_hash: Option<String>,
    dry_run: Option<bool>,
) -> Result<SaveNoteOutput, String> {
    let session = active_session(&state)?;
    let relative = RelativeVaultPath::parse(&path).map_err(|error| error.to_string())?;
    save_note_with_options(
        &session.descriptor.id,
        &session.root,
        &relative,
        &markdown,
        expected_content_hash.as_deref(),
        SaveNoteOptions {
            dry_run: dry_run.unwrap_or(false),
        },
    )
    .map_err(|error| error.to_string())
}

#[tauri::command]
fn vault_list_recent_notes(
    state: tauri::State<AppState>,
    limit: Option<u32>,
) -> Result<Vec<RecentNoteEntry>, String> {
    let session = active_session(&state)?;
    list_recent_notes(&session.root, limit.unwrap_or(20) as usize).map_err(|error| error.to_string())
}

#[tauri::command]
fn vault_record_recent_note(state: tauri::State<AppState>, path: String) -> Result<Vec<RecentNoteEntry>, String> {
    let session = active_session(&state)?;
    record_recent_note(&session.root, &path).map_err(|error| error.to_string())
}

#[tauri::command]
fn indexer_rebuild(state: tauri::State<AppState>) -> Result<RebuildSummary, String> {
    let session = active_session(&state)?;
    rebuild_index(&session, &[]).map_err(|error| error.to_string())
}

#[tauri::command]
fn indexer_update_note(state: tauri::State<AppState>, path: String) -> Result<bool, String> {
    let session = active_session(&state)?;
    incremental_note_index(&session, &path, &[]).map_err(|error| error.to_string())
}

#[tauri::command]
fn indexer_apply_filesystem_changes(
    state: tauri::State<AppState>,
    paths: Vec<String>,
) -> Result<IncrementalIndexSummary, String> {
    let session = active_session(&state)?;
    incremental_notes_index(&session, &paths, &[]).map_err(|error| error.to_string())
}

#[tauri::command]
fn indexer_search(
    state: tauri::State<AppState>,
    query: String,
    limit: Option<u32>,
) -> Result<Vec<SearchHit>, String> {
    let session = active_session(&state)?;
    let cache = open_cache_for_session(&session).map_err(|error| error.to_string())?;
    search_notes(&cache, &session.descriptor.id, &query, limit.unwrap_or(25))
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn indexer_backlinks(state: tauri::State<AppState>, path: String) -> Result<Vec<BacklinkHit>, String> {
    let session = active_session(&state)?;
    let cache = open_cache_for_session(&session).map_err(|error| error.to_string())?;
    backlinks_for_path(&cache, &session, &path).map_err(|error| error.to_string())
}

#[tauri::command]
fn vault_rename_dry_run(
    state: tauri::State<AppState>,
    from_path: String,
    to_path: String,
    update_links: bool,
) -> Result<RenameNoteDryRunOutput, String> {
    let session = active_session(&state)?;
    let from = RelativeVaultPath::parse(&from_path).map_err(|error| error.to_string())?;
    let to = RelativeVaultPath::parse(&to_path).map_err(|error| error.to_string())?;
    rename_dry_run(
        &session.descriptor.id,
        &session.root,
        &from,
        &to,
        update_links,
    )
    .map_err(|error| error.to_string())
}

#[tauri::command]
fn vault_rename_apply(
    state: tauri::State<AppState>,
    from_path: String,
    to_path: String,
    update_links: bool,
) -> Result<RenameNoteApplyOutput, String> {
    let session = active_session(&state)?;
    let from = RelativeVaultPath::parse(&from_path).map_err(|error| error.to_string())?;
    let to = RelativeVaultPath::parse(&to_path).map_err(|error| error.to_string())?;
    rename_apply(
        &session.descriptor.id,
        &session.root,
        &from,
        &to,
        update_links,
    )
    .map_err(|error| error.to_string())
}

#[tauri::command]
fn vault_rename_tag_dry_run(
    state: tauri::State<AppState>,
    old_tag: String,
    new_tag: String,
) -> Result<LinkRewritePreview, String> {
    let session = active_session(&state)?;
    tag_rename_dry_run(&session.descriptor.id, &session.root, &old_tag, &new_tag)
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn vault_rename_tag_apply(
    state: tauri::State<AppState>,
    old_tag: String,
    new_tag: String,
) -> Result<LinkRewriteApplyOutput, String> {
    let session = active_session(&state)?;
    tag_rename_apply(&session.descriptor.id, &session.root, &old_tag, &new_tag)
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn vault_rename_section_dry_run(
    state: tauri::State<AppState>,
    note_path: String,
    old_section: String,
    new_section: String,
    update_heading: bool,
) -> Result<LinkRewritePreview, String> {
    let session = active_session(&state)?;
    let path = RelativeVaultPath::parse(&note_path).map_err(|error| error.to_string())?;
    section_rename_dry_run(
        &session.descriptor.id,
        &session.root,
        &path,
        &old_section,
        &new_section,
        update_heading,
    )
    .map_err(|error| error.to_string())
}

#[tauri::command]
fn vault_rename_section_apply(
    state: tauri::State<AppState>,
    note_path: String,
    old_section: String,
    new_section: String,
    update_heading: bool,
) -> Result<LinkRewriteApplyOutput, String> {
    let session = active_session(&state)?;
    let path = RelativeVaultPath::parse(&note_path).map_err(|error| error.to_string())?;
    section_rename_apply(
        &session.descriptor.id,
        &session.root,
        &path,
        &old_section,
        &new_section,
        update_heading,
    )
    .map_err(|error| error.to_string())
}

#[tauri::command]
fn vault_rename_block_dry_run(
    state: tauri::State<AppState>,
    note_path: String,
    old_block: String,
    new_block: String,
    update_anchor: bool,
) -> Result<LinkRewritePreview, String> {
    let session = active_session(&state)?;
    let path = RelativeVaultPath::parse(&note_path).map_err(|error| error.to_string())?;
    block_rename_dry_run(
        &session.descriptor.id,
        &session.root,
        &path,
        &old_block,
        &new_block,
        update_anchor,
    )
    .map_err(|error| error.to_string())
}

#[tauri::command]
fn vault_rename_block_apply(
    state: tauri::State<AppState>,
    note_path: String,
    old_block: String,
    new_block: String,
    update_anchor: bool,
) -> Result<LinkRewriteApplyOutput, String> {
    let session = active_session(&state)?;
    let path = RelativeVaultPath::parse(&note_path).map_err(|error| error.to_string())?;
    block_rename_apply(
        &session.descriptor.id,
        &session.root,
        &path,
        &old_block,
        &new_block,
        update_anchor,
    )
    .map_err(|error| error.to_string())
}

#[tauri::command]
fn indexer_graph(
    state: tauri::State<AppState>,
    focus_path: Option<String>,
    depth: Option<u32>,
) -> Result<GraphQueryOutput, String> {
    let session = active_session(&state)?;
    let cache = open_cache_for_session(&session).map_err(|error| error.to_string())?;
    let config = load_vault_config(session.root.root()).unwrap_or_default();
    query_focused_graph(
        &cache,
        &session,
        focus_path.as_deref(),
        depth.unwrap_or(1),
        &config.graph_groups,
    )
    .map_err(|error| error.to_string())
}

#[derive(Debug, Clone, Serialize)]
struct ExportJobStarted {
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
fn export_discover() -> Result<PandocDiscovery, String> {
    discover_pandoc().map_err(|error| error.to_string())
}

#[tauri::command]
fn export_run_note(
    state: tauri::State<AppState>,
    note_path: String,
    format: String,
    dry_run: Option<bool>,
    extra_pandoc_args: Option<Vec<String>>,
    output_subdirectory: Option<String>,
) -> Result<ExportJobOutput, String> {
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
fn export_run_markdown(
    state: tauri::State<AppState>,
    note_path: String,
    source_markdown: String,
    format: String,
    dry_run: Option<bool>,
    extra_pandoc_args: Option<Vec<String>>,
    output_subdirectory: Option<String>,
) -> Result<ExportJobOutput, String> {
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
async fn export_start_note(
    app: AppHandle,
    state: tauri::State<'_, AppState>,
    note_path: String,
    format: String,
    dry_run: Option<bool>,
    extra_pandoc_args: Option<Vec<String>>,
    output_subdirectory: Option<String>,
) -> Result<ExportJobStarted, String> {
    let session = active_session(&state)?;
    let job_id = Uuid::new_v4().to_string();
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
    let started = ExportJobStarted {
        job_id: job_id.clone(),
        note_path: note_path.clone(),
        format: format.clone(),
    };

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
fn export_cancel(state: tauri::State<AppState>) -> Result<bool, String> {
    Ok(cancel_active_export(&state.export_cancel).is_some())
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct PdfTranslateOutput {
    output_path: String,
}

#[tauri::command]
fn pdf_translate(
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

#[tauri::command]
fn git_status_cmd(state: tauri::State<AppState>) -> Result<GitStatus, String> {
    let session = active_session(&state)?;
    git_status(session.root.root()).map_err(|error| error.to_string())
}

#[tauri::command]
fn git_commit_cmd(
    state: tauri::State<AppState>,
    files: Vec<String>,
    message: String,
) -> Result<GitCommitOutput, String> {
    let session = active_session(&state)?;
    git_commit_selected(session.root.root(), &files, &message).map_err(|error| error.to_string())
}

#[tauri::command]
fn git_pull_cmd(state: tauri::State<AppState>) -> Result<GitPullOutput, String> {
    let session = active_session(&state)?;
    git_pull(session.root.root()).map_err(|error| error.to_string())
}

#[tauri::command]
fn git_push_cmd(state: tauri::State<AppState>) -> Result<GitPushOutput, String> {
    let session = active_session(&state)?;
    git_push(session.root.root()).map_err(|error| error.to_string())
}

#[tauri::command]
fn git_resolve_conflict_cmd(
    state: tauri::State<AppState>,
    path: String,
    strategy: String,
) -> Result<GitConflictResolveOutput, String> {
    let session = active_session(&state)?;
    git_resolve_conflict(session.root.root(), &path, &strategy).map_err(|error| error.to_string())
}

#[tauri::command]
fn git_read_conflict_markers_cmd(state: tauri::State<AppState>, path: String) -> Result<Vec<String>, String> {
    let session = active_session(&state)?;
    let file_path = session.root.root().join(path.replace('/', std::path::MAIN_SEPARATOR_STR));
    read_conflict_markers(&file_path).map_err(|error| error.to_string())
}

#[tauri::command]
fn git_show_head_file_cmd(state: tauri::State<AppState>, path: String) -> Result<Option<String>, String> {
    let session = active_session(&state)?;
    git_show_head_file(session.root.root(), &path).map_err(|error| error.to_string())
}

#[tauri::command]
fn vault_delete_note(state: tauri::State<AppState>, path: String) -> Result<DeleteNoteOutput, String> {
    let session = active_session(&state)?;
    let relative = RelativeVaultPath::parse(&path).map_err(|error| error.to_string())?;
    delete_note(&session.root, &relative).map_err(|error| error.to_string())
}

#[tauri::command]
fn indexer_execute_dql(state: tauri::State<AppState>, query: String) -> Result<Vec<DqlResultRow>, String> {
    let session = active_session(&state)?;
    let cache = open_cache_for_session(&session).map_err(|error| error.to_string())?;
    execute_dql_query(&cache, &session, &query).map_err(|error| error.to_string())
}

#[tauri::command]
fn vault_read_stats_history(state: tauri::State<AppState>) -> Result<Vec<StatsHistoryEntry>, String> {
    let session = active_session(&state)?;
    let config = load_vault_config(session.root.root()).unwrap_or_default();
    let path = config
        .writing_targets
        .history_path
        .as_deref()
        .unwrap_or(scriptor_vault::DEFAULT_STATS_HISTORY_PATH);
    read_stats_history(&session.root, path).map_err(|error| error.to_string())
}

#[tauri::command]
fn vault_append_stats_history(
    state: tauri::State<AppState>,
    date: String,
    words: u32,
) -> Result<Vec<StatsHistoryEntry>, String> {
    let session = active_session(&state)?;
    let config = load_vault_config(session.root.root()).unwrap_or_default();
    let path = config
        .writing_targets
        .history_path
        .as_deref()
        .unwrap_or(scriptor_vault::DEFAULT_STATS_HISTORY_PATH);
    append_stats_history(
        &session.root,
        path,
        StatsHistoryEntry { date, words },
    )
    .map_err(|error| error.to_string())
}

#[tauri::command]
fn vault_frontmatter_set(
    state: tauri::State<AppState>,
    path: String,
    field: String,
    value: String,
) -> Result<FrontmatterFieldOutput, String> {
    let session = active_session(&state)?;
    let relative = RelativeVaultPath::parse(&path).map_err(|error| error.to_string())?;
    let document = read_note(&session.descriptor.id, &session.root, &relative).map_err(|error| error.to_string())?;
    let markdown = set_frontmatter_field(&document.markdown, &field, &value).map_err(|error| error.to_string())?;
    let _saved = save_note(
        &session.descriptor.id,
        &session.root,
        &relative,
        &markdown,
        Some(&document.metadata.content_hash),
    )
    .map_err(|error| error.to_string())?;
    Ok(FrontmatterFieldOutput {
        path,
        field,
        value: Some(value),
        markdown: read_note(&session.descriptor.id, &session.root, &relative)
            .map_err(|error| error.to_string())?
            .markdown,
    })
}

#[tauri::command]
fn indexer_traverse_graph(
    state: tauri::State<AppState>,
    focus_path: String,
    depth: u32,
) -> Result<Vec<GraphTraverseStep>, String> {
    let session = active_session(&state)?;
    let cache = open_cache_for_session(&session).map_err(|error| error.to_string())?;
    traverse_graph(&cache, &session, &focus_path, depth).map_err(|error| error.to_string())
}

#[tauri::command]
fn vault_textbundle_export(
    state: tauri::State<AppState>,
    note_path: String,
    output_path: String,
) -> Result<TextBundleExportOutput, String> {
    let session = active_session(&state)?;
    let relative = RelativeVaultPath::parse(&note_path).map_err(|error| error.to_string())?;
    export_text_bundle(
        &session.descriptor.id,
        &session.root,
        &relative,
        std::path::Path::new(&output_path),
    )
    .map_err(|error| error.to_string())
}

#[tauri::command]
fn indexer_health_diagnostics(state: tauri::State<AppState>) -> Result<String, String> {
    let session = active_session(&state)?;
    let cache = open_cache_for_session(&session).map_err(|error| error.to_string())?;
    health_diagnostics_json(&cache, &session).map_err(|error| error.to_string())
}

#[tauri::command]
fn vault_health(state: tauri::State<AppState>) -> Result<String, String> {
    let session = active_session(&state)?;
    let cache = open_cache_for_session(&session).map_err(|error| error.to_string())?;
    health_report_json(&cache, &session).map_err(|error| error.to_string())
}

#[tauri::command]
fn keychain_set_secret(account: String, secret: String) -> Result<(), String> {
    keychain_set(&account, &secret).map_err(|error| error.to_string())
}

#[tauri::command]
fn keychain_get_secret(account: String) -> Result<Option<String>, String> {
    keychain_get(&account).map_err(|error| error.to_string())
}

#[tauri::command]
fn keychain_delete_secret(account: String) -> Result<(), String> {
    keychain_delete(&account).map_err(|error| error.to_string())
}

#[tauri::command]
fn diagnostics_append_event(
    state: tauri::State<AppState>,
    event_type: String,
    message: String,
    detail_json: Option<String>,
) -> Result<(), String> {
    let session = active_session(&state)?;
    let diagnostics_dir = session
        .root
        .root()
        .join(".scriptor")
        .join("diagnostics");
    std::fs::create_dir_all(&diagnostics_dir).map_err(|error| error.to_string())?;

    let timestamp_secs = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|duration| duration.as_secs())
        .unwrap_or(0);

    let redacted_message = redact_sensitive_text(&message);
    let redacted_detail = detail_json.as_ref().and_then(|raw| {
        serde_json::from_str::<serde_json::Value>(raw)
            .ok()
            .map(|value| serde_json::to_string(&redact_json_value(&value)).unwrap_or_else(|_| "\"[REDACTED]\"".into()))
    });

    let line = serde_json::json!({
        "ts": timestamp_secs,
        "type": event_type,
        "message": redacted_message,
        "detail": redacted_detail,
    });

    use std::io::Write;
    let mut file = std::fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(diagnostics_dir.join("client.jsonl"))
        .map_err(|error| error.to_string())?;
    writeln!(file, "{line}").map_err(|error| error.to_string())?;
    Ok(())
}

#[tauri::command]
fn health_check() -> &'static str {
    "ok"
}

#[tauri::command]
fn copy_text_to_clipboard(text: String) -> Result<(), String> {
    arboard::Clipboard::new()
        .map_err(|error| error.to_string())?
        .set_text(text)
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn plantuml_render(source: String) -> Result<PlantUmlRenderOutput, String> {
    render_plantuml_svg(&source)
}

#[tauri::command]
fn vault_save_asset(
    state: tauri::State<AppState>,
    relative_path: String,
    bytes: Vec<u8>,
) -> Result<String, String> {
    let session = active_session(&state)?;
    save_vault_asset(&session.root, &relative_path, &bytes)
}

#[tauri::command]
fn system_info() -> SystemInfo {
    detect_system_info()
}

#[tauri::command]
fn indexer_list_tags(state: tauri::State<AppState>) -> Result<Vec<TagSummary>, String> {
    let session = active_session(&state)?;
    let cache = open_cache_for_session(&session).map_err(|error| error.to_string())?;
    list_vault_tags(&cache, &session.descriptor.id).map_err(|error| error.to_string())
}

#[tauri::command]
fn indexer_notes_for_tag(state: tauri::State<AppState>, tag: String) -> Result<Vec<TaggedNote>, String> {
    let session = active_session(&state)?;
    let cache = open_cache_for_session(&session).map_err(|error| error.to_string())?;
    notes_for_tag(&cache, &session.descriptor.id, &tag).map_err(|error| error.to_string())
}

#[tauri::command]
fn vault_load_config(state: tauri::State<AppState>) -> Result<VaultConfig, String> {
    let session = active_session(&state)?;
    load_vault_config(session.root.root()).map_err(|error| error.to_string())
}

#[tauri::command]
fn vault_save_snippets(state: tauri::State<AppState>, snippets: Vec<VaultSnippet>) -> Result<(), String> {
    let session = active_session(&state)?;
    save_vault_snippets(session.root.root(), &snippets).map_err(|error| error.to_string())
}

#[tauri::command]
fn vault_load_template(state: tauri::State<AppState>, template_path: String) -> Result<String, String> {
    let session = active_session(&state)?;
    let config = load_vault_config(session.root.root()).map_err(|error| error.to_string())?;
    load_vault_template(session.root.root(), &config.templates_directory, &template_path)
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn vault_build_note_markdown(
    title: String,
    note_type: Option<String>,
    template_body: Option<String>,
) -> String {
    build_note_markdown(&title, note_type.as_deref(), template_body.as_deref())
}

#[tauri::command]
fn indexer_list_note_summaries(state: tauri::State<AppState>) -> Result<Vec<NoteIndexSummary>, String> {
    let session = active_session(&state)?;
    let cache = open_cache_for_session(&session).map_err(|error| error.to_string())?;
    list_note_summaries(&cache, &session.descriptor.id).map_err(|error| error.to_string())
}

#[tauri::command]
fn indexer_list_inbox(state: tauri::State<AppState>, period: Option<String>) -> Result<Vec<NoteIndexSummary>, String> {
    let session = active_session(&state)?;
    let cache = open_cache_for_session(&session).map_err(|error| error.to_string())?;
    let period = scriptor_indexer::InboxPeriod::parse(period.as_deref().unwrap_or("all"));
    list_inbox_notes(&cache, &session.descriptor.id, period).map_err(|error| error.to_string())
}

#[tauri::command]
fn vault_load_snippets(state: tauri::State<AppState>) -> Result<Vec<VaultSnippet>, String> {
    let session = active_session(&state)?;
    load_vault_snippets(session.root.root()).map_err(|error| error.to_string())
}

#[tauri::command]
fn vault_save_config_cmd(state: tauri::State<AppState>, config: VaultConfig) -> Result<(), String> {
    let session = active_session(&state)?;
    save_vault_config(session.root.root(), &config).map_err(|error| error.to_string())
}

#[tauri::command]
fn indexer_list_bibliography(state: tauri::State<AppState>) -> Result<Vec<BibliographyEntry>, String> {
    let session = active_session(&state)?;
    let cache = open_cache_for_session(&session).map_err(|error| error.to_string())?;
    list_bibliography_entries(&cache).map_err(|error| error.to_string())
}

#[tauri::command]
fn vault_plan_daily_note(state: tauri::State<AppState>, date: Option<String>) -> Result<DailyNotePlan, String> {
    let session = active_session(&state)?;
    let parsed = date.and_then(|value| NaiveDate::parse_from_str(&value, "%Y-%m-%d").ok());
    plan_daily_note(session.root.root(), parsed).map_err(|error| error.to_string())
}

#[tauri::command]
fn indexer_resolve_wikilink(state: tauri::State<AppState>, target: String) -> Result<WikilinkResolution, String> {
    let session = active_session(&state)?;
    let scanned = scan_vault(&session.root).map_err(|error| error.to_string())?;
    let mut note_paths = Vec::new();
    let mut aliases_by_path = std::collections::BTreeMap::new();
    for entry in scanned {
        if entry.kind != scriptor_vault::ScannedEntryKind::Note {
            continue;
        }
        note_paths.push(entry.path.clone());
        if let Ok(relative) = RelativeVaultPath::parse(&entry.path) {
            if let Ok(document) = read_note(&session.descriptor.id, &session.root, &relative) {
                let parsed = parse_note_markdown(&entry.path, &document.markdown);
                if !parsed.aliases.is_empty() {
                    aliases_by_path.insert(entry.path, parsed.aliases);
                }
            }
        }
    }
    Ok(resolve_wikilink_target_with_aliases(&note_paths, &aliases_by_path, &target))
}

#[tauri::command]
fn indexer_list_recent_files(
    state: tauri::State<AppState>,
    limit: Option<u32>,
) -> Result<Vec<RecentFileHit>, String> {
    let session = active_session(&state)?;
    let cache = open_cache_for_session(&session).map_err(|error| error.to_string())?;
    list_recent_files(&cache, limit.unwrap_or(20)).map_err(|error| error.to_string())
}

#[tauri::command]
fn indexer_record_recent_access(state: tauri::State<AppState>, path: String) -> Result<(), String> {
    let session = active_session(&state)?;
    let cache = open_cache_for_session(&session).map_err(|error| error.to_string())?;
    record_recent_access(&cache, &path).map_err(|error| error.to_string())
}

#[tauri::command]
fn vault_lint_fix(state: tauri::State<AppState>) -> Result<LintApplyOutput, String> {
    let session = active_session(&state)?;
    let rules = vec![
        RULE_MISSING_HEADING.to_string(),
        RULE_STALE_DEFINITIONS.to_string(),
    ];
    let output = lint_vault_fix(&session.descriptor.id, &session.root, &rules).map_err(|error| error.to_string())?;
    if !output.fixed_paths.is_empty() {
        incremental_notes_index(&session, &output.fixed_paths, &[]).map_err(|error| error.to_string())?;
    }
    Ok(output)
}

#[tauri::command]
fn indexer_list_orphans(state: tauri::State<AppState>) -> Result<Vec<KnowledgeNoteSummary>, String> {
    let session = active_session(&state)?;
    let cache = open_cache_for_session(&session).map_err(|error| error.to_string())?;
    list_orphan_notes(&cache, &session).map_err(|error| error.to_string())
}

#[tauri::command]
fn indexer_list_dead_ends(state: tauri::State<AppState>) -> Result<Vec<KnowledgeNoteSummary>, String> {
    let session = active_session(&state)?;
    let cache = open_cache_for_session(&session).map_err(|error| error.to_string())?;
    list_dead_end_notes(&cache, &session).map_err(|error| error.to_string())
}

#[tauri::command]
fn indexer_evaluate_view(
    state: tauri::State<AppState>,
    filter_json: String,
    path: String,
) -> Result<bool, String> {
    let session = active_session(&state)?;
    let relative = RelativeVaultPath::parse(&path).map_err(|error| error.to_string())?;
    let document = read_note(&session.descriptor.id, &session.root, &relative).map_err(|error| error.to_string())?;
    evaluate_view_filter_json(&filter_json, &document.metadata).map_err(|error| error.to_string())
}

#[tauri::command]
fn vault_list_view_notes(
    state: tauri::State<AppState>,
    filter_json: String,
) -> Result<Vec<ViewNoteHit>, String> {
    let session = active_session(&state)?;
    let cache = open_cache_for_session(&session).map_err(|error| error.to_string())?;
    list_view_notes(&cache, &session, &filter_json).map_err(|error| error.to_string())
}

#[tauri::command]
fn indexer_list_unresolved_targets(
    state: tauri::State<AppState>,
) -> Result<Vec<UnresolvedLinkTarget>, String> {
    let session = active_session(&state)?;
    let cache = open_cache_for_session(&session).map_err(|error| error.to_string())?;
    list_unresolved_link_targets(&cache, &session).map_err(|error| error.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .manage(AppState::new())
        .invoke_handler(tauri::generate_handler![
            health_check,
            copy_text_to_clipboard,
            plantuml_render,
            vault_save_asset,
            vault_open,
            vault_scan,
            vault_read_note,
            vault_save_note,
            vault_list_recent_notes,
            vault_record_recent_note,
            vault_delete_note,
            vault_rename_dry_run,
            vault_rename_apply,
            vault_rename_tag_dry_run,
            vault_rename_tag_apply,
            vault_rename_section_dry_run,
            vault_rename_section_apply,
            vault_rename_block_dry_run,
            vault_rename_block_apply,
            vault_lint_fix,
            vault_load_config,
            vault_load_snippets,
            vault_save_snippets,
            vault_load_template,
            vault_build_note_markdown,
            vault_save_config_cmd,
            vault_plan_daily_note,
            indexer_rebuild,
            indexer_update_note,
            indexer_apply_filesystem_changes,
            indexer_search,
            indexer_list_tags,
            indexer_notes_for_tag,
            indexer_resolve_wikilink,
            indexer_list_recent_files,
            indexer_record_recent_access,
            indexer_list_orphans,
            indexer_list_inbox,
            indexer_list_note_summaries,
            indexer_list_dead_ends,
            indexer_list_unresolved_targets,
            indexer_evaluate_view,
            vault_list_view_notes,
            indexer_list_bibliography,
            indexer_backlinks,
            indexer_graph,
            export_discover,
            export_run_note,
            export_run_markdown,
            export_start_note,
            export_cancel,
            pdf_translate,
            git_status_cmd,
            git_commit_cmd,
            git_pull_cmd,
            git_push_cmd,
            git_resolve_conflict_cmd,
            git_read_conflict_markers_cmd,
            git_show_head_file_cmd,
            vault_frontmatter_set,
            vault_textbundle_export,
            indexer_traverse_graph,
            indexer_execute_dql,
            vault_read_stats_history,
            vault_append_stats_history,
            indexer_health_diagnostics,
            vault_health,
            diagnostics_append_event,
            keychain_set_secret,
            keychain_get_secret,
            keychain_delete_secret,
            canvas_hit_test,
            canvas_render_svg,
            canvas_template_dry_run,
            canvas_apply_template,
            canvas_restore_template,
            canvas_query_blocks,
            canvas_list_templates,
            canvas_snapshot,
            canvas_save_document,
            canvas_load_document,
            canvas_list_documents,
            code_chunk_run,
            vault_publish_starlight,
            daemon_ping,
            daemon_endpoint,
            daemon_start,
            daemon_open_vault,
            daemon_health_diagnostics,
            daemon_health_report,
            daemon_rebuild_index,
            daemon_search,
            daemon_list_note_summaries,
            daemon_backlinks,
            daemon_graph,
            daemon_git_status,
            daemon_save_note,
            daemon_update_note_index,
            daemon_rename_apply,
            daemon_export_run_note,
            daemon_export_run_markdown,
            system_info,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Scriptor desktop");
}
