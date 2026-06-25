//! Vault kernel: path safety, scanning, note IO, atomic writes, and rename transactions.

pub mod config;
pub mod delete;
pub mod diagnostics;
pub mod error;
pub mod frontmatter_ops;
pub mod hash;
pub mod lint;
pub mod link_rewrite;
pub mod note;
pub mod open;
pub mod patch_log;
pub mod path;
pub mod recent;
pub mod rename;
pub mod rename_transaction;
pub mod scan;
pub mod views;
pub mod section_rename;
pub mod snippets;
pub mod tag_rename;
pub mod stats_history;
pub mod textbundle;
pub mod watch;
pub mod write;

pub use config::{
    load_vault_config, load_vault_template, plan_daily_note, preview_daily_tokens, save_vault_config,
    build_note_markdown, DailyNotePlan, ExportOnSaveConfig, GraphGroupRule,
    VaultConfig, WritingTargetsConfig,
};
pub use error::VaultError;
pub use delete::{delete_note, DeleteNoteOutput};
pub use hash::{content_hash, reading_time_minutes, word_count};
pub use note::{metadata_from_markdown, note_id, read_note, NoteDocument, NoteMetadata};
pub use open::{open_vault, open_vault_output, OpenVaultOutput, VaultDescriptor, VaultSession, VaultStatus};
pub use path::{RelativeVaultPath, VaultRoot};
pub use lint::{
    format_lint_text, lint_vault, lint_vault_fix, normalize_rule_filter, LintApplyOutput, LintFileResult,
    LintIssue, LintReport, RULE_MISSING_HEADING, RULE_STALE_DEFINITIONS,
};
pub use frontmatter_ops::{
    delete_frontmatter_field, get_frontmatter_field, set_frontmatter_field, FrontmatterFieldOutput,
};
pub use rename::{
    rename_apply, rename_dry_run, unresolved_link_targets, RenameNoteApplyOutput, RenameNoteDryRunOutput,
};
pub use rename_transaction::{
    recover_pending_rename_transactions, RenameTransactionManifest, StagedRenameTransaction,
};
pub use views::{
    evaluate_view_filter, ViewFilter, ViewFilterCondition, ViewFilterNode, ViewFilterOp, ViewNoteMetadata,
};
pub use section_rename::{
    block_rename_apply, block_rename_dry_run, section_rename_apply, section_rename_dry_run,
};
pub use tag_rename::{tag_rename_apply, tag_rename_dry_run};
pub use scan::{list_notes, scan_vault, scan_vault_with_roots, ScannedEntry, ScannedEntryKind};
pub use snippets::{load_vault_snippets, save_vault_snippets, VaultSnippet, DEFAULT_SNIPPETS_PATH};
pub use watch::{VaultWatchEvent, VaultWatcher};
pub use link_rewrite::{
    directory_identifier_for_path, is_directory_index_path, rewrite_note_rename_links, LinkRewriteApplyOutput,
    LinkRewritePreview, RenameLinkTarget,
};
pub use textbundle::{
    export_text_bundle, export_text_bundle_for_vault, import_text_bundle, TextBundleExportOutput,
    TextBundleImportOutput,
};
pub use patch_log::{collect_rename_backups, write_rename_patch_log, RenamePatchLog};
pub use recent::{list_recent_notes, record_recent_note, RecentNoteEntry};
pub use diagnostics::{redact_json_value, redact_sensitive_text};
pub use stats_history::{
    append_stats_history, read_stats_history, StatsHistoryEntry, DEFAULT_STATS_HISTORY_PATH,
};
pub use write::{save_note, save_note_with_options, SaveNoteOptions, SaveNoteOutput};
