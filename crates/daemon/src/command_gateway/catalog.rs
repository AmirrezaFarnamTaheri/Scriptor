const COMMAND_CATALOG: &[&str] = &[
    "health_check",
    "vault_save_asset",
    "vault_open",
    "vault_scan",
    "vault_read_note",
    "vault_save_note",
    "vault_list_recent_notes",
    "vault_record_recent_note",
    "vault_delete_note",
    "vault_rename_dry_run",
    "vault_rename_apply",
    "vault_rename_tag_dry_run",
    "vault_rename_tag_apply",
    "vault_rename_section_dry_run",
    "vault_rename_section_apply",
    "vault_rename_block_dry_run",
    "vault_rename_block_apply",
    "vault_lint_fix",
    "vault_load_config",
    "vault_load_snippets",
    "vault_save_snippets",
    "vault_load_template",
    "vault_build_note_markdown",
    "vault_save_config_cmd",
    "vault_plan_daily_note",
    "vault_list_view_notes",
    "vault_frontmatter_set",
    "vault_textbundle_export",
    "vault_read_stats_history",
    "vault_append_stats_history",
    "vault_read_activity_log",
    "vault_append_activity_log",
    "vault_read_workspace_session",
    "vault_save_workspace_session",
    "vault_list_note_history",
    "vault_read_note_history_revision",
    "vault_restore_note_history_revision",
    "vault_health",
    "indexer_rebuild",
    "indexer_update_note",
    "indexer_apply_filesystem_changes",
    "indexer_search",
    "indexer_list_tags",
    "indexer_notes_for_tag",
    "indexer_resolve_wikilink",
    "indexer_list_recent_files",
    "indexer_record_recent_access",
    "indexer_list_orphans",
    "indexer_list_inbox",
    "indexer_list_note_summaries",
    "indexer_list_dead_ends",
    "indexer_list_unresolved_targets",
    "indexer_evaluate_view",
    "indexer_list_bibliography",
    "indexer_backlinks",
    "indexer_graph",
    "indexer_traverse_graph",
    "indexer_execute_dql",
    "indexer_health_diagnostics",
    "export_discover",
    "export_run_note",
    "export_run_markdown",
    "export_start_note",
    "export_cancel",
    "export_job_status",
    "index_rebuild_status",
    "reload_config",
    "set_headless_engine",
    "pdf_translate",
    "git_status_cmd",
    "git_commit_cmd",
    "git_pull_cmd",
    "git_push_cmd",
    "git_resolve_conflict_cmd",
    "git_read_conflict_markers_cmd",
    "git_show_head_file_cmd",
    "plantuml_render",
    "canvas_hit_test",
    "canvas_render_svg",
    "canvas_template_dry_run",
    "canvas_apply_template",
    "canvas_restore_template",
    "canvas_query_blocks",
    "canvas_list_templates",
    "canvas_snapshot",
    "canvas_save_document",
    "canvas_load_document",
    "canvas_list_documents",
    "system_info",
];

pub fn list_commands() -> Vec<&'static str> {
    COMMAND_CATALOG.to_vec()
}

pub fn is_outside_lock_command(command: &str) -> bool {
    matches!(
        command,
        "export_run_note" | "export_run_markdown" | "indexer_rebuild" | "vault_open"
        // Subprocess/scanning work that must never hold the daemon mutex:
        // pdf2zh allows a 15-minute timeout, PlantUML up to 30s, and wikilink
        // resolution walks every note in the vault.
        | "pdf_translate" | "plantuml_render" | "indexer_resolve_wikilink"
        // Read-only whole-vault scans: the rename previews and the vault
        // health report read every note, so holding the mutex across them
        // would freeze every other daemon command on large vaults. The
        // mutating rename/lint commands stay inside the lock on purpose —
        // the mutex is what serializes note mutations against each other
        // and against concurrent saves.
        | "vault_rename_dry_run" | "vault_rename_tag_dry_run"
        | "vault_rename_section_dry_run" | "vault_rename_block_dry_run"
        | "vault_health"
        // Git operations may block on repository I/O and mutating operations
        // synchronously wait on the per-vault GitQueue worker. Snapshot the
        // session/queue under the daemon lock and execute outside it.
        | "git_status_cmd" | "git_commit_cmd" | "git_pull_cmd" | "git_push_cmd"
        | "git_resolve_conflict_cmd" | "git_read_conflict_markers_cmd"
        | "git_show_head_file_cmd"
    )
}

/// Commands which can make a destructive or remote state change and therefore
/// must originate from the desktop authorization broker. Daemon IPC is a
/// same-user transport boundary, not an approval channel.
pub fn requires_desktop_authorization(command: &str) -> bool {
    matches!(
        command,
        "vault_delete_note"
            | "vault_lint_fix"
            | "vault_restore_note_history_revision"
            | "git_pull_cmd"
            | "git_push_cmd"
            | "git_resolve_conflict_cmd"
    )
}
