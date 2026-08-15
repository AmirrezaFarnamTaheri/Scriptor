use chrono::NaiveDate;
use scriptor_indexer::{
    ViewNoteHit, health_report_json, incremental_notes_index, list_view_notes,
    open_cache_for_session,
};
use scriptor_vault::{
    ActivityLogEntry, DailyNotePlan, DeleteNoteOutput, FrontmatterFieldOutput,
    ImportObsidianOptions, ImportResult, LinkRewriteApplyOutput, LinkRewritePreview,
    LintApplyOutput, NoteHistoryEntry, OpenVaultOutput, RULE_MISSING_HEADING,
    RULE_STALE_DEFINITIONS, RecentNoteEntry, RelativeVaultPath, RenameNoteApplyOutput,
    RenameNoteDryRunOutput, SaveNoteOptions, SaveNoteOutput, ScannedEntry, StatsHistoryEntry,
    TextBundleExportOutput, VaultConfig, VaultSnippet, WorkspaceSession, append_activity_log,
    append_stats_history, block_rename_apply, block_rename_dry_run, build_note_markdown,
    delete_note, export_text_bundle, lint_vault_fix, list_note_history, list_recent_notes,
    load_vault_config, load_vault_snippets, load_vault_template, open_vault, open_vault_output,
    plan_daily_note, read_activity_log, read_note, read_note_history_revision, read_stats_history,
    read_workspace_session, record_recent_note, rename_apply, rename_dry_run, save_note,
    save_note_with_options, save_vault_config, save_vault_snippets, scan_vault_with_roots,
    section_rename_apply, section_rename_dry_run, set_frontmatter_field, tag_rename_apply,
    tag_rename_dry_run, write_workspace_session,
};
use tauri::AppHandle;

use crate::AppState;
use crate::authorization::{SensitiveOperation, require_sensitive_operation};
use crate::state::{active_session, lock_recover, use_headless_engine};

use super::daemon::{
    bridge_health_report, bridge_reload_config, bridge_rename_apply, bridge_save_note,
};
use super::media::save_vault_asset;
use super::shared::{parse_daemon_json, restart_vault_watcher};

#[tauri::command]
pub fn vault_open(
    app: AppHandle,
    state: tauri::State<AppState>,
    root_path: String,
) -> Result<OpenVaultOutput, String> {
    let path = std::path::Path::new(&root_path);
    if !path.exists() {
        std::fs::create_dir_all(path)
            .map_err(|error| format!("failed to create vault folder: {error}"))?;
    }
    let session = open_vault(&root_path).map_err(|error| error.to_string())?;
    let output = open_vault_output(&session);
    *lock_recover(&state.session, "session") = Some(session.clone());
    restart_vault_watcher(&app, &state, &session)?;
    Ok(output)
}

