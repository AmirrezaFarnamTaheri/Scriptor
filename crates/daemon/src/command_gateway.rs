use std::fs;
use std::path::{Path, PathBuf};
use std::time::Duration;

use chrono::NaiveDate;
use scriptor_canvas_engine::{
    CanvasPoint, CanvasRect, SnapshotFormat, apply_template, apply_template_dry_run,
    document_to_json, hit_test, list_documents, list_templates, load_document, parse_document_json,
    query_blocks_in_bounds, render_svg, restore_template_checkpoint, save_document, write_snapshot,
};
use scriptor_export_runner::{
    ExportJobInput, ExportJobOutput, default_export_directory, discover_pandoc, run_export_job,
};
use scriptor_indexer::{
    InboxPeriod, ViewNoteHit, backlinks_for_path, evaluate_view_filter_json, execute_dql_query,
    health_diagnostics_json, health_report_json, incremental_note_index_with_cache,
    incremental_notes_index_with_cache, list_bibliography_entries, list_dead_end_notes,
    list_inbox_notes, list_note_summaries, list_orphan_notes, list_recent_files,
    list_unresolved_link_targets, list_vault_tags, list_view_notes, notes_for_tag,
    open_cache_for_session, parse_note_markdown, query_focused_graph, rebuild_index,
    record_recent_access, resolve_wikilink_target_with_aliases, search_notes, traverse_graph,
};
use scriptor_native_git::{
    git_commit_selected, git_pull, git_push, git_resolve_conflict, git_show_head_file, git_status,
    read_conflict_markers,
};
use scriptor_system_bridge::{NetworkPolicy, ProcessSpec, detect_system_info, run_process};
use scriptor_vault::{
    ActivityLogEntry, RULE_MISSING_HEADING, RULE_STALE_DEFINITIONS, RelativeVaultPath,
    SaveNoteOptions, StatsHistoryEntry, VaultConfig, VaultSnippet, WorkspaceSession,
    append_activity_log, append_stats_history, block_rename_apply, block_rename_dry_run,
    build_note_markdown, delete_note, export_text_bundle, lint_vault_fix, list_note_history,
    list_recent_notes, load_vault_config, load_vault_snippets, load_vault_template,
    plan_daily_note, read_activity_log, read_note, read_note_history_revision, read_stats_history,
    read_workspace_session, record_recent_note, rename_apply_staged, rename_dry_run,
    rollback_save_note, save_note, save_note_with_options, save_vault_config, save_vault_snippets,
    scan_vault, scan_vault_with_roots, section_rename_apply, section_rename_dry_run,
    set_frontmatter_field, tag_rename_apply, tag_rename_dry_run, write_workspace_session,
};
use serde::Serialize;
use serde_json::{Value, json};
use uuid::Uuid;

use crate::handler::DaemonState;

mod support;
use support::*;

