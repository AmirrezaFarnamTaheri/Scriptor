use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;

use chrono::NaiveDate;
use scriptor_export_runner::{
    default_export_directory, discover_pandoc, run_export_job, ExportJobInput, ExportJobOutput,
};
use scriptor_indexer::{
    backlinks_for_path, evaluate_view_filter_json, execute_dql_query, health_diagnostics_json,
    health_report_json, incremental_note_index_with_cache, incremental_notes_index_with_cache,
    list_bibliography_entries, list_dead_end_notes, list_inbox_notes, list_note_summaries,
    list_orphan_notes, list_recent_files, list_unresolved_link_targets, list_vault_tags,
    list_view_notes, notes_for_tag, open_cache_for_session, parse_note_markdown, query_focused_graph,
    rebuild_index, record_recent_access, resolve_wikilink_target_with_aliases, search_notes,
    traverse_graph, InboxPeriod, ViewNoteHit,
};
use scriptor_native_git::{
    git_commit_selected, git_pull, git_push, git_resolve_conflict, git_show_head_file, git_status,
    read_conflict_markers,
};
use scriptor_canvas_engine::{
    apply_template, apply_template_dry_run, document_to_json, hit_test, list_documents, list_templates,
    load_document, parse_document_json, query_blocks_in_bounds, render_svg, restore_template_checkpoint,
    save_document, write_snapshot, CanvasPoint, CanvasRect, SnapshotFormat,
};
use scriptor_system_bridge::detect_system_info;
use scriptor_vault::{
    append_activity_log, append_stats_history, block_rename_apply, block_rename_dry_run,
    build_note_markdown, delete_note, export_text_bundle, lint_vault_fix, list_note_history, list_recent_notes,
    load_vault_config, load_vault_snippets, load_vault_template, plan_daily_note, read_activity_log,
    read_note, read_note_history_revision, read_stats_history, read_workspace_session, record_recent_note,
    rename_apply_staged, rename_dry_run, rollback_save_note, save_note, save_note_with_options,
    save_vault_config, save_vault_snippets, scan_vault, scan_vault_with_roots, section_rename_apply,
    section_rename_dry_run, set_frontmatter_field, tag_rename_apply, tag_rename_dry_run,
    write_workspace_session, ActivityLogEntry, RelativeVaultPath, SaveNoteOptions, StatsHistoryEntry,
    VaultConfig, VaultSnippet, WorkspaceSession, RULE_MISSING_HEADING, RULE_STALE_DEFINITIONS,
};
use serde::Serialize;
use serde_json::{json, Value};
use uuid::Uuid;

use crate::handler::DaemonState;

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
    )
}

