//! Derived cache: parsing, incremental indexing, health reports, and citation validation.

pub mod bibliography;
pub mod citation;
pub mod citations;
pub mod db;
pub mod dql;
pub mod error;
pub mod graph;
pub mod hash;
pub mod health;
pub mod inbox;
pub mod knowledge;
pub mod links;
pub mod migration;
pub mod notes;
pub mod parse;
pub mod rebuild;
pub mod recent;
pub mod resolve;
pub mod schema;
pub mod search;
pub mod tags;
pub mod views;

pub use bibliography::{
    BibliographyEntry, default_bibliography_paths, list_bibliography_entries,
    sync_vault_bibliography,
};
pub use citation::{CitationValidationSummary, register_bibliography_keys, validate_citations};
pub use db::{IndexCache, default_cache_path};
pub use dql::{DqlResultRow, execute_dql_query};
pub use error::IndexerError;
pub use graph::{
    GraphEdge, GraphNode, GraphQueryOutput, GraphTraverseStep, MAX_GRAPH_DEPTH,
    apply_graph_group_color, query_focused_graph, traverse_graph,
};
pub use hash::{content_changed, content_hash};
pub use health::{
    CacheStatus, HealthIssue, VaultHealthDiagnostics, VaultHealthReport, build_health_diagnostics,
    build_health_report, health_diagnostics_json, health_report_json,
};
pub use inbox::{
    InboxPeriod, NoteIndexSummary, is_inbox_candidate, list_inbox_notes, list_note_summaries,
};
pub use knowledge::{
    KnowledgeNoteSummary, UnresolvedLinkTarget, list_dead_end_notes, list_orphan_notes,
    list_unresolved_link_targets,
};
pub use links::{
    BacklinkHit, backlinks_for_path, count_links, replace_note_links, resolve_link_targets,
};
pub use migration::migrate_cache;
pub use parse::{ParsedCitation, ParsedLink, ParsedLinkKind, ParsedNote, parse_note_markdown};
pub use rebuild::{
    IncrementalIndexSummary, RebuildProgressReport, RebuildStatus, RebuildSummary,
    incremental_note_index, incremental_note_index_with_cache, incremental_notes_index,
    incremental_notes_index_with_cache, open_cache_for_session, rebuild_index,
    rebuild_index_with_progress,
};
pub use recent::{RecentFileHit, list_recent_files, record_recent_access};
pub use resolve::{
    WikilinkResolution, WikilinkResolutionKind, resolve_wikilink_target,
    resolve_wikilink_target_with_aliases,
};
pub use search::{SearchHit, build_fts_query, search_notes};
pub use tags::{TagSummary, TaggedNote, list_vault_tags, notes_for_tag};
pub use views::{
    ViewNoteHit, evaluate_view_filter_json, list_view_notes, note_metadata_matches_view,
};
