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
pub mod links;
pub mod migration;
pub mod notes;
pub mod parse;
pub mod inbox;
pub mod knowledge;
pub mod recent;
pub mod rebuild;
pub mod resolve;
pub mod schema;
pub mod search;
pub mod tags;
pub mod views;

pub use bibliography::{
    default_bibliography_paths, list_bibliography_entries, sync_vault_bibliography, BibliographyEntry,
};
pub use citation::{register_bibliography_keys, validate_citations, CitationValidationSummary};
pub use db::{default_cache_path, IndexCache};
pub use error::IndexerError;
pub use hash::{content_changed, content_hash};
pub use health::{
    build_health_diagnostics, build_health_report, health_diagnostics_json, health_report_json, CacheStatus,
    HealthIssue, VaultHealthDiagnostics, VaultHealthReport,
};
pub use links::{backlinks_for_path, count_links, replace_note_links, BacklinkHit};
pub use parse::{parse_note_markdown, ParsedCitation, ParsedLink, ParsedLinkKind, ParsedNote};
pub use rebuild::{
    incremental_note_index, incremental_notes_index, open_cache_for_session, rebuild_index, IncrementalIndexSummary,
    RebuildSummary,
};
pub use dql::{execute_dql_query, DqlResultRow};
pub use graph::{
    apply_graph_group_color, query_focused_graph, traverse_graph, GraphEdge, GraphNode, GraphQueryOutput,
    GraphTraverseStep,
};
pub use search::{build_fts_query, search_notes, SearchHit};
pub use inbox::{is_inbox_candidate, list_inbox_notes, list_note_summaries, InboxPeriod, NoteIndexSummary};
pub use knowledge::{
    list_dead_end_notes, list_orphan_notes, list_unresolved_link_targets, KnowledgeNoteSummary,
    UnresolvedLinkTarget,
};
pub use recent::{list_recent_files, record_recent_access, RecentFileHit};
pub use migration::migrate_cache;
pub use resolve::{
    resolve_wikilink_target, resolve_wikilink_target_with_aliases, WikilinkResolution, WikilinkResolutionKind,
};
pub use tags::{list_vault_tags, notes_for_tag, TagSummary, TaggedNote};
pub use views::{evaluate_view_filter_json, list_view_notes, note_metadata_matches_view, ViewNoteHit};