pub fn dispatch(state: &mut DaemonState, command: &str, payload: &Value) -> Result<Value, String> {
    match command {
        "health_check" => Ok(json!("ok")),
        "system_info" => to_value(detect_system_info()),
        "vault_open" => {
            let root_path = require_str(payload, "root_path")?;
            to_value(state.open_vault_invoke(root_path)?)
        }
        "vault_save_asset" => {
            let session = state.require_session()?;
            let relative_path = require_str(payload, "relative_path")?;
            let bytes = require_bytes(payload, "bytes")?;
            let relative = RelativeVaultPath::parse(&relative_path).map_err(|error| error.to_string())?;
            let absolute: PathBuf = session
                .root
                .resolve_relative(&relative)
                .map_err(|error| error.to_string())?;
            if let Some(parent) = absolute.parent() {
                fs::create_dir_all(parent).map_err(|error| error.to_string())?;
            }
            fs::write(&absolute, &bytes).map_err(|error| error.to_string())?;
            Ok(json!(relative.to_string()))
        }
        "vault_scan" => {
            let session = state.require_session()?;
            let config = load_vault_config(session.root.root()).unwrap_or_default();
            to_value(scan_vault_with_roots(&session.root, &config.extra_roots).map_err(|e| e.to_string())?)
        }
        "vault_read_note" => {
            let session = state.require_session()?;
            let path = require_str(payload, "path")?;
            let relative = RelativeVaultPath::parse(&path).map_err(|error| error.to_string())?;
            to_value(read_note(&session.descriptor.id, &session.root, &relative).map_err(|e| e.to_string())?)
        }
        "vault_save_note" => {
            let path = require_str(payload, "path")?;
            let markdown = require_str(payload, "markdown")?;
            let expected_content_hash = optional_str(payload, "expected_content_hash");
            let dry_run = optional_bool(payload, "dry_run").unwrap_or(false);
            to_value(cmd_save_note(state, &path, &markdown, expected_content_hash.as_deref(), dry_run)?)
        }
        "vault_list_recent_notes" => {
            let session = state.require_session()?;
            let limit = optional_u32(payload, "limit").unwrap_or(20) as usize;
            to_value(list_recent_notes(&session.root, limit).map_err(|e| e.to_string())?)
        }
        "vault_record_recent_note" => {
            let session = state.require_session()?;
            let path = require_str(payload, "path")?;
            to_value(record_recent_note(&session.root, &path).map_err(|e| e.to_string())?)
        }
        "vault_delete_note" => {
            let session = state.require_session()?;
            let path = require_str(payload, "path")?;
            let relative = RelativeVaultPath::parse(&path).map_err(|error| error.to_string())?;
            to_value(delete_note(&session.root, &relative).map_err(|e| e.to_string())?)
        }
        "vault_rename_dry_run" => {
            let session = state.require_session()?;
            let from_path = require_str(payload, "from_path")?;
            let to_path = require_str(payload, "to_path")?;
            let update_links = require_bool(payload, "update_links")?;
            let from = RelativeVaultPath::parse(&from_path).map_err(|error| error.to_string())?;
            let to = RelativeVaultPath::parse(&to_path).map_err(|error| error.to_string())?;
            to_value(
                rename_dry_run(
                    &session.descriptor.id,
                    &session.root,
                    &from,
                    &to,
                    update_links,
                )
                .map_err(|e| e.to_string())?,
            )
        }
        "vault_rename_apply" => {
            let from_path = require_str(payload, "from_path")?;
            let to_path = require_str(payload, "to_path")?;
            let update_links = require_bool(payload, "update_links")?;
            to_value(cmd_rename_apply(state, &from_path, &to_path, update_links)?)
        }
        "vault_rename_tag_dry_run" => {
            let session = state.require_session()?;
            let old_tag = require_str(payload, "old_tag")?;
            let new_tag = require_str(payload, "new_tag")?;
            to_value(
                tag_rename_dry_run(&session.descriptor.id, &session.root, &old_tag, &new_tag)
                    .map_err(|e| e.to_string())?,
            )
        }
        "vault_rename_tag_apply" => {
            let session = state.require_session()?;
            let old_tag = require_str(payload, "old_tag")?;
            let new_tag = require_str(payload, "new_tag")?;
            to_value(
                tag_rename_apply(&session.descriptor.id, &session.root, &old_tag, &new_tag)
                    .map_err(|e| e.to_string())?,
            )
        }
        "vault_rename_section_dry_run" => {
            let session = state.require_session()?;
            let note_path = require_str(payload, "note_path")?;
            let old_section = require_str(payload, "old_section")?;
            let new_section = require_str(payload, "new_section")?;
            let update_heading = require_bool(payload, "update_heading")?;
            let path = RelativeVaultPath::parse(&note_path).map_err(|error| error.to_string())?;
            to_value(
                section_rename_dry_run(
                    &session.descriptor.id,
                    &session.root,
                    &path,
                    &old_section,
                    &new_section,
                    update_heading,
                )
                .map_err(|e| e.to_string())?,
            )
        }
        "vault_rename_section_apply" => {
            let session = state.require_session()?;
            let note_path = require_str(payload, "note_path")?;
            let old_section = require_str(payload, "old_section")?;
            let new_section = require_str(payload, "new_section")?;
            let update_heading = require_bool(payload, "update_heading")?;
            let path = RelativeVaultPath::parse(&note_path).map_err(|error| error.to_string())?;
            to_value(
                section_rename_apply(
                    &session.descriptor.id,
                    &session.root,
                    &path,
                    &old_section,
                    &new_section,
                    update_heading,
                )
                .map_err(|e| e.to_string())?,
            )
        }
        "vault_rename_block_dry_run" => {
            let session = state.require_session()?;
            let note_path = require_str(payload, "note_path")?;
            let old_block = require_str(payload, "old_block")?;
            let new_block = require_str(payload, "new_block")?;
            let update_anchor = require_bool(payload, "update_anchor")?;
            let path = RelativeVaultPath::parse(&note_path).map_err(|error| error.to_string())?;
            to_value(
                block_rename_dry_run(
                    &session.descriptor.id,
                    &session.root,
                    &path,
                    &old_block,
                    &new_block,
                    update_anchor,
                )
                .map_err(|e| e.to_string())?,
            )
        }
        "vault_rename_block_apply" => {
            let session = state.require_session()?;
            let note_path = require_str(payload, "note_path")?;
            let old_block = require_str(payload, "old_block")?;
            let new_block = require_str(payload, "new_block")?;
            let update_anchor = require_bool(payload, "update_anchor")?;
            let path = RelativeVaultPath::parse(&note_path).map_err(|error| error.to_string())?;
            to_value(
                block_rename_apply(
                    &session.descriptor.id,
                    &session.root,
                    &path,
                    &old_block,
                    &new_block,
                    update_anchor,
                )
                .map_err(|e| e.to_string())?,
            )
        }
        "vault_lint_fix" => {
            let session = state.require_session()?;
            let rules = vec![
                RULE_MISSING_HEADING.to_string(),
                RULE_STALE_DEFINITIONS.to_string(),
            ];
            let output =
                lint_vault_fix(&session.descriptor.id, &session.root, &rules).map_err(|e| e.to_string())?;
            if !output.fixed_paths.is_empty() {
                incremental_notes_index_with_cache(session, state.require_cache()?, &output.fixed_paths, &[])
                    .map_err(|e| e.to_string())?;
            }
            to_value(output)
        }
        "vault_load_config" => {
            let session = state.require_session()?;
            to_value(load_vault_config(session.root.root()).map_err(|e| e.to_string())?)
        }
        "vault_load_snippets" => {
            let session = state.require_session()?;
            to_value(load_vault_snippets(session.root.root()).map_err(|e| e.to_string())?)
        }
        "vault_save_snippets" => {
            let session = state.require_session()?;
            let snippets: Vec<VaultSnippet> = require_deserialize(payload, "snippets")?;
            save_vault_snippets(session.root.root(), &snippets).map_err(|e| e.to_string())?;
            Ok(Value::Null)
        }
        "vault_load_template" => {
            let session = state.require_session()?;
            let template_path = require_str(payload, "template_path")?;
            let config = load_vault_config(session.root.root()).map_err(|e| e.to_string())?;
            to_value(
                load_vault_template(session.root.root(), &config.templates_directory, &template_path)
                    .map_err(|e| e.to_string())?,
            )
        }
        "vault_build_note_markdown" => {
            let title = require_str(payload, "title")?;
            let note_type = optional_str(payload, "note_type");
            let template_body = optional_str(payload, "template_body");
            Ok(json!(build_note_markdown(
                &title,
                note_type.as_deref(),
                template_body.as_deref()
            )))
        }
        "vault_save_config_cmd" => {
            let session = state.require_session()?;
            let config: VaultConfig = require_deserialize(payload, "config")?;
            save_vault_config(session.root.root(), &config).map_err(|e| e.to_string())?;
            state.config_generation = state.config_generation.saturating_add(1);
            Ok(Value::Null)
        }
        "vault_plan_daily_note" => {
            let session = state.require_session()?;
            let parsed = optional_str(payload, "date")
                .and_then(|value| NaiveDate::parse_from_str(&value, "%Y-%m-%d").ok());
            to_value(plan_daily_note(session.root.root(), parsed).map_err(|e| e.to_string())?)
        }
        "vault_list_view_notes" => {
            let session = state.require_session()?;
            let filter_json = require_str(payload, "filter_json")?;
            let cache = open_cache_for_session(session).map_err(|e| e.to_string())?;
            let hits: Vec<ViewNoteHit> =
                list_view_notes(&cache, session, &filter_json).map_err(|e| e.to_string())?;
            to_value(hits)
        }
        "vault_frontmatter_set" => {
            let session = state.require_session()?;
            let path = require_str(payload, "path")?;
            let field = require_str(payload, "field")?;
            let value_str = require_str(payload, "value")?;
            let relative = RelativeVaultPath::parse(&path).map_err(|error| error.to_string())?;
            let document =
                read_note(&session.descriptor.id, &session.root, &relative).map_err(|e| e.to_string())?;
            let markdown =
                set_frontmatter_field(&document.markdown, &field, &value_str).map_err(|e| e.to_string())?;
            let _saved = save_note(
                &session.descriptor.id,
                &session.root,
                &relative,
                &markdown,
                Some(&document.metadata.content_hash),
            )
            .map_err(|e| e.to_string())?;
            incremental_note_index_with_cache(session, state.require_cache()?, &path, &[])
                .map_err(|e| e.to_string())?;
            to_value(json!({
                "path": path,
                "field": field,
                "value": value_str,
                "markdown": read_note(&session.descriptor.id, &session.root, &relative)
                    .map_err(|e| e.to_string())?
                    .markdown,
            }))
        }
        "vault_textbundle_export" => {
            let session = state.require_session()?;
            let note_path = require_str(payload, "note_path")?;
            let output_path = require_str(payload, "output_path")?;
            let relative = RelativeVaultPath::parse(&note_path).map_err(|error| error.to_string())?;
            to_value(
                export_text_bundle(
                    &session.descriptor.id,
                    &session.root,
                    &relative,
                    Path::new(&output_path),
                )
                .map_err(|e| e.to_string())?,
            )
        }
        "vault_read_stats_history" => {
            let session = state.require_session()?;
            let config = load_vault_config(session.root.root()).unwrap_or_default();
            let path = config
                .writing_targets
                .history_path
                .as_deref()
                .unwrap_or(scriptor_vault::DEFAULT_STATS_HISTORY_PATH);
            to_value(read_stats_history(&session.root, path).map_err(|e| e.to_string())?)
        }
        "vault_append_stats_history" => {
            let session = state.require_session()?;
            let date = require_str(payload, "date")?;
            let words = require_u32(payload, "words")?;
            let config = load_vault_config(session.root.root()).unwrap_or_default();
            let path = config
                .writing_targets
                .history_path
                .as_deref()
                .unwrap_or(scriptor_vault::DEFAULT_STATS_HISTORY_PATH);
            to_value(
                append_stats_history(
                    &session.root,
                    path,
                    StatsHistoryEntry { date, words },
                )
                .map_err(|e| e.to_string())?,
            )
        }
        "vault_read_activity_log" => {
            let session = state.require_session()?;
            let limit = payload
                .get("limit")
                .and_then(Value::as_u64)
                .map(|value| value as usize)
                .unwrap_or(100);
            to_value(read_activity_log(&session.root, limit).map_err(|e| e.to_string())?)
        }
        "vault_append_activity_log" => {
            let session = state.require_session()?;
            append_activity_log(
                &session.root,
                ActivityLogEntry {
                    id: require_str(payload, "id")?,
                    ts: require_i64(payload, "ts")?,
                    kind: require_str(payload, "kind")?,
                    message: require_str(payload, "message")?,
                    detail: optional_str(payload, "detail"),
                },
            )
            .map_err(|e| e.to_string())?;
            Ok(Value::Null)
        }
        "vault_read_workspace_session" => {
            let session = state.require_session()?;
            to_value(read_workspace_session(&session.root).map_err(|e| e.to_string())?)
        }
        "vault_save_workspace_session" => {
            let session = state.require_session()?;
            let workspace: WorkspaceSession = require_deserialize(payload, "session")?;
            write_workspace_session(&session.root, &workspace).map_err(|e| e.to_string())?;
            Ok(Value::Null)
        }
        "vault_list_note_history" => {
            let session = state.require_session()?;
            let path = require_str(payload, "path")?;
            to_value(list_note_history(&session.root, &path).map_err(|e| e.to_string())?)
        }
        "vault_read_note_history_revision" => {
            let session = state.require_session()?;
            let path = require_str(payload, "path")?;
            let revision_id = require_str(payload, "revisionId")?;
            Ok(json!(read_note_history_revision(&session.root, &path, &revision_id).map_err(|e| e.to_string())?))
        }
        "vault_restore_note_history_revision" => {
            let session = state.require_session()?;
            let path = require_str(payload, "path")?;
            let revision_id = require_str(payload, "revisionId")?;
            let relative = RelativeVaultPath::parse(&path).map_err(|e| e.to_string())?;
            let markdown =
                read_note_history_revision(&session.root, &path, &revision_id).map_err(|e| e.to_string())?;
            to_value(save_note_with_options(
                &session.descriptor.id,
                &session.root,
                &relative,
                &markdown,
                None,
                SaveNoteOptions { dry_run: false },
            )
            .map_err(|e| e.to_string())?)
        }
        "vault_health" => {
            let session = state.require_session()?;
            let cache = state.require_cache()?;
            Ok(json!(health_report_json(cache, session).map_err(|e| e.to_string())?))
        }
        "indexer_rebuild" => to_value(cmd_indexer_rebuild(state)?),
        "indexer_update_note" => {
            let path = require_str(payload, "path")?;
            incremental_note_index_with_cache(state.require_session()?, state.require_cache()?, &path, &[])
                .map_err(|e| e.to_string())?;
            Ok(json!(true))
        }
        "indexer_apply_filesystem_changes" => {
            let paths: Vec<String> = require_deserialize(payload, "paths")?;
            to_value(
                incremental_notes_index_with_cache(
                    state.require_session()?,
                    state.require_cache()?,
                    &paths,
                    &[],
                )
                .map_err(|e| e.to_string())?,
            )
        }
        "indexer_search" => {
            let session = state.require_session()?;
            let cache = state.require_cache()?;
            let query = require_str(payload, "query")?;
            let limit = optional_u32(payload, "limit").unwrap_or(25);
            to_value(search_notes(cache, &session.descriptor.id, &query, limit).map_err(|e| e.to_string())?)
        }
        "indexer_list_tags" => {
            let session = state.require_session()?;
            let cache = state.require_cache()?;
            to_value(list_vault_tags(cache, &session.descriptor.id).map_err(|e| e.to_string())?)
        }
        "indexer_notes_for_tag" => {
            let session = state.require_session()?;
            let cache = state.require_cache()?;
            let tag = require_str(payload, "tag")?;
            to_value(notes_for_tag(cache, &session.descriptor.id, &tag).map_err(|e| e.to_string())?)
        }
        "indexer_resolve_wikilink" => {
            let target = require_str(payload, "target")?;
            cmd_resolve_wikilink(state, &target)
        }
        "indexer_list_recent_files" => {
            state.require_session()?;
            let cache = state.require_cache()?;
            let limit = optional_u32(payload, "limit").unwrap_or(20);
            to_value(list_recent_files(cache, limit).map_err(|e| e.to_string())?)
        }
        "indexer_record_recent_access" => {
            state.require_session()?;
            let cache = state.require_cache()?;
            let path = require_str(payload, "path")?;
            record_recent_access(cache, &path).map_err(|e| e.to_string())?;
            Ok(Value::Null)
        }
        "indexer_list_orphans" => {
            let session = state.require_session()?;
            let cache = state.require_cache()?;
            to_value(list_orphan_notes(cache, session).map_err(|e| e.to_string())?)
        }
        "indexer_list_inbox" => {
            let session = state.require_session()?;
            let cache = state.require_cache()?;
            let period = InboxPeriod::parse(optional_str(payload, "period").as_deref().unwrap_or("all"));
            to_value(list_inbox_notes(cache, &session.descriptor.id, period).map_err(|e| e.to_string())?)
        }
        "indexer_list_note_summaries" => {
            let session = state.require_session()?;
            let cache = state.require_cache()?;
            to_value(list_note_summaries(cache, &session.descriptor.id).map_err(|e| e.to_string())?)
        }
        "indexer_list_dead_ends" => {
            let session = state.require_session()?;
            let cache = state.require_cache()?;
            to_value(list_dead_end_notes(cache, session).map_err(|e| e.to_string())?)
        }
        "indexer_list_unresolved_targets" => {
            let session = state.require_session()?;
            let cache = state.require_cache()?;
            to_value(list_unresolved_link_targets(cache, session).map_err(|e| e.to_string())?)
        }
        "indexer_evaluate_view" => {
            let session = state.require_session()?;
            let filter_json = require_str(payload, "filter_json")?;
            let path = require_str(payload, "path")?;
            let relative = RelativeVaultPath::parse(&path).map_err(|error| error.to_string())?;
            let document =
                read_note(&session.descriptor.id, &session.root, &relative).map_err(|e| e.to_string())?;
            to_value(evaluate_view_filter_json(&filter_json, &document.metadata).map_err(|e| e.to_string())?)
        }
        "indexer_list_bibliography" => {
            state.require_session()?;
            let cache = state.require_cache()?;
            to_value(list_bibliography_entries(cache).map_err(|e| e.to_string())?)
        }
        "indexer_backlinks" => {
            let session = state.require_session()?;
            let cache = state.require_cache()?;
            let path = require_str(payload, "path")?;
            to_value(backlinks_for_path(cache, session, &path).map_err(|e| e.to_string())?)
        }
        "indexer_graph" => {
            let session = state.require_session()?;
            let cache = state.require_cache()?;
            let focus_path = optional_str(payload, "focus_path");
            let depth = optional_u32(payload, "depth").unwrap_or(1);
            let config = load_vault_config(session.root.root()).unwrap_or_default();
            to_value(
                query_focused_graph(
                    cache,
                    session,
                    focus_path.as_deref(),
                    depth,
                    &config.graph_groups,
                )
                .map_err(|e| e.to_string())?,
            )
        }
        "indexer_traverse_graph" => {
            let session = state.require_session()?;
            let cache = state.require_cache()?;
            let focus_path = require_str(payload, "focus_path")?;
            let depth = require_u32(payload, "depth")?;
            to_value(traverse_graph(cache, session, &focus_path, depth).map_err(|e| e.to_string())?)
        }
        "indexer_execute_dql" => {
            let session = state.require_session()?;
            let cache = state.require_cache()?;
            let query = require_str(payload, "query")?;
            to_value(execute_dql_query(cache, session, &query).map_err(|e| e.to_string())?)
        }
        "indexer_health_diagnostics" => {
            let session = state.require_session()?;
            let cache = state.require_cache()?;
            Ok(json!(health_diagnostics_json(cache, session).map_err(|e| e.to_string())?))
        }
        "export_discover" => to_value(discover_pandoc().map_err(|e| e.to_string())?),
        "export_run_note" | "export_run_markdown" => {
            Err(format!("command {command} must be dispatched outside the daemon state lock"))
        }
        "export_start_note" => {
            let note_path = require_str(payload, "note_path")?;
            let format = require_str(payload, "format")?;
            let dry_run = optional_bool(payload, "dry_run").unwrap_or(false);
            let extra_pandoc_args: Vec<String> =
                optional_deserialize(payload, "extra_pandoc_args").unwrap_or_default();
            let output_subdirectory = optional_str(payload, "output_subdirectory");
            let job_id = Uuid::new_v4().to_string();
            let input = build_export_note_input(
                state,
                &note_path,
                &format,
                dry_run,
                &extra_pandoc_args,
                &output_subdirectory,
                Some(job_id.clone()),
            )?;
            state.export_job.start(input)?;
            to_value(json!({
                "job_id": job_id,
                "note_path": note_path,
                "format": format,
            }))
        }
        "export_cancel" => {
            state.export_job.cancel(None).map_err(|e| e.to_string())?;
            Ok(json!(true))
        }
        "export_job_status" => {
            let report = state.export_job.progress_snapshot();
            to_value(report)
        }
        "index_rebuild_status" => {
            let report = state.index_rebuild.progress_snapshot();
            to_value(report)
        }
        "reload_config" => {
            state.config_generation = state.config_generation.saturating_add(1);
            let session = state.require_session()?;
            let config = load_vault_config(session.root.root()).map_err(|e| e.to_string())?;
            to_value(json!({
                "json": serde_json::to_string(&config).map_err(|e| e.to_string())?,
                "generation": state.config_generation,
            }))
        }
        "set_headless_engine" => Ok(Value::Null),
        "pdf_translate" => to_value(cmd_pdf_translate(state, payload)?),
        "git_status_cmd" => {
            let session = state.require_session()?;
            to_value(git_status(session.root.root()).map_err(|e| e.to_string())?)
        }
        "git_commit_cmd" => {
            let session = state.require_session()?;
            let files: Vec<String> = require_deserialize(payload, "files")?;
            let message = require_str(payload, "message")?;
            to_value(
                git_commit_selected(session.root.root(), &files, &message).map_err(|e| e.to_string())?,
            )
        }
        "git_pull_cmd" => {
            let session = state.require_session()?;
            to_value(git_pull(session.root.root()).map_err(|e| e.to_string())?)
        }
        "git_push_cmd" => {
            let session = state.require_session()?;
            to_value(git_push(session.root.root()).map_err(|e| e.to_string())?)
        }
        "git_resolve_conflict_cmd" => {
            let session = state.require_session()?;
            let path = require_str(payload, "path")?;
            let strategy = require_str(payload, "strategy")?;
            to_value(
                git_resolve_conflict(session.root.root(), &path, &strategy).map_err(|e| e.to_string())?,
            )
        }
        "git_read_conflict_markers_cmd" => {
            let session = state.require_session()?;
            let path = require_str(payload, "path")?;
            let relative = RelativeVaultPath::parse(&path).map_err(|error| error.to_string())?;
            let file_path = session
                .root
                .resolve_relative(&relative)
                .map_err(|error| error.to_string())?;
            to_value(read_conflict_markers(&file_path).map_err(|e| e.to_string())?)
        }
        "git_show_head_file_cmd" => {
            let session = state.require_session()?;
            let path = require_str(payload, "path")?;
            let relative = RelativeVaultPath::parse(&path).map_err(|error| error.to_string())?;
            let resolved = session.root.resolve_relative(&relative).map_err(|error| error.to_string())?;
            let rel_str = resolved.strip_prefix(session.root.root()).unwrap_or(&resolved);
            to_value(git_show_head_file(session.root.root(), &rel_str.to_string_lossy()).map_err(|e| e.to_string())?)
        }
        "plantuml_render" => to_value(cmd_plantuml_render(payload)?),
        "canvas_hit_test" => {
            let scene_json = require_str(payload, "scene_json")?;
            let x = require_f64(payload, "x")?;
            let y = require_f64(payload, "y")?;
            let document = parse_document_json(&scene_json).map_err(|error| error.to_string())?;
            to_value(hit_test(&document, CanvasPoint { x, y }))
        }
        "canvas_render_svg" => {
            let scene_json = require_str(payload, "scene_json")?;
            let document = parse_document_json(&scene_json).map_err(|error| error.to_string())?;
            Ok(json!(render_svg(&document, None)))
        }
        "canvas_template_dry_run" => {
            let scene_json = require_str(payload, "scene_json")?;
            let template_id = require_str(payload, "template_id")?;
            let document = parse_document_json(&scene_json).map_err(|error| error.to_string())?;
            to_value(apply_template_dry_run(&document, &template_id).map_err(|error| error.to_string())?)
        }
        "canvas_apply_template" => {
            let session = state.require_session()?;
            let scene_json = require_str(payload, "scene_json")?;
            let template_id = require_str(payload, "template_id")?;
            let document = parse_document_json(&scene_json).map_err(|error| error.to_string())?;
            to_value(
                apply_template(session.root.root(), &document, &template_id)
                    .map_err(|error| error.to_string())?,
            )
        }
        "canvas_restore_template" => {
            let session = state.require_session()?;
            let patch_id = require_str(payload, "patch_id")?;
            let document = restore_template_checkpoint(session.root.root(), &patch_id)
                .map_err(|error| error.to_string())?;
            Ok(json!(document_to_json(&document).map_err(|error| error.to_string())?))
        }
        "canvas_query_blocks" => {
            let scene_json = require_str(payload, "scene_json")?;
            let x = require_f64(payload, "x")?;
            let y = require_f64(payload, "y")?;
            let width = require_f64(payload, "width")?;
            let height = require_f64(payload, "height")?;
            let document = parse_document_json(&scene_json).map_err(|error| error.to_string())?;
            let bounds = CanvasRect { x, y, width, height };
            let ids: Vec<String> = query_blocks_in_bounds(&document, bounds, None)
                .into_iter()
                .map(|block| block.id)
                .collect();
            Ok(json!(ids))
        }
        "canvas_list_templates" => to_value(list_templates()),
        "canvas_snapshot" => {
            let scene_json = require_str(payload, "scene_json")?;
            let format = require_str(payload, "format")?;
            let output_path = require_str(payload, "output_path")?;
            let dry_run = optional_bool(payload, "dry_run").unwrap_or(false);
            let document = parse_document_json(&scene_json).map_err(|error| error.to_string())?;
            let snapshot_format = match format.as_str() {
                "svg" => SnapshotFormat::Svg,
                "png" => SnapshotFormat::Png,
                "pdf" => SnapshotFormat::Pdf,
                other => return Err(format!("unsupported snapshot format: {other}")),
            };
            to_value(
                write_snapshot(
                    &document,
                    Path::new(&output_path),
                    snapshot_format,
                    dry_run,
                )
                .map_err(|error| error.to_string())?,
            )
        }
        "canvas_save_document" => {
            let session = state.require_session()?;
            let scene_json = require_str(payload, "scene_json")?;
            let document = parse_document_json(&scene_json).map_err(|error| error.to_string())?;
            let path = save_document(session.root.root(), &document).map_err(|error| error.to_string())?;
            Ok(json!(path.display().to_string()))
        }
        "canvas_load_document" => {
            let session = state.require_session()?;
            let canvas_id = require_str(payload, "canvas_id")?;
            let document = load_document(session.root.root(), &canvas_id).map_err(|error| error.to_string())?;
            Ok(json!(document_to_json(&document).map_err(|error| error.to_string())?))
        }
        "canvas_list_documents" => {
            let session = state.require_session()?;
            to_value(list_documents(session.root.root()).map_err(|error| error.to_string())?)
        }
        other => Err(format!("unknown command: {other}")),
    }
}

