use chrono::NaiveDate;
use scriptor_indexer::{health_report_json, incremental_notes_index, list_view_notes, open_cache_for_session, ViewNoteHit};
use scriptor_vault::{
    append_activity_log, append_stats_history, block_rename_apply, block_rename_dry_run, build_note_markdown,
    delete_note, export_text_bundle,     lint_vault_fix, list_note_history, list_recent_notes, load_vault_config, load_vault_snippets,
    load_vault_template, open_vault, open_vault_output, plan_daily_note, read_activity_log, read_note,
    read_note_history_revision, read_stats_history, read_workspace_session, record_recent_note, rename_apply, rename_dry_run, save_note,
    save_note_with_options, save_vault_config, save_vault_snippets, scan_vault_with_roots, section_rename_apply,
    section_rename_dry_run, set_frontmatter_field, tag_rename_apply, tag_rename_dry_run, write_workspace_session,
    ActivityLogEntry, DailyNotePlan, DeleteNoteOutput, FrontmatterFieldOutput, ImportObsidianOptions, ImportResult,
    LinkRewriteApplyOutput, LinkRewritePreview, LintApplyOutput, NoteHistoryEntry, OpenVaultOutput, RecentNoteEntry,
    RelativeVaultPath, RenameNoteApplyOutput, RenameNoteDryRunOutput, SaveNoteOptions, SaveNoteOutput,
    ScannedEntry, StatsHistoryEntry, TextBundleExportOutput, VaultConfig, VaultSnippet, WorkspaceSession,
    RULE_MISSING_HEADING, RULE_STALE_DEFINITIONS,
};
use serde::Serialize;
use tauri::AppHandle;

use crate::AppState;
use crate::state::{active_session, use_headless_engine};

use super::daemon::{bridge_health_report, bridge_reload_config, bridge_rename_apply, bridge_save_note};
use super::media::save_vault_asset;
use super::shared::{parse_daemon_json, restart_vault_watcher};