#[tauri::command]
pub fn vault_scan(state: tauri::State<AppState>) -> Result<Vec<ScannedEntry>, String> {
    let session = active_session(&state)?;
    let config = load_vault_config(session.root.root()).unwrap_or_default();
    scan_vault_with_roots(&session.root, &config.extra_roots).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn vault_read_note(
    state: tauri::State<AppState>,
    path: String,
) -> Result<scriptor_vault::NoteDocument, String> {
    let session = active_session(&state)?;
    let relative = RelativeVaultPath::parse(&path).map_err(|error| error.to_string())?;
    read_note(&session.descriptor.id, &session.root, &relative).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn vault_save_note(
    state: tauri::State<AppState>,
    path: String,
    markdown: String,
    expected_content_hash: Option<String>,
    dry_run: Option<bool>,
) -> Result<SaveNoteOutput, String> {
    if use_headless_engine(&state) {
        let json = bridge_save_note(path, markdown, expected_content_hash, dry_run)?;
        return parse_daemon_json(&json);
    }
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
pub fn vault_list_recent_notes(
    state: tauri::State<AppState>,
    limit: Option<u32>,
) -> Result<Vec<RecentNoteEntry>, String> {
    let session = active_session(&state)?;
    list_recent_notes(&session.root, limit.unwrap_or(20) as usize)
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn vault_record_recent_note(
    state: tauri::State<AppState>,
    path: String,
) -> Result<Vec<RecentNoteEntry>, String> {
    let session = active_session(&state)?;
    record_recent_note(&session.root, &path).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn vault_rename_dry_run(
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
pub fn vault_rename_apply(
    state: tauri::State<AppState>,
    from_path: String,
    to_path: String,
    update_links: bool,
) -> Result<RenameNoteApplyOutput, String> {
    if use_headless_engine(&state) {
        let json = bridge_rename_apply(from_path, to_path, update_links)?;
        return parse_daemon_json(&json);
    }
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
pub fn vault_rename_tag_dry_run(
    state: tauri::State<AppState>,
    old_tag: String,
    new_tag: String,
) -> Result<LinkRewritePreview, String> {
    let session = active_session(&state)?;
    tag_rename_dry_run(&session.descriptor.id, &session.root, &old_tag, &new_tag)
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn vault_rename_tag_apply(
    state: tauri::State<AppState>,
    old_tag: String,
    new_tag: String,
) -> Result<LinkRewriteApplyOutput, String> {
    let session = active_session(&state)?;
    tag_rename_apply(&session.descriptor.id, &session.root, &old_tag, &new_tag)
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn vault_rename_section_dry_run(
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
pub fn vault_rename_section_apply(
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
pub fn vault_rename_block_dry_run(
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
pub fn vault_rename_block_apply(
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
pub fn vault_delete_note(
    state: tauri::State<AppState>,
    path: String,
    authorization_token: String,
) -> Result<DeleteNoteOutput, String> {
    require_sensitive_operation(
        &state,
        &authorization_token,
        SensitiveOperation::DeleteNote,
        Some(&path),
    )?;
    let session = active_session(&state)?;
    let relative = RelativeVaultPath::parse(&path).map_err(|error| error.to_string())?;
    delete_note(&session.root, &relative).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn vault_read_stats_history(
    state: tauri::State<AppState>,
) -> Result<Vec<StatsHistoryEntry>, String> {
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
pub fn vault_append_stats_history(
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
    append_stats_history(&session.root, path, StatsHistoryEntry { date, words })
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn vault_read_activity_log(
    state: tauri::State<AppState>,
    limit: Option<usize>,
) -> Result<Vec<ActivityLogEntry>, String> {
    let session = active_session(&state)?;
    read_activity_log(&session.root, limit.unwrap_or(100)).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn vault_append_activity_log(
    state: tauri::State<AppState>,
    id: String,
    ts: i64,
    kind: String,
    message: String,
    detail: Option<String>,
) -> Result<(), String> {
    let session = active_session(&state)?;
    append_activity_log(
        &session.root,
        ActivityLogEntry {
            id,
            ts,
            kind,
            message,
            detail,
        },
    )
    .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn vault_read_workspace_session(
    state: tauri::State<AppState>,
) -> Result<WorkspaceSession, String> {
    let session = active_session(&state)?;
    read_workspace_session(&session.root).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn vault_save_workspace_session(
    state: tauri::State<AppState>,
    session: WorkspaceSession,
) -> Result<(), String> {
    let active = active_session(&state)?;
    write_workspace_session(&active.root, &session).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn vault_frontmatter_set(
    state: tauri::State<AppState>,
    path: String,
    field: String,
    value: String,
) -> Result<FrontmatterFieldOutput, String> {
    let session = active_session(&state)?;
    let relative = RelativeVaultPath::parse(&path).map_err(|error| error.to_string())?;
    let document = read_note(&session.descriptor.id, &session.root, &relative)
        .map_err(|error| error.to_string())?;
    let markdown = set_frontmatter_field(&document.markdown, &field, &value)
        .map_err(|error| error.to_string())?;
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
pub fn vault_textbundle_export(
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
pub fn vault_save_asset(
    state: tauri::State<AppState>,
    relative_path: String,
    bytes: Vec<u8>,
) -> Result<String, String> {
    let session = active_session(&state)?;
    save_vault_asset(&session.root, &relative_path, &bytes)
}

#[tauri::command]
pub fn vault_load_config(state: tauri::State<AppState>) -> Result<VaultConfig, String> {
    let session = active_session(&state)?;
    load_vault_config(session.root.root()).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn vault_save_snippets(
    state: tauri::State<AppState>,
    snippets: Vec<VaultSnippet>,
) -> Result<(), String> {
    let session = active_session(&state)?;
    save_vault_snippets(session.root.root(), &snippets).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn vault_load_template(
    state: tauri::State<AppState>,
    template_path: String,
) -> Result<String, String> {
    let session = active_session(&state)?;
    let config = load_vault_config(session.root.root()).map_err(|error| error.to_string())?;
    load_vault_template(
        session.root.root(),
        &config.templates_directory,
        &template_path,
    )
    .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn vault_build_note_markdown(
    title: String,
    note_type: Option<String>,
    template_body: Option<String>,
) -> String {
    build_note_markdown(&title, note_type.as_deref(), template_body.as_deref())
}

#[tauri::command]
pub fn vault_load_snippets(state: tauri::State<AppState>) -> Result<Vec<VaultSnippet>, String> {
    let session = active_session(&state)?;
    load_vault_snippets(session.root.root()).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn vault_save_config_cmd(
    state: tauri::State<AppState>,
    config: VaultConfig,
) -> Result<(), String> {
    let session = active_session(&state)?;
    save_vault_config(session.root.root(), &config).map_err(|error| error.to_string())?;
    if use_headless_engine(&state) {
        bridge_reload_config()?;
    }
    Ok(())
}

#[tauri::command]
pub fn vault_plan_daily_note(
    state: tauri::State<AppState>,
    date: Option<String>,
) -> Result<DailyNotePlan, String> {
    let session = active_session(&state)?;
    let parsed = date.and_then(|value| NaiveDate::parse_from_str(&value, "%Y-%m-%d").ok());
    plan_daily_note(session.root.root(), parsed).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn vault_list_view_notes(
    state: tauri::State<AppState>,
    filter_json: String,
) -> Result<Vec<ViewNoteHit>, String> {
    let session = active_session(&state)?;
    let cache = open_cache_for_session(&session).map_err(|error| error.to_string())?;
    list_view_notes(&cache, &session, &filter_json).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn vault_lint_fix(
    state: tauri::State<AppState>,
    authorization_token: String,
) -> Result<LintApplyOutput, String> {
    let session = active_session(&state)?;
    require_sensitive_operation(
        &state,
        &authorization_token,
        SensitiveOperation::ApplyBulkFix,
        Some(&session.descriptor.id),
    )?;
    let rules = vec![
        RULE_MISSING_HEADING.to_string(),
        RULE_STALE_DEFINITIONS.to_string(),
    ];
    let output = lint_vault_fix(&session.descriptor.id, &session.root, &rules)
        .map_err(|error| error.to_string())?;
    if !output.fixed_paths.is_empty() {
        incremental_notes_index(&session, &output.fixed_paths, &[])
            .map_err(|error| error.to_string())?;
    }
    Ok(output)
}

#[tauri::command]
pub fn vault_health(state: tauri::State<AppState>) -> Result<String, String> {
    if use_headless_engine(&state) {
        return bridge_health_report();
    }
    let session = active_session(&state)?;
    let cache = open_cache_for_session(&session).map_err(|error| error.to_string())?;
    health_report_json(&cache, &session).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn vault_list_note_history(
    state: tauri::State<AppState>,
    path: String,
) -> Result<Vec<NoteHistoryEntry>, String> {
    let session = active_session(&state)?;
    list_note_history(&session.root, &path).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn vault_read_note_history_revision(
    state: tauri::State<AppState>,
    path: String,
    revision_id: String,
) -> Result<String, String> {
    let session = active_session(&state)?;
    read_note_history_revision(&session.root, &path, &revision_id)
        .map_err(|error| error.to_string())
}

// Backup create/list/restore/delete commands live in `commands::backup`, which
// enforces symlink-safe, transactional restore; see lib.rs's command registry.

#[tauri::command]
pub fn vault_detect_obsidian(obsidian_path: String) -> bool {
    scriptor_vault::detect_obsidian_vault(std::path::Path::new(&obsidian_path))
}

#[tauri::command]
pub fn vault_import_obsidian(
    state: tauri::State<AppState>,
    obsidian_path: String,
    convert_wikilinks: Option<bool>,
    import_attachments: Option<bool>,
    preserve_frontmatter: Option<bool>,
    authorization_token: String,
) -> Result<ImportResult, String> {
    require_sensitive_operation(
        &state,
        &authorization_token,
        SensitiveOperation::ImportVault,
        Some(&obsidian_path),
    )?;
    let session = active_session(&state)?;
    let options = ImportObsidianOptions {
        convert_wikilinks: convert_wikilinks.unwrap_or(true),
        import_attachments: import_attachments.unwrap_or(true),
        preserve_frontmatter: preserve_frontmatter.unwrap_or(true),
    };
    scriptor_vault::import_obsidian_vault(
        &session.descriptor.id,
        &session.root,
        std::path::Path::new(&obsidian_path),
        &options,
    )
    .map_err(|error| error.to_string())
}

/// Export the full activity log as a string in the requested format.
///
/// `format` accepts `"json"` (default) or `"csv"`.
#[tauri::command]
pub fn vault_export_audit_log(
    state: tauri::State<AppState>,
    format: Option<String>,
) -> Result<String, String> {
    let session = active_session(&state)?;
    // Read all entries (cap at 10_000 to bound memory).
    let entries = read_activity_log(&session.root, 10_000).map_err(|error| error.to_string())?;

    match format.as_deref().unwrap_or("json") {
        "csv" => {
            let mut out = String::from("id,ts,kind,message,detail\n");
            for entry in &entries {
                let detail = entry.detail.as_deref().unwrap_or("").replace('"', "\"\"");
                let message = entry.message.replace('"', "\"\"");
                out.push_str(&format!(
                    "{},{},{},\"{}\",\"{}\"\n",
                    entry.id, entry.ts, entry.kind, message, detail
                ));
            }
            Ok(out)
        }
        _ => serde_json::to_string_pretty(&entries).map_err(|e| e.to_string()),
    }
}