pub fn prepare_export_run(state: &DaemonState, command: &str, payload: &Value) -> Result<ExportJobInput, String> {
    match command {
        "export_run_note" => {
            let note_path = require_str(payload, "note_path")?;
            let format = require_str(payload, "format")?;
            let dry_run = optional_bool(payload, "dry_run").unwrap_or(false);
            let extra_pandoc_args: Vec<String> =
                optional_deserialize(payload, "extra_pandoc_args").unwrap_or_default();
            let output_subdirectory = optional_str(payload, "output_subdirectory");
            build_export_note_input(
                state,
                &note_path,
                &format,
                dry_run,
                &extra_pandoc_args,
                &output_subdirectory,
                None,
            )
        }
        "export_run_markdown" => {
            let note_path = require_str(payload, "note_path")?;
            let source_markdown = require_str(payload, "source_markdown")?;
            let format = require_str(payload, "format")?;
            let dry_run = optional_bool(payload, "dry_run").unwrap_or(false);
            let extra_pandoc_args: Vec<String> =
                optional_deserialize(payload, "extra_pandoc_args").unwrap_or_default();
            let output_subdirectory = optional_str(payload, "output_subdirectory");
            build_export_markdown_input(
                state,
                &note_path,
                &source_markdown,
                &format,
                dry_run,
                &extra_pandoc_args,
                &output_subdirectory,
                None,
            )
        }
        other => Err(format!("not an export run command: {other}")),
    }
}

