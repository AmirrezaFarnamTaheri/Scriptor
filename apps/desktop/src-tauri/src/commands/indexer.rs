use scriptor_indexer::{
    BacklinkHit, BibliographyEntry, DqlResultRow, GraphQueryOutput, GraphTraverseStep,
    IncrementalIndexSummary, KnowledgeNoteSummary, NoteIndexSummary, RebuildSummary, RecentFileHit,
    SearchHit, TagSummary, TaggedNote, TaskFilter, TaskRow, UnresolvedLinkTarget,
    WikilinkResolution, backlinks_for_path, evaluate_view_filter_json, execute_dql_query,
    health_diagnostics_json, incremental_note_index, incremental_notes_index,
    list_bibliography_entries, list_dead_end_notes, list_inbox_notes, list_note_summaries,
    list_orphan_notes, list_recent_files, list_unresolved_link_targets, list_vault_tags,
    load_note_metadata, move_card_in_markdown, note_paths_and_aliases, notes_for_tag,
    open_cache_for_session, parse_kanban, query_focused_graph, query_tasks, rebuild_index,
    record_recent_access, resolve_wikilink_target_with_aliases, rewrite_task_markdown,
    search_notes, sync_note_tasks_from_markdown, task_by_id, traverse_graph,
};
use scriptor_vault::{
    RelativeVaultPath, SaveNoteOptions, load_vault_config, read_note, save_note_with_options,
};

use crate::AppState;
use crate::state::{ActiveSession, active_session, use_headless_engine};

use super::daemon::{
    bridge_backlinks, bridge_graph, bridge_health_diagnostics, bridge_list_note_summaries,
    bridge_rebuild_index, bridge_search, bridge_update_note_index,
};
use super::shared::parse_daemon_json;

fn require_graph_capability<'a>(
    state: &'a tauri::State<'a, AppState>,
) -> Result<ActiveSession<'a>, String> {
    let session = active_session(state)?;
    let plugin_state = scriptor_vault::load_plugin_state(session.root.root())
        .map_err(|error| error.to_string())?;
    if plugin_state.is_enabled("scriptor.graph") {
        Ok(session)
    } else {
        Err("Plugin capability 'scriptor.graph' is disabled in active vault".into())
    }
}

