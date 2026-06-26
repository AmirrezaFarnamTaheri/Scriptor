use scriptor_indexer::{
    backlinks_for_path, evaluate_view_filter_json, execute_dql_query, health_diagnostics_json,
    incremental_note_index, incremental_notes_index, list_bibliography_entries, list_dead_end_notes,
    list_inbox_notes, list_note_summaries, list_orphan_notes, list_recent_files, list_unresolved_link_targets,
    list_vault_tags, notes_for_tag, open_cache_for_session, parse_note_markdown, query_focused_graph,
    rebuild_index, record_recent_access, resolve_wikilink_target_with_aliases, search_notes, traverse_graph,
    BacklinkHit, BibliographyEntry, DqlResultRow, GraphQueryOutput, GraphTraverseStep, IncrementalIndexSummary,
    KnowledgeNoteSummary, NoteIndexSummary, RecentFileHit, RebuildSummary, SearchHit, TagSummary, TaggedNote,
    UnresolvedLinkTarget, WikilinkResolution,
};
use scriptor_vault::{load_vault_config, read_note, scan_vault, RelativeVaultPath};

use crate::AppState;
use crate::state::{active_session, use_headless_engine};

use super::daemon::{
    bridge_backlinks, bridge_graph, bridge_health_diagnostics, bridge_list_note_summaries,
    bridge_rebuild_index, bridge_search, bridge_update_note_index,
};
use super::shared::parse_daemon_json;

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
pub fn indexer_backlinks(state: tauri::State<AppState>, path: String) -> Result<Vec<BacklinkHit>, String> {
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
    if use_headless_engine(&state) {
        let json = bridge_graph(focus_path, depth.unwrap_or(1))?;
        return parse_daemon_json(&json);
    }
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

#[tauri::command]
pub fn indexer_execute_dql(state: tauri::State<AppState>, query: String) -> Result<Vec<DqlResultRow>, String> {
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
    let session = active_session(&state)?;
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
pub fn indexer_notes_for_tag(state: tauri::State<AppState>, tag: String) -> Result<Vec<TaggedNote>, String> {
    let session = active_session(&state)?;
    let cache = open_cache_for_session(&session).map_err(|error| error.to_string())?;
    notes_for_tag(&cache, &session.descriptor.id, &tag).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn indexer_list_note_summaries(state: tauri::State<AppState>) -> Result<Vec<NoteIndexSummary>, String> {
    if use_headless_engine(&state) {
        let json = bridge_list_note_summaries()?;
        return parse_daemon_json(&json);
    }
    let session = active_session(&state)?;
    let cache = open_cache_for_session(&session).map_err(|error| error.to_string())?;
    list_note_summaries(&cache, &session.descriptor.id).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn indexer_list_inbox(state: tauri::State<AppState>, period: Option<String>) -> Result<Vec<NoteIndexSummary>, String> {
    let session = active_session(&state)?;
    let cache = open_cache_for_session(&session).map_err(|error| error.to_string())?;
    let period = scriptor_indexer::InboxPeriod::parse(period.as_deref().unwrap_or("all"));
    list_inbox_notes(&cache, &session.descriptor.id, period).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn indexer_list_bibliography(state: tauri::State<AppState>) -> Result<Vec<BibliographyEntry>, String> {
    let session = active_session(&state)?;
    let cache = open_cache_for_session(&session).map_err(|error| error.to_string())?;
    list_bibliography_entries(&cache).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn indexer_resolve_wikilink(state: tauri::State<AppState>, target: String) -> Result<WikilinkResolution, String> {
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
pub fn indexer_record_recent_access(state: tauri::State<AppState>, path: String) -> Result<(), String> {
    let session = active_session(&state)?;
    let cache = open_cache_for_session(&session).map_err(|error| error.to_string())?;
    record_recent_access(&cache, &path).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn indexer_list_orphans(state: tauri::State<AppState>) -> Result<Vec<KnowledgeNoteSummary>, String> {
    let session = active_session(&state)?;
    let cache = open_cache_for_session(&session).map_err(|error| error.to_string())?;
    list_orphan_notes(&cache, &session).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn indexer_list_dead_ends(state: tauri::State<AppState>) -> Result<Vec<KnowledgeNoteSummary>, String> {
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
    let document = read_note(&session.descriptor.id, &session.root, &relative).map_err(|error| error.to_string())?;
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