pub fn run_export_command(state: &DaemonState, command: &str, payload: &Value) -> Result<ExportJobOutput, String> {
    let input = prepare_export_run(state, command, payload)?;
    run_export_job(input).map_err(|error| error.to_string())
}

pub fn rebuild_index_command(state: &DaemonState) -> Result<Value, String> {
    cmd_indexer_rebuild(state)
}

fn cmd_indexer_rebuild(state: &DaemonState) -> Result<Value, String> {
    state.index_rebuild.wait();
    let session = state.require_session()?.clone();
    to_value(rebuild_index(&session, &[]).map_err(|e| e.to_string())?)
}

fn cmd_save_note(
    state: &DaemonState,
    path: &str,
    markdown: &str,
    expected_content_hash: Option<&str>,
    dry_run: bool,
) -> Result<scriptor_vault::SaveNoteOutput, String> {
    let session = state.require_session()?;
    let note_path = RelativeVaultPath::parse(path).map_err(|error| error.to_string())?;
    let output = save_note_with_options(
        &session.descriptor.id,
        &session.root,
        &note_path,
        markdown,
        expected_content_hash,
        SaveNoteOptions { dry_run },
    )
    .map_err(|error| error.to_string())?;
    if !dry_run {
        if let Err(error) =
            incremental_note_index_with_cache(session, state.require_cache()?, path, &[])
        {
            if let Err(rollback_error) = rollback_save_note(
                &session.descriptor.id,
                &session.root,
                &note_path,
                output.previous_content_hash.as_deref(),
            ) {
                return Err(format!(
                    "index update failed: {error}; disk rollback failed: {rollback_error}"
                ));
            }
            return Err(error.to_string());
        }
    }
    Ok(output)
}

