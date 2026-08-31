//! Vault kernel: path safety, scanning, note IO, atomic writes, and rename transactions.

pub mod activity_log;
pub mod config;
pub mod crypto;
pub mod delete;
pub mod diagnostics;
pub mod encryption;
pub mod error;
pub mod frontmatter_ops;
pub mod fs;
pub mod hash;
pub mod importers;
pub mod inline_encrypt;
pub mod key_session;
pub mod link_rewrite;
pub mod lint;
pub mod mcp_audit;
pub mod note;
pub mod note_history;
pub mod open;
pub mod patch_log;
pub mod path;
pub mod permissions;
pub mod plugin_state;
pub mod recent;
pub mod rename;
pub mod rename_transaction;
pub mod scan;
pub mod section_rename;
pub mod snippets;
pub mod stats_history;
pub mod tag_rename;
pub(crate) mod text;
pub mod textbundle;
pub mod views;
pub mod watch;
pub mod wikilink;
pub mod workspace_session;
pub mod write;

pub use importers::obsidian::{
    ImportObsidianOptions, ImportResult, detect_obsidian_vault, import_obsidian_vault,
};

pub use activity_log::{
    ActivityLogEntry, DEFAULT_ACTIVITY_LOG_PATH, append_activity_log, read_activity_log,
};
pub use config::{
    AccessibilityConfig, AutosuggestConfig, CalendarSyncConfig, CustomCallout, DailyNotePlan,
    ExportOnSaveConfig, FeaturesConfig, GraphGroupRule, LatexConfig, ReadingListConfig, SavedView,
    SemanticConfig, TrustedBinaries, VaultConfig, WritingTargetsConfig, build_note_markdown,
    load_vault_config, load_vault_template, plan_daily_note, preview_daily_tokens,
    save_vault_config,
};
pub use crypto::{
    EnvelopeHeader, decrypt, decrypt_with_passphrase, encrypt, encrypt_with_passphrase,
};
pub use delete::{DeleteNoteOutput, delete_note};
pub use diagnostics::{redact_json_value, redact_sensitive_text};
pub use error::VaultError;

pub use frontmatter_ops::{
    FrontmatterFieldOutput, delete_frontmatter_field, get_frontmatter_field, set_frontmatter_field,
};
pub use fs::{atomic_write, write_conflicted_sidecar};
pub use hash::{content_hash, content_hash_bytes, reading_time_minutes, word_count};
pub use link_rewrite::{
    LinkRewriteApplyOutput, LinkRewritePreview, RenameLinkTarget, directory_identifier_for_path,
    is_directory_index_path, rewrite_note_rename_links,
};
pub use lint::{
    LintApplyOutput, LintFileResult, LintIssue, LintReport, RULE_MISSING_HEADING,
    RULE_STALE_DEFINITIONS, format_lint_text, lint_vault, lint_vault_fix, normalize_rule_filter,
};
pub use mcp_audit::{
    DEFAULT_MCP_AUDIT_MAX_BYTES, DEFAULT_MCP_AUDIT_PATH, DEFAULT_MCP_AUDIT_SEGMENTS,
    McpMutationAuditRecord, append_mcp_mutation, read_mcp_audit_tail,
    reconcile_pending_mcp_mutations,
};
pub use note::{NoteDocument, NoteMetadata, metadata_from_markdown, note_id, read_note};
pub use note_history::{
    DEFAULT_NOTE_HISTORY_DIR, MAX_REVISIONS_PER_NOTE, NoteHistoryEntry, append_note_history,
    list_note_history, read_note_history_revision, restore_note_history_revision,
};
pub use open::{
    OpenVaultOutput, VaultDescriptor, VaultSession, VaultStatus, open_vault, open_vault_output,
};
pub use patch_log::{RenamePatchLog, collect_rename_backups, write_rename_patch_log};
pub use path::{RelativeVaultPath, VaultRoot};
pub use permissions::{
    PermissionContext, PermissionError, PermissionOutcome, SCRIPTOR_URI_READONLY_COMMANDS,
    SensitiveOperation, check_permission,
};
pub use plugin_state::{
    PLUGIN_STATE_FILE, PLUGIN_STATE_SCHEMA_VERSION, PluginState, load_plugin_state,
    plugin_state_path, save_plugin_state,
};
pub use recent::{RecentNoteEntry, list_recent_notes, record_recent_note};
pub use rename::{
    RenameNoteApplyOutput, RenameNoteDryRunOutput, rename_apply, rename_apply_staged,
    rename_dry_run, unresolved_link_targets,
};
pub use rename_transaction::{
    RenamePhase, RenameRecoveryOutcome, RenameTransactionManifest, StagedRenameTransaction,
    recover_pending_rename_transactions,
};
pub use scan::{
    MAX_INDEXED_NOTE_BYTES, MAX_SCAN_ENTRIES, ScannedEntry, ScannedEntryKind, list_notes,
    scan_vault, scan_vault_for_index, scan_vault_with_roots, scan_vault_with_roots_for_index,
};
pub use section_rename::{
    block_rename_apply, block_rename_dry_run, section_rename_apply, section_rename_dry_run,
};
pub use snippets::{DEFAULT_SNIPPETS_PATH, VaultSnippet, load_vault_snippets, save_vault_snippets};
pub use stats_history::{
    DEFAULT_STATS_HISTORY_PATH, StatsHistoryEntry, append_stats_history, read_stats_history,
};
pub use tag_rename::{tag_rename_apply, tag_rename_dry_run};
pub use textbundle::{
    TextBundleExportOutput, TextBundleImportOutput, export_text_bundle,
    export_text_bundle_for_vault, import_text_bundle,
};
pub use views::{
    ViewFilter, ViewFilterCondition, ViewFilterNode, ViewFilterOp, ViewNoteMetadata,
    evaluate_view_filter,
};
pub use watch::{VaultWatchBatch, VaultWatchEvent, VaultWatcher};
pub use workspace_session::{
    DEFAULT_WORKSPACE_SESSION_PATH, WorkspaceSession, WorkspaceSessionTab, read_workspace_session,
    write_workspace_session,
};
pub use write::{
    SaveNoteOptions, SaveNoteOutput, rollback_save_note, save_note, save_note_with_options,
};

pub use wikilink::{
    WikilinkIndex, WikilinkResolution, WikilinkResolutionKind, resolve_wikilink_target,
    resolve_wikilink_target_with_aliases,
};
