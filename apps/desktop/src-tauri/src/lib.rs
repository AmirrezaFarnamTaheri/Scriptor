mod commands;
mod platform;
mod state;

pub use state::AppState;

use commands::canvas::{
    canvas_apply_template, canvas_hit_test, canvas_list_documents, canvas_list_templates, canvas_load_document,
    canvas_query_blocks, canvas_render_svg, canvas_restore_template, canvas_save_document, canvas_snapshot,
    canvas_template_dry_run,
};
use commands::code_chunk::{code_chunk_run, vault_publish_starlight};
use commands::daemon::{
    daemon_backlinks, daemon_endpoint, daemon_export_cancel, daemon_export_job_status, daemon_export_run_markdown,
    daemon_export_run_note, daemon_export_start_note, daemon_git_status, daemon_graph, daemon_health_diagnostics,
    daemon_health_report, daemon_list_note_summaries, daemon_open_vault, daemon_ping, daemon_rebuild_index,
    daemon_reload_config, daemon_rename_apply, daemon_save_note, daemon_search, daemon_start, daemon_update_note_index,
};
use commands::export::{export_cancel, export_discover, export_run_markdown, export_run_note, export_start_note, pdf_translate};
use commands::git::{
    git_apply_merged_conflict_cmd, git_commit_cmd, git_pull_cmd, git_push_cmd, git_read_conflict_markers_cmd,
    git_resolve_conflict_cmd, git_show_head_file_cmd, git_show_merge_base_file_cmd, git_status_cmd,
};
use commands::indexer::{
    indexer_apply_filesystem_changes, indexer_backlinks, indexer_evaluate_view, indexer_execute_dql,
    indexer_graph, indexer_health_diagnostics, indexer_list_bibliography, indexer_list_dead_ends, indexer_list_inbox,
    indexer_list_note_summaries, indexer_list_orphans, indexer_list_recent_files, indexer_list_tags,
    indexer_list_unresolved_targets, indexer_notes_for_tag, indexer_rebuild, indexer_record_recent_access,
    indexer_resolve_wikilink, indexer_search, indexer_traverse_graph, indexer_update_note,
};
use commands::system::{
    copy_text_to_clipboard, diagnostics_append_event, health_check, keychain_delete_secret, keychain_get_secret,
    keychain_set_secret, plantuml_render, set_headless_engine, system_info,
};
use commands::vault::{
    vault_append_activity_log, vault_append_stats_history, vault_build_note_markdown, vault_create_backup,
    vault_delete_backup, vault_delete_note, vault_detect_obsidian, vault_frontmatter_set, vault_import_obsidian,
    vault_lint_fix, vault_list_backups, vault_list_recent_notes, vault_list_view_notes, vault_load_config,
    vault_load_snippets, vault_load_template, vault_open, vault_plan_daily_note, vault_read_activity_log,
    vault_read_note, vault_read_stats_history, vault_read_workspace_session, vault_record_recent_note,
    vault_rename_apply, vault_rename_block_apply, vault_rename_block_dry_run, vault_rename_dry_run,
    vault_rename_section_apply, vault_rename_section_dry_run, vault_rename_tag_apply, vault_rename_tag_dry_run,
    vault_restore_backup, vault_save_asset, vault_save_config_cmd, vault_save_note, vault_save_snippets,
    vault_save_workspace_session, vault_scan, vault_textbundle_export, vault_health, vault_list_note_history,
    vault_read_note_history_revision, vault_restore_note_history_revision,
};
use serde::Serialize;
use tauri::Emitter;

#[derive(Debug, Clone, Serialize)]
struct DaemonConfigReloadedEvent {
    json: String,
    generation: u64,
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_deep_link::init())
        .setup(|app| {
            platform::setup(app)?;
            let handle = app.handle().clone();
            scriptor_daemon::register_rpc_event_handler(move |event| {
                let scriptor_ipc::RpcEventPayload::ConfigReloaded { json, generation } = event.payload;
                let _ = handle.emit(
                    "daemon:config-reloaded",
                    DaemonConfigReloadedEvent { json, generation },
                );
            });
            Ok(())
        })
        .manage(AppState::new())
        .invoke_handler(tauri::generate_handler![
            health_check,
            set_headless_engine,
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
            git_apply_merged_conflict_cmd,
            git_read_conflict_markers_cmd,
            git_show_merge_base_file_cmd,
            git_show_head_file_cmd,
            vault_frontmatter_set,
            vault_textbundle_export,
            indexer_traverse_graph,
            indexer_execute_dql,
            vault_read_stats_history,
            vault_append_stats_history,
            vault_read_activity_log,
            vault_append_activity_log,
            vault_read_workspace_session,
            vault_save_workspace_session,
            vault_list_note_history,
            vault_read_note_history_revision,
            vault_restore_note_history_revision,
            indexer_health_diagnostics,
            vault_health,
            vault_create_backup,
            vault_list_backups,
            vault_restore_backup,
            vault_delete_backup,
            vault_detect_obsidian,
            vault_import_obsidian,
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
            daemon_export_start_note,
            daemon_export_job_status,
            daemon_export_cancel,
            daemon_reload_config,
            system_info,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Scriptor desktop");
}