fn cmd_rename_apply(
    state: &DaemonState,
    from_path: &str,
    to_path: &str,
    update_links: bool,
) -> Result<scriptor_vault::RenameNoteApplyOutput, String> {
    let session = state.require_session()?;
    let from = RelativeVaultPath::parse(from_path).map_err(|error| error.to_string())?;
    let to = RelativeVaultPath::parse(to_path).map_err(|error| error.to_string())?;
    let (output, staged) = rename_apply_staged(
        &session.descriptor.id,
        &session.root,
        &from,
        &to,
        update_links,
    )
    .map_err(|error| error.to_string())?;
    if let Err(error) =
        incremental_notes_index_with_cache(session, state.require_cache()?, &output.affected_files, &[])
    {
        let _ = staged.abort();
        return Err(error.to_string());
    }
    staged.commit().map_err(|error| error.to_string())?;
    Ok(output)
}

fn cmd_resolve_wikilink(state: &DaemonState, target: &str) -> Result<Value, String> {
    let session = state.require_session()?;
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
    to_value(resolve_wikilink_target_with_aliases(
        &note_paths,
        &aliases_by_path,
        target,
    ))
}

fn build_export_note_input(
    state: &DaemonState,
    note_path: &str,
    format: &str,
    dry_run: bool,
    extra_pandoc_args: &[String],
    output_subdirectory: &Option<String>,
    job_id: Option<String>,
) -> Result<ExportJobInput, String> {
    let session = state.require_session()?;
    let relative = RelativeVaultPath::parse(note_path).map_err(|error| error.to_string())?;
    let note = read_note(&session.descriptor.id, &session.root, &relative).map_err(|error| error.to_string())?;
    let stem = note_path
        .trim_end_matches(".md")
        .rsplit('/')
        .next()
        .unwrap_or("note");
    let output_directory = match output_subdirectory {
        Some(subdir) => {
            let _validated = RelativeVaultPath::parse(subdir).map_err(|error| format!("invalid output_subdirectory: {error}"))?;
            session.root.root().join(subdir)
        }
        None => default_export_directory(session.root.root()),
    };
    Ok(ExportJobInput {
        format: format.to_string(),
        source_markdown: note.markdown,
        output_directory: output_directory.display().to_string(),
        source_stem: stem.to_string(),
        title: Some(note.metadata.title),
        dry_run,
        extra_pandoc_args: extra_pandoc_args.to_vec(),
        vault_root: session.root.root().display().to_string(),
        job_id,
        preserve_temp_on_failure: false,
        trusted_pandoc_hash: None,
    })
}