#[tauri::command]
pub fn indexer_rebuild(state: tauri::State<AppState>) -> Result<RebuildSummary, String> {
    if use_headless_engine(&state) {
        let json = bridge_rebuild_index()?;
        return parse_daemon_json(&json);
    }
    let session = active_session(&state)?;
    rebuild_index(&session, &[]).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn indexer_update_note(state: tauri::State<AppState>, path: String) -> Result<bool, String> {
    if use_headless_engine(&state) {
        return bridge_update_note_index(path);
    }
    let session = active_session(&state)?;
    incremental_note_index(&session, &path, &[]).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn indexer_apply_filesystem_changes(
    state: tauri::State<AppState>,
    paths: Vec<String>,
) -> Result<IncrementalIndexSummary, String> {
    let session = active_session(&state)?;
    incremental_notes_index(&session, &paths, &[]).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn indexer_search(
    state: tauri::State<AppState>,
    query: String,
    limit: Option<u32>,
) -> Result<Vec<SearchHit>, String> {
    if use_headless_engine(&state) {
        let json = bridge_search(query, limit.unwrap_or(25))?;
        return parse_daemon_json(&json);
    }
    let session = active_session(&state)?;
    let cache = open_cache_for_session(&session).map_err(|error| error.to_string())?;
    search_notes(&cache, &session.descriptor.id, &query, limit.unwrap_or(25))
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn indexer_backlinks(
    state: tauri::State<AppState>,
    path: String,
) -> Result<Vec<BacklinkHit>, String> {
    if use_headless_engine(&state) {
        let json = bridge_backlinks(path)?;
        return parse_daemon_json(&json);
    }
    let session = active_session(&state)?;
    let cache = open_cache_for_session(&session).map_err(|error| error.to_string())?;
    backlinks_for_path(&cache, &session, &path).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn indexer_graph(
    state: tauri::State<AppState>,
    focus_path: Option<String>,
    depth: Option<u32>,
) -> Result<GraphQueryOutput, String> {
    let session = require_graph_capability(&state)?;
    if use_headless_engine(&state) {
        let json = bridge_graph(focus_path, depth.unwrap_or(1))?;
        return parse_daemon_json(&json);
    }
    let cache = open_cache_for_session(&session).map_err(|error| error.to_string())?;
    let config = load_vault_config(session.root.root()).map_err(|error| error.to_string())?;
    query_focused_graph(
        &cache,
        &session,
        focus_path.as_deref(),
        depth.unwrap_or(1),
        &config.graph_groups,
    )
    .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn indexer_execute_dql(
    state: tauri::State<AppState>,
    query: String,
) -> Result<Vec<DqlResultRow>, String> {
    let session = active_session(&state)?;
    let cache = open_cache_for_session(&session).map_err(|error| error.to_string())?;
    execute_dql_query(&cache, &session, &query).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn indexer_traverse_graph(
    state: tauri::State<AppState>,
    focus_path: String,
    depth: u32,
) -> Result<Vec<GraphTraverseStep>, String> {
    let session = require_graph_capability(&state)?;
    let cache = open_cache_for_session(&session).map_err(|error| error.to_string())?;
    traverse_graph(&cache, &session, &focus_path, depth).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn indexer_health_diagnostics(state: tauri::State<AppState>) -> Result<String, String> {
    if use_headless_engine(&state) {
        return bridge_health_diagnostics();
    }
    let session = active_session(&state)?;
    let cache = open_cache_for_session(&session).map_err(|error| error.to_string())?;
    health_diagnostics_json(&cache, &session).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn indexer_list_tags(state: tauri::State<AppState>) -> Result<Vec<TagSummary>, String> {
    let session = active_session(&state)?;
    let cache = open_cache_for_session(&session).map_err(|error| error.to_string())?;
    list_vault_tags(&cache, &session.descriptor.id).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn indexer_notes_for_tag(
    state: tauri::State<AppState>,
    tag: String,
) -> Result<Vec<TaggedNote>, String> {
    let session = active_session(&state)?;
    let cache = open_cache_for_session(&session).map_err(|error| error.to_string())?;
    notes_for_tag(&cache, &session.descriptor.id, &tag).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn indexer_list_note_summaries(
    state: tauri::State<AppState>,
) -> Result<Vec<NoteIndexSummary>, String> {
    if use_headless_engine(&state) {
        let json = bridge_list_note_summaries()?;
        return parse_daemon_json(&json);
    }
    let session = active_session(&state)?;
    let cache = open_cache_for_session(&session).map_err(|error| error.to_string())?;
    list_note_summaries(&cache, &session.descriptor.id).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn indexer_list_inbox(
    state: tauri::State<AppState>,
    period: Option<String>,
) -> Result<Vec<NoteIndexSummary>, String> {
    let session = active_session(&state)?;
    let cache = open_cache_for_session(&session).map_err(|error| error.to_string())?;
    let period = scriptor_indexer::InboxPeriod::parse(period.as_deref().unwrap_or("all"));
    list_inbox_notes(&cache, &session.descriptor.id, period).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn indexer_list_bibliography(
    state: tauri::State<AppState>,
) -> Result<Vec<BibliographyEntry>, String> {
    let session = active_session(&state)?;
    let cache = open_cache_for_session(&session).map_err(|error| error.to_string())?;
    list_bibliography_entries(&cache).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn indexer_resolve_wikilink(
    state: tauri::State<AppState>,
    target: String,
) -> Result<WikilinkResolution, String> {
    let session = active_session(&state)?;
    // SQLite fast path: aliases_json is maintained by the indexer (v9+), so
    // resolution is one indexed query instead of an O(n) disk scan.
    let cache = open_cache_for_session(&session).map_err(|error| error.to_string())?;
    let (note_paths, aliases_by_path) = note_paths_and_aliases(&cache, &session.descriptor.id)
        .map_err(|error| error.to_string())?;
    Ok(resolve_wikilink_target_with_aliases(
        &note_paths,
        &aliases_by_path,
        &target,
    ))
}

#[tauri::command]
pub fn indexer_list_recent_files(
    state: tauri::State<AppState>,
    limit: Option<u32>,
) -> Result<Vec<RecentFileHit>, String> {
    let session = active_session(&state)?;
    let cache = open_cache_for_session(&session).map_err(|error| error.to_string())?;
    list_recent_files(&cache, limit.unwrap_or(20)).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn indexer_record_recent_access(
    state: tauri::State<AppState>,
    path: String,
) -> Result<(), String> {
    let session = active_session(&state)?;
    let cache = open_cache_for_session(&session).map_err(|error| error.to_string())?;
    record_recent_access(&cache, &path).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn indexer_list_orphans(
    state: tauri::State<AppState>,
) -> Result<Vec<KnowledgeNoteSummary>, String> {
    let session = active_session(&state)?;
    let cache = open_cache_for_session(&session).map_err(|error| error.to_string())?;
    list_orphan_notes(&cache, &session).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn indexer_list_dead_ends(
    state: tauri::State<AppState>,
) -> Result<Vec<KnowledgeNoteSummary>, String> {
    let session = active_session(&state)?;
    let cache = open_cache_for_session(&session).map_err(|error| error.to_string())?;
    list_dead_end_notes(&cache, &session).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn indexer_evaluate_view(
    state: tauri::State<AppState>,
    filter_json: String,
    path: String,
) -> Result<bool, String> {
    let session = active_session(&state)?;
    let relative = RelativeVaultPath::parse(&path).map_err(|error| error.to_string())?;
    let document = read_note(&session.descriptor.id, &session.root, &relative)
        .map_err(|error| error.to_string())?;
    evaluate_view_filter_json(&filter_json, &document.metadata).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn indexer_list_unresolved_targets(
    state: tauri::State<AppState>,
) -> Result<Vec<UnresolvedLinkTarget>, String> {
    let session = active_session(&state)?;
    let cache = open_cache_for_session(&session).map_err(|error| error.to_string())?;
    list_unresolved_link_targets(&cache, &session).map_err(|error| error.to_string())
}

#[derive(serde::Serialize)]
pub struct NoteMetaHit {
    pub path: String,
    pub title: Option<String>,
    pub modified_at: Option<String>,
    pub exists: bool,
}

/// Resolve lightweight metadata (title, modification time, existence) for a
/// batch of vault-relative note paths. Read-only; unknown or unreadable paths
/// are reported as non-existent rather than failing the whole batch.
#[tauri::command]
pub fn indexer_batch_note_meta(
    state: tauri::State<AppState>,
    paths: Vec<String>,
) -> Result<Vec<NoteMetaHit>, String> {
    let session = active_session(&state)?;
    let hits = paths
        .into_iter()
        .map(|path| match RelativeVaultPath::parse(&path) {
            Ok(relative) => match read_note(&session.descriptor.id, &session.root, &relative) {
                Ok(document) => NoteMetaHit {
                    path,
                    title: Some(document.metadata.title),
                    modified_at: Some(document.metadata.modified_at),
                    exists: true,
                },
                Err(_) => NoteMetaHit {
                    path,
                    title: None,
                    modified_at: None,
                    exists: false,
                },
            },
            Err(_) => NoteMetaHit {
                path,
                title: None,
                modified_at: None,
                exists: false,
            },
        })
        .collect();
    Ok(hits)
}

// ── W4: Task commands ─────────────────────────────────────────────────────────

/// Query tasks from the vault's SQLite cache with optional filter parameters.
///
/// All filter fields are optional; pass `null` to omit.  `limit` caps the
/// number of rows returned (default 200).
#[tauri::command]
pub fn indexer_query_tasks(
    state: tauri::State<AppState>,
    status: Option<String>,
    tag: Option<String>,
    due_before: Option<String>,
    due_after: Option<String>,
    limit: Option<u32>,
) -> Result<Vec<TaskRow>, String> {
    let session = active_session(&state)?;
    let cache = open_cache_for_session(&session).map_err(|e| e.to_string())?;
    let filter = TaskFilter {
        status,
        tag,
        due_before,
        due_after,
    };
    query_tasks(
        &cache,
        &session.descriptor.id,
        &filter,
        limit.unwrap_or(200),
    )
    .map_err(|e| e.to_string())
}

/// Patch the `status` and/or `due_at` of a task identified by its stable ID.
///
/// After the index update, the source note is NOT rewritten here — that is
/// handled by a follow-up `indexer_sync_note_tasks` call triggered by the
/// frontend (or a direct vault-save).  This keeps the Tauri command boundary
/// thin and avoids race conditions with the editor.
#[tauri::command]
pub fn indexer_update_task(
    state: tauri::State<AppState>,
    task_id: String,
    status: Option<String>,
    due_at: Option<Option<String>>,
) -> Result<(), String> {
    if status.is_none() && due_at.is_none() {
        return Err("task update requires a status and/or due-date patch".to_string());
    }
    let session = active_session(&state)?;
    let cache = open_cache_for_session(&session).map_err(|e| e.to_string())?;
    let task = task_by_id(&cache, &task_id)
        .map_err(|e| e.to_string())?
        .ok_or_else(|| format!("unknown task id: {task_id}"))?;
    let note_path = task
        .source_note_id
        .clone()
        .ok_or_else(|| format!("task {} has no source note", task.id))?;
    let relative = RelativeVaultPath::parse(&note_path).map_err(|e| e.to_string())?;
    let document =
        read_note(&session.descriptor.id, &session.root, &relative).map_err(|e| e.to_string())?;
    ensure_note_matches_index_hash(
        &cache,
        &session.descriptor.id,
        &note_path,
        &document.markdown,
    )?;

    let rewritten = rewrite_task_markdown(
        &document.markdown,
        &task,
        status.as_deref(),
        due_at.as_ref().map(|value| value.as_deref()),
    )
    .map_err(|e| e.to_string())?;
    save_note_with_options(
        &session.descriptor.id,
        &session.root,
        &relative,
        &rewritten,
        Some(&document.metadata.content_hash),
        SaveNoteOptions { dry_run: false },
    )
    .map_err(|e| e.to_string())?;
    incremental_note_index(&session, &note_path, &[]).map_err(|e| e.to_string())?;
    Ok(())
}

/// Re-sync tasks for a single note path. Call this after any note save that
/// may have changed task checkboxes.
#[tauri::command]
pub fn indexer_sync_note_tasks(
    state: tauri::State<AppState>,
    note_path: String,
) -> Result<(), String> {
    let session = active_session(&state)?;
    let cache = open_cache_for_session(&session).map_err(|e| e.to_string())?;
    let relative = RelativeVaultPath::parse(&note_path).map_err(|e| e.to_string())?;
    let document =
        read_note(&session.descriptor.id, &session.root, &relative).map_err(|e| e.to_string())?;
    sync_note_tasks_from_markdown(
        &cache,
        &session.descriptor.id,
        &note_path,
        &document.markdown,
    )
    .map_err(|e| e.to_string())
}

/// Parse and return the kanban board for a vault-relative note path.
///
/// Returns `null` when the file does not carry the `kanban-plugin:` frontmatter
/// key, so the frontend can gracefully fall back.
#[tauri::command]
pub fn indexer_kanban_board(
    state: tauri::State<AppState>,
    note_path: String,
) -> Result<Option<scriptor_indexer::KanbanBoard>, String> {
    let session = active_session(&state)?;
    let relative = RelativeVaultPath::parse(&note_path).map_err(|e| e.to_string())?;
    let document =
        read_note(&session.descriptor.id, &session.root, &relative).map_err(|e| e.to_string())?;
    Ok(parse_kanban(&note_path, &document.markdown))
}

/// Move a kanban card to a different column by relocating the full card line.
///
/// `line` is the 0-based line index in the source file (as returned by
/// `indexer_kanban_board`). `to_column` selects the destination `## Heading`,
/// and `new_status` is the checkbox fill that should be written there.
#[tauri::command]
pub fn indexer_kanban_move_card(
    state: tauri::State<AppState>,
    note_path: String,
    line: usize,
    to_column: String,
    new_status: String,
) -> Result<(), String> {
    let status_char = if new_status.chars().count() == 1 {
        new_status.chars().next().unwrap()
    } else {
        return Err(format!(
            "invalid kanban status {:?}: must be a single character",
            new_status
        ));
    };

    let session = active_session(&state)?;
    let cache = open_cache_for_session(&session).map_err(|e| e.to_string())?;
    let relative = RelativeVaultPath::parse(&note_path).map_err(|e| e.to_string())?;
    let document =
        read_note(&session.descriptor.id, &session.root, &relative).map_err(|e| e.to_string())?;
    ensure_note_matches_index_hash(
        &cache,
        &session.descriptor.id,
        &note_path,
        &document.markdown,
    )?;
    let new_markdown = move_card_in_markdown(&document.markdown, line, &to_column, status_char)
        .map_err(|e| e.to_string())?;

    save_note_with_options(
        &session.descriptor.id,
        &session.root,
        &relative,
        &new_markdown,
        Some(&document.metadata.content_hash),
        SaveNoteOptions { dry_run: false },
    )
    .map_err(|e| e.to_string())?;
    incremental_note_index(&session, &note_path, &[]).map_err(|e| e.to_string())?;

    Ok(())
}

fn ensure_note_matches_index_hash(
    cache: &scriptor_indexer::IndexCache,
    vault_id: &str,
    note_path: &str,
    markdown: &str,
) -> Result<(), String> {
    let indexed = load_note_metadata(cache, vault_id, note_path)
        .map_err(|e| e.to_string())?
        .ok_or_else(|| {
            format!("note {note_path} is not indexed; save or rebuild the index first")
        })?;
    let current_hash = scriptor_indexer::content_hash(markdown);
    if indexed.content_hash != current_hash {
        return Err(format!(
            "note {note_path} is stale; save or rebuild the index before mutating tasks or kanban cards"
        ));
    }
    Ok(())
}