mod catalog;
pub use catalog::{is_outside_lock_command, list_commands};

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
            let relative =
                RelativeVaultPath::parse(&relative_path).map_err(|error| error.to_string())?;
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
            to_value(
                scan_vault_with_roots(&session.root, &config.extra_roots)
                    .map_err(|e| e.to_string())?,
            )
        }
        "vault_read_note" => {
            let session = state.require_session()?;
            let path = require_str(payload, "path")?;
            let relative = RelativeVaultPath::parse(&path).map_err(|error| error.to_string())?;
            to_value(
                read_note(&session.descriptor.id, &session.root, &relative)
                    .map_err(|e| e.to_string())?,
            )
        }
        "vault_save_note" => {
            let path = require_str(payload, "path")?;
            let markdown = require_str(payload, "markdown")?;
            let expected_content_hash = optional_str(payload, "expected_content_hash");
            let dry_run = optional_bool(payload, "dry_run").unwrap_or(false);
            to_value(cmd_save_note(
                state,
                &path,
                &markdown,
                expected_content_hash.as_deref(),
                dry_run,
            )?)
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
            let output = lint_vault_fix(&session.descriptor.id, &session.root, &rules)
                .map_err(|e| e.to_string())?;
            if !output.fixed_paths.is_empty() {
                incremental_notes_index_with_cache(
                    session,
                    state.require_cache()?,
                    &output.fixed_paths,
                    &[],
                )
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
                load_vault_template(
                    session.root.root(),
                    &config.templates_directory,
                    &template_path,
                )
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
            let document = read_note(&session.descriptor.id, &session.root, &relative)
                .map_err(|e| e.to_string())?;
            let markdown = set_frontmatter_field(&document.markdown, &field, &value_str)
                .map_err(|e| e.to_string())?;
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
            let relative =
                RelativeVaultPath::parse(&note_path).map_err(|error| error.to_string())?;
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
                append_stats_history(&session.root, path, StatsHistoryEntry { date, words })
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
            Ok(json!(
                read_note_history_revision(&session.root, &path, &revision_id)
                    .map_err(|e| e.to_string())?
            ))
        }
        "vault_restore_note_history_revision" => {
            let session = state.require_session()?;
            let path = require_str(payload, "path")?;
            let revision_id = require_str(payload, "revisionId")?;
            let relative = RelativeVaultPath::parse(&path).map_err(|e| e.to_string())?;
            let markdown = read_note_history_revision(&session.root, &path, &revision_id)
                .map_err(|e| e.to_string())?;
            to_value(
                save_note_with_options(
                    &session.descriptor.id,
                    &session.root,
                    &relative,
                    &markdown,
                    None,
                    SaveNoteOptions { dry_run: false },
                )
                .map_err(|e| e.to_string())?,
            )
        }
        "vault_health" => {
            let session = state.require_session()?;
            let cache = state.require_cache()?;
            Ok(json!(
                health_report_json(cache, session).map_err(|e| e.to_string())?
            ))
        }
        "indexer_rebuild" => to_value(cmd_indexer_rebuild(state)?),
        "indexer_update_note" => {
            let path = require_str(payload, "path")?;
            incremental_note_index_with_cache(
                state.require_session()?,
                state.require_cache()?,
                &path,
                &[],
            )
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
            to_value(
                search_notes(cache, &session.descriptor.id, &query, limit)
                    .map_err(|e| e.to_string())?,
            )
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
            let period =
                InboxPeriod::parse(optional_str(payload, "period").as_deref().unwrap_or("all"));
            to_value(
                list_inbox_notes(cache, &session.descriptor.id, period)
                    .map_err(|e| e.to_string())?,
            )
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
            let document = read_note(&session.descriptor.id, &session.root, &relative)
                .map_err(|e| e.to_string())?;
            to_value(
                evaluate_view_filter_json(&filter_json, &document.metadata)
                    .map_err(|e| e.to_string())?,
            )
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
            Ok(json!(
                health_diagnostics_json(cache, session).map_err(|e| e.to_string())?
            ))
        }
        "export_discover" => to_value(discover_pandoc().map_err(|e| e.to_string())?),
        "export_run_note" | "export_run_markdown" => Err(format!(
            "command {command} must be dispatched outside the daemon state lock"
        )),
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
                git_commit_selected(session.root.root(), &files, &message)
                    .map_err(|e| e.to_string())?,
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
                git_resolve_conflict(session.root.root(), &path, &strategy)
                    .map_err(|e| e.to_string())?,
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
            let resolved = session
                .root
                .resolve_relative(&relative)
                .map_err(|error| error.to_string())?;
            let rel_str = resolved
                .strip_prefix(session.root.root())
                .unwrap_or(&resolved);
            to_value(
                git_show_head_file(session.root.root(), &rel_str.to_string_lossy())
                    .map_err(|e| e.to_string())?,
            )
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
            to_value(
                apply_template_dry_run(&document, &template_id)
                    .map_err(|error| error.to_string())?,
            )
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
            Ok(json!(
                document_to_json(&document).map_err(|error| error.to_string())?
            ))
        }
        "canvas_query_blocks" => {
            let scene_json = require_str(payload, "scene_json")?;
            let x = require_f64(payload, "x")?;
            let y = require_f64(payload, "y")?;
            let width = require_f64(payload, "width")?;
            let height = require_f64(payload, "height")?;
            let document = parse_document_json(&scene_json).map_err(|error| error.to_string())?;
            let bounds = CanvasRect {
                x,
                y,
                width,
                height,
            };
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
                write_snapshot(&document, Path::new(&output_path), snapshot_format, dry_run)
                    .map_err(|error| error.to_string())?,
            )
        }
        "canvas_save_document" => {
            let session = state.require_session()?;
            let scene_json = require_str(payload, "scene_json")?;
            let document = parse_document_json(&scene_json).map_err(|error| error.to_string())?;
            let path =
                save_document(session.root.root(), &document).map_err(|error| error.to_string())?;
            Ok(json!(path.display().to_string()))
        }
        "canvas_load_document" => {
            let session = state.require_session()?;
            let canvas_id = require_str(payload, "canvas_id")?;
            let document = load_document(session.root.root(), &canvas_id)
                .map_err(|error| error.to_string())?;
            Ok(json!(
                document_to_json(&document).map_err(|error| error.to_string())?
            ))
        }
        "canvas_list_documents" => {
            let session = state.require_session()?;
            to_value(list_documents(session.root.root()).map_err(|error| error.to_string())?)
        }
        other => Err(format!("unknown command: {other}")),
    }
}

pub fn prepare_export_run(
    state: &DaemonState,
    command: &str,
    payload: &Value,
) -> Result<ExportJobInput, String> {
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

pub fn run_export_command(
    state: &DaemonState,
    command: &str,
    payload: &Value,
) -> Result<ExportJobOutput, String> {
    let input = prepare_export_run(state, command, payload)?;
    run_export_job(input).map_err(|error| error.to_string())
}

pub fn rebuild_index_command(state: &DaemonState) -> Result<Value, String> {
    cmd_indexer_rebuild(state)
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

    #[test]
    fn require_bytes_accepts_valid_byte_array() {
        let payload = json!({ "data": [0, 1, 127, 255] });
        assert_eq!(require_bytes(&payload, "data"), Ok(vec![0, 1, 127, 255]));
    }

    #[test]
    fn require_bytes_rejects_out_of_range_and_non_integer_values() {
        assert!(require_bytes(&json!({ "data": [0, 256] }), "data").is_err());
        assert!(require_bytes(&json!({ "data": [1, -1] }), "data").is_err());
        assert!(require_bytes(&json!({ "data": [1, 1.5] }), "data").is_err());
        assert!(require_bytes(&json!({ "data": [1, "2"] }), "data").is_err());
        assert!(require_bytes(&json!({ "data": "abc" }), "data").is_err());
        assert!(require_bytes(&json!({}), "data").is_err());
    }
}