fn build_export_markdown_input(
    state: &DaemonState,
    note_path: &str,
    source_markdown: &str,
    format: &str,
    dry_run: bool,
    extra_pandoc_args: &[String],
    output_subdirectory: &Option<String>,
    job_id: Option<String>,
) -> Result<ExportJobInput, String> {
    let session = state.require_session()?;
    let relative = RelativeVaultPath::parse(note_path).map_err(|error| error.to_string())?;
    let note = read_note(&session.descriptor.id, &session.root, &relative).map_err(|error| error.to_string())?;
    let stem = note_path
        .trim_end_matches(".md")
        .rsplit('/')
        .next()
        .unwrap_or("note");
    let output_directory = match output_subdirectory {
        Some(subdir) => {
            let _validated = RelativeVaultPath::parse(subdir).map_err(|error| format!("invalid output_subdirectory: {error}"))?;
            session.root.root().join(subdir)
        }
        None => default_export_directory(session.root.root()),
    };
    Ok(ExportJobInput {
        format: format.to_string(),
        source_markdown: source_markdown.to_string(),
        output_directory: output_directory.display().to_string(),
        source_stem: stem.to_string(),
        title: Some(note.metadata.title),
        dry_run,
        extra_pandoc_args: extra_pandoc_args.to_vec(),
        vault_root: session.root.root().display().to_string(),
        job_id,
        preserve_temp_on_failure: false,
        trusted_pandoc_hash: None,
    })
}