#[tauri::command]
pub fn vault_open(app: AppHandle, state: tauri::State<AppState>, root_path: String) -> Result<OpenVaultOutput, String> {
    let path = std::path::Path::new(&root_path);
    if !path.exists() {
        std::fs::create_dir_all(path).map_err(|error| format!("failed to create vault folder: {error}"))?;
    }
    let session = open_vault(&root_path).map_err(|error| error.to_string())?;
    let output = open_vault_output(&session);
    *state.session.lock().expect("session lock") = Some(session.clone());
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
pub fn vault_read_note(state: tauri::State<AppState>, path: String) -> Result<scriptor_vault::NoteDocument, String> {
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
    list_recent_notes(&session.root, limit.unwrap_or(20) as usize).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn vault_record_recent_note(state: tauri::State<AppState>, path: String) -> Result<Vec<RecentNoteEntry>, String> {
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
pub fn vault_delete_note(state: tauri::State<AppState>, path: String) -> Result<DeleteNoteOutput, String> {
    let session = active_session(&state)?;
    let relative = RelativeVaultPath::parse(&path).map_err(|error| error.to_string())?;
    delete_note(&session.root, &relative).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn vault_read_stats_history(state: tauri::State<AppState>) -> Result<Vec<StatsHistoryEntry>, String> {
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
    append_stats_history(
        &session.root,
        path,
        StatsHistoryEntry { date, words },
    )
    .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn vault_read_activity_log(state: tauri::State<AppState>, limit: Option<usize>) -> Result<Vec<ActivityLogEntry>, String> {
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
pub fn vault_read_workspace_session(state: tauri::State<AppState>) -> Result<WorkspaceSession, String> {
    let session = active_session(&state)?;
    read_workspace_session(&session.root).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn vault_save_workspace_session(state: tauri::State<AppState>, session: WorkspaceSession) -> Result<(), String> {
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
pub fn vault_save_snippets(state: tauri::State<AppState>, snippets: Vec<VaultSnippet>) -> Result<(), String> {
    let session = active_session(&state)?;
    save_vault_snippets(session.root.root(), &snippets).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn vault_load_template(state: tauri::State<AppState>, template_path: String) -> Result<String, String> {
    let session = active_session(&state)?;
    let config = load_vault_config(session.root.root()).map_err(|error| error.to_string())?;
    load_vault_template(session.root.root(), &config.templates_directory, &template_path)
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
pub fn vault_save_config_cmd(state: tauri::State<AppState>, config: VaultConfig) -> Result<(), String> {
    let session = active_session(&state)?;
    save_vault_config(session.root.root(), &config).map_err(|error| error.to_string())?;
    if use_headless_engine(&state) {
        bridge_reload_config()?;
    }
    Ok(())
}

#[tauri::command]
pub fn vault_plan_daily_note(state: tauri::State<AppState>, date: Option<String>) -> Result<DailyNotePlan, String> {
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
pub fn vault_lint_fix(state: tauri::State<AppState>) -> Result<LintApplyOutput, String> {
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
pub fn vault_health(state: tauri::State<AppState>) -> Result<String, String> {
    if use_headless_engine(&state) {
        return bridge_health_report();
    }
    let session = active_session(&state)?;
    let cache = open_cache_for_session(&session).map_err(|error| error.to_string())?;
    health_report_json(&cache, &session).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn vault_list_note_history(state: tauri::State<AppState>, path: String) -> Result<Vec<NoteHistoryEntry>, String> {
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
    read_note_history_revision(&session.root, &path, &revision_id).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn vault_restore_note_history_revision(
    state: tauri::State<AppState>,
    path: String,
    revision_id: String,
) -> Result<SaveNoteOutput, String> {
    let session = active_session(&state)?;
    let relative = RelativeVaultPath::parse(&path).map_err(|error| error.to_string())?;
    let markdown = read_note_history_revision(&session.root, &path, &revision_id)
        .map_err(|error| error.to_string())?;
    save_note_with_options(
        &session.descriptor.id,
        &session.root,
        &relative,
        &markdown,
        None,
        SaveNoteOptions { dry_run: false },
    )
    .map_err(|error| error.to_string())
}

#[derive(Serialize)]
pub struct VaultBackupEntry {
    pub name: String,
    pub path: String,
    pub created_at: String,
    pub size_bytes: u64,
}

fn copy_dir_recursive(src: &std::path::Path, dst: &std::path::Path) -> std::io::Result<()> {
    std::fs::create_dir_all(dst)?;
    for entry in std::fs::read_dir(src)? {
        let entry = entry?;
        let file_type = entry.file_type()?;
        let src_path = entry.path();
        let dst_path = dst.join(entry.file_name());
        if file_type.is_dir() {
            if entry.file_name() == ".scriptor" || entry.file_name() == ".git" {
                continue;
            }
            copy_dir_recursive(&src_path, &dst_path)?;
        } else if file_type.is_file() {
            std::fs::copy(&src_path, &dst_path)?;
        }
    }
    Ok(())
}

fn dir_size(path: &std::path::Path) -> std::io::Result<u64> {
    let mut total = 0u64;
    for entry in std::fs::read_dir(path)? {
        let entry = entry?;
        let file_type = entry.file_type()?;
        if file_type.is_dir() {
            total += dir_size(&entry.path())?;
        } else if file_type.is_file() {
            total += entry.metadata()?.len();
        }
    }
    Ok(total)
}

#[tauri::command]
pub fn vault_create_backup(
    state: tauri::State<AppState>,
    backup_path: Option<String>,
) -> Result<VaultBackupEntry, String> {
    let session = active_session(&state)?;
    let vault_root = session.root.root().to_path_buf();

    let backup_root = match backup_path {
        Some(p) if !p.is_empty() => std::path::PathBuf::from(p),
        _ => vault_root.join(".scriptor").join("backups"),
    };

    std::fs::create_dir_all(&backup_root).map_err(|e| format!("Failed to create backup directory: {e}"))?;

    let timestamp = chrono::Local::now().format("%Y%m%d-%H%M%S").to_string();
    let backup_name = format!("vault-backup-{timestamp}");
    let backup_dir = backup_root.join(&backup_name);

    copy_dir_recursive(&vault_root, &backup_dir)
        .map_err(|e| format!("Failed to copy vault: {e}"))?;

    let size_bytes = dir_size(&backup_dir).unwrap_or(0);
    let created_at = chrono::Local::now().to_rfc3339();

    Ok(VaultBackupEntry {
        name: backup_name,
        path: backup_dir.to_string_lossy().to_string(),
        created_at,
        size_bytes,
    })
}

#[tauri::command]
pub fn vault_list_backups(
    state: tauri::State<AppState>,
    backup_path: Option<String>,
) -> Result<Vec<VaultBackupEntry>, String> {
    let session = active_session(&state)?;
    let vault_root = session.root.root().to_path_buf();

    let backup_root = match backup_path {
        Some(p) if !p.is_empty() => std::path::PathBuf::from(p),
        _ => vault_root.join(".scriptor").join("backups"),
    };

    if !backup_root.exists() {
        return Ok(vec![]);
    }

    let mut backups = Vec::new();
    for entry in std::fs::read_dir(&backup_root).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        if !entry.file_type().map(|ft| ft.is_dir()).unwrap_or(false) {
            continue;
        }
        let name = entry.file_name().to_string_lossy().to_string();
        if !name.starts_with("vault-backup-") {
            continue;
        }
        let path = entry.path();
        let size_bytes = dir_size(&path).unwrap_or(0);
        let created_at = std::fs::metadata(&path)
            .and_then(|m| m.modified())
            .map(|t| {
                let datetime: chrono::DateTime<chrono::Local> = t.into();
                datetime.to_rfc3339()
            })
            .unwrap_or_else(|_| String::new());

        backups.push(VaultBackupEntry {
            name,
            path: path.to_string_lossy().to_string(),
            created_at,
            size_bytes,
        });
    }

    backups.sort_by(|a, b| b.name.cmp(&a.name));
    Ok(backups)
}

#[tauri::command]
pub fn vault_restore_backup(
    state: tauri::State<AppState>,
    backup_name: String,
    backup_path: Option<String>,
) -> Result<String, String> {
    let session = active_session(&state)?;
    let vault_root = session.root.root().to_path_buf();

    let backup_root = match backup_path {
        Some(p) if !p.is_empty() => std::path::PathBuf::from(p),
        _ => vault_root.join(".scriptor").join("backups"),
    };

    let backup_dir = backup_root.join(&backup_name);
    if !backup_dir.exists() {
        return Err(format!("Backup not found: {backup_name}"));
    }

    for entry in std::fs::read_dir(&backup_dir).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let src = entry.path();
        let dst = vault_root.join(entry.file_name());
        if src.is_dir() {
            copy_dir_recursive(&src, &dst).map_err(|e| format!("Failed to restore directory: {e}"))?;
        } else if src.is_file() {
            std::fs::copy(&src, &dst).map_err(|e| format!("Failed to restore file: {e}"))?;
        }
    }

    Ok(format!("Restored vault from {backup_name}"))
}

#[tauri::command]
pub fn vault_delete_backup(
    state: tauri::State<AppState>,
    backup_name: String,
    backup_path: Option<String>,
) -> Result<(), String> {
    let session = active_session(&state)?;
    let vault_root = session.root.root().to_path_buf();

    let backup_root = match backup_path {
        Some(p) if !p.is_empty() => std::path::PathBuf::from(p),
        _ => vault_root.join(".scriptor").join("backups"),
    };

    let backup_dir = backup_root.join(&backup_name);
    if !backup_dir.exists() {
        return Err(format!("Backup not found: {backup_name}"));
    }

    std::fs::remove_dir_all(&backup_dir).map_err(|e| format!("Failed to delete backup: {e}"))
}

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
) -> Result<ImportResult, String> {
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