#[derive(serde::Serialize)]
struct PdfTranslateOutput {
    #[serde(rename = "outputPath")]
    output_path: String,
}

fn cmd_pdf_translate(state: &DaemonState, payload: &Value) -> Result<PdfTranslateOutput, String> {
    let session = state.require_session()?;
    let input_path = require_str(payload, "input_path")?;
    let relative = RelativeVaultPath::parse(&input_path).map_err(|error| format!("invalid input_path: {error}"))?;
    let resolved = session.root.resolve_relative(&relative).map_err(|error| error.to_string())?;
    let resolved_str = resolved.display().to_string();
    let pdf2zh = std::env::var("SCRIPTOR_PDF2ZH_PATH").unwrap_or_else(|_| "pdf2zh".into());
    let mut command = Command::new(&pdf2zh);
    command
        .arg(&resolved_str)
        .arg("-li")
        .arg(optional_str(payload, "lang_in").unwrap_or_else(|| "en".into()))
        .arg("-lo")
        .arg(optional_str(payload, "lang_out").unwrap_or_else(|| "zh".into()));
    if let Some(out) = optional_str(payload, "output_path") {
        let out_relative = RelativeVaultPath::parse(&out).map_err(|error| format!("invalid output_path: {error}"))?;
        let out_resolved = session.root.resolve_relative(&out_relative).map_err(|error| error.to_string())?;
        command.arg("-o").arg(&out_resolved);
    }
    let status = command.status().map_err(|error| {
        format!(
            "pdf2zh was not found ({error}). Install PDFMathTranslate (pip install pdf2zh) or set SCRIPTOR_PDF2ZH_PATH."
        )
    })?;
    if !status.success() {
        return Err("pdf2zh exited with an error.".into());
    }
    let stem = resolved
        .file_stem()
        .and_then(|value| value.to_str())
        .unwrap_or("document");
    let parent = resolved.parent().unwrap_or_else(|| Path::new("."));
    Ok(PdfTranslateOutput {
        output_path: parent.join(format!("{stem}-dual.pdf")).display().to_string(),
    })
}

#[derive(serde::Serialize)]
struct PlantUmlRenderOutput {
    svg: String,
    engine: String,
}

fn cmd_plantuml_render(payload: &Value) -> Result<PlantUmlRenderOutput, String> {
    let source = require_str(payload, "source")?;
    let temp_dir = std::env::temp_dir().join(format!("scriptor-plantuml-{}", Uuid::new_v4()));
    fs::create_dir_all(&temp_dir).map_err(|error| error.to_string())?;
    let input = temp_dir.join("diagram.puml");
    fs::write(&input, source).map_err(|error| error.to_string())?;
    let (svg, engine) = run_plantuml(&input)?;
    let _ = fs::remove_dir_all(&temp_dir);
    Ok(PlantUmlRenderOutput { svg, engine })
}

fn run_plantuml(input: &PathBuf) -> Result<(String, String), String> {
    if let Ok(path) = std::env::var("PLANTUML_BIN") {
        if !path.is_empty() {
            let output = Command::new(&path)
                .args(["-tsvg", &input.display().to_string()])
                .output()
                .map_err(|error| error.to_string())?;
            if output.status.success() {
                let svg = fs::read_to_string(input.with_extension("svg")).map_err(|e| e.to_string())?;
                return Ok((svg, path));
            }
        }
    }

    if let Ok(jar) = std::env::var("PLANTUML_JAR") {
        let output = Command::new("java")
            .args(["-jar", &jar, "-tsvg", &input.display().to_string()])
            .output()
            .map_err(|error| error.to_string())?;
        if output.status.success() {
            let svg = fs::read_to_string(input.with_extension("svg")).map_err(|e| e.to_string())?;
            return Ok((svg, "java-plantuml".into()));
        }
    }

    let output = Command::new("plantuml")
        .args(["-tsvg", &input.display().to_string()])
        .output()
        .map_err(|error| error.to_string())?;
    if !output.status.success() {
        return Err(format!(
            "PlantUML failed: {}",
            String::from_utf8_lossy(&output.stderr)
        ));
    }
    let svg = fs::read_to_string(input.with_extension("svg")).map_err(|e| e.to_string())?;
    Ok((svg, "plantuml".into()))
}

fn to_value<T: Serialize>(value: T) -> Result<Value, String> {
    serde_json::to_value(value).map_err(|error| error.to_string())
}

fn require_str(payload: &Value, key: &str) -> Result<String, String> {
    payload
        .get(key)
        .and_then(Value::as_str)
        .map(str::to_string)
        .ok_or_else(|| format!("missing or invalid string field: {key}"))
}

fn optional_str(payload: &Value, key: &str) -> Option<String> {
    payload.get(key).and_then(Value::as_str).map(str::to_string)
}

fn require_bool(payload: &Value, key: &str) -> Result<bool, String> {
    payload
        .get(key)
        .and_then(Value::as_bool)
        .ok_or_else(|| format!("missing or invalid bool field: {key}"))
}

fn optional_bool(payload: &Value, key: &str) -> Option<bool> {
    payload.get(key).and_then(Value::as_bool)
}

fn require_u32(payload: &Value, key: &str) -> Result<u32, String> {
    payload
        .get(key)
        .and_then(Value::as_u64)
        .and_then(|value| u32::try_from(value).ok())
        .ok_or_else(|| format!("missing or invalid u32 field: {key}"))
}

fn optional_u32(payload: &Value, key: &str) -> Option<u32> {
    payload
        .get(key)
        .and_then(Value::as_u64)
        .and_then(|value| u32::try_from(value).ok())
}

fn require_f64(payload: &Value, key: &str) -> Result<f64, String> {
    payload
        .get(key)
        .and_then(Value::as_f64)
        .ok_or_else(|| format!("missing or invalid f64 field: {key}"))
}

fn require_i64(payload: &Value, key: &str) -> Result<i64, String> {
    payload
        .get(key)
        .and_then(Value::as_i64)
        .ok_or_else(|| format!("missing or invalid i64 field: {key}"))
}

fn require_bytes(payload: &Value, key: &str) -> Result<Vec<u8>, String> {
    payload
        .get(key)
        .and_then(Value::as_array)
        .map(|array| {
            array
                .iter()
                .filter_map(|value| value.as_u64().map(|byte| byte as u8))
                .collect()
        })
        .ok_or_else(|| format!("missing or invalid bytes field: {key}"))
}

fn require_deserialize<T: serde::de::DeserializeOwned>(payload: &Value, key: &str) -> Result<T, String> {
    payload
        .get(key)
        .ok_or_else(|| format!("missing field: {key}"))
        .and_then(|value| serde_json::from_value(value.clone()).map_err(|error| error.to_string()))
}

fn optional_deserialize<T: serde::de::DeserializeOwned>(payload: &Value, key: &str) -> Option<T> {
    payload
        .get(key)
        .and_then(|value| serde_json::from_value(value.clone()).ok())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn list_commands_meets_minimum() {
        assert!(list_commands().len() >= 85);
    }

    #[test]
    fn dispatch_health_check_works() {
        let mut state = DaemonState::default();
        let result = dispatch(&mut state, "health_check", &json!({})).expect("health_check");
        assert_eq!(result, json!("ok"));
    }
}
