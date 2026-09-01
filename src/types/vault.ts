export interface VaultDescriptor {
  id: string
  name: string
  root_path: string
  opened_at: string
  status: 'ready' | 'scanning' | 'degraded'
}

export interface OpenVaultOutput {
  vault: VaultDescriptor
  scan_job_id: string
}

export interface NoteMetadata {
  id: string
  vault_id: string
  path: string
  title: string
  content_hash: string
  modified_at: string
  word_count: number
  reading_time_minutes: number
  tags: string[]
  note_type?: string | null
  organized?: boolean
  archived?: boolean
}

export interface NoteDocument {
  metadata: NoteMetadata
  markdown: string
}

export interface ExternalChangeConflict {
  path: string
  loaded_hash: string
  disk_hash: string
}

export interface VaultWatchEvent {
  path: string
  kind: string
}

export interface VaultFilesystemChangedEvent {
  generation: number
  events: VaultWatchEvent[]
  rescan_required: boolean
  reason?: string | null
}

export interface SaveNoteOutput {
  metadata: NoteMetadata
  previous_content_hash?: string
  dry_run: boolean
}

export interface RecentNoteEntry {
  path: string
  opened_at: string
}

export interface RecentFileHit {
  path: string
  opened_at: string
}

export interface ScannedEntry {
  path: string
  kind: 'note' | 'asset' | 'directory'
  content_hash?: string
  modified_at?: string
  size_bytes: number
}

export interface VaultHealthReport {
  vault_id: string
  broken_links: number
  orphan_assets: number
  duplicate_titles: number
  invalid_frontmatter: number
  unresolved_citations: number
  indexed_notes: number
  total_words: number
  slow_exports: number
  cache_status: 'fresh' | 'stale' | 'rebuilding'
}

export interface HealthIssue {
  kind: string
  path: string
  detail: string
  line: number | null
}

export interface VaultHealthDiagnostics {
  summary: VaultHealthReport
  issues: HealthIssue[]
}

export interface VaultSnippet {
  name: string
  content: string
  description?: string | null
}

export interface NoteIndexSummary {
  path: string
  title: string
  modified_at: string
  note_type: string | null
  organized: boolean
  archived: boolean
  tags: string[]
}

export interface LintApplyOutput {
  report: {
    files: Array<{ path: string; issues: Array<{ code: string; message: string; line: number; fixable: boolean }> }>
    total_issues: number
    fixable_issues: number
  }
  files_fixed: number
  edits_applied: number
  fixed_paths: string[]
}

export interface RebuildSummary {
  indexed_notes: number
  skipped_notes: number
  links_written: number
  cache_status: VaultHealthReport['cache_status']
  health: VaultHealthReport
}

export interface IncrementalIndexSummary {
  updated: number
  removed: number
  skipped: number
}

export interface VaultSection {
  name: string
  count: number
  notes: string[]
}

export interface SearchHit {
  note_id: string
  path: string
  title: string
  snippet: string
  /** True when the note also matched semantically (embedding overlay). */
  semantic?: boolean
}

export interface TagSummary {
  tag: string
  note_count: number
}

export interface TaggedNote {
  path: string
  title: string
}

export interface WikilinkResolution {
  kind: 'resolved' | 'ambiguous' | 'unresolved'
  path: string | null
  candidates: string[]
}

export interface KnowledgeNoteSummary {
  path: string
  title: string
  inbound_links: number
  outbound_links: number
}

export interface ViewNoteHit {
  path: string
  title: string
}

export interface UnresolvedLinkTarget {
  target: string
  reference_count: number
  referencing_paths: string[]
}

export interface DailyNotePlan {
  path: string
  title: string
  markdown: string
}

/** A named, persisted snapshot of graph filter state. */
export interface SavedGraphView {
  /** Unique ID (nanoid). */
  id: string
  /** Display name shown in the saved views list. */
  name: string
  /** ISO timestamp when the view was saved. */
  created_at: string
  /** Filter: tag prefix constraints (ANDed). */
  tags?: string[]
  /** Filter: focus path (start node). */
  focus_path?: string | null
  /** Filter: graph depth. */
  depth?: number
  /** Filter: only show notes modified within this many days. */
  modified_within_days?: number | null
  /** Filter: only show cluster IDs. */
  cluster_ids?: string[]
}

export interface VaultConfig {
  daily_note: {
    directory: string
    filename_format: string
    title_format: string
    template_path: string | null
  }
  templates_directory: string
  inbox?: {
    enabled: boolean
    period: 'week' | 'month' | 'quarter' | 'all'
    new_note_directory?: string | null
  }
  workflow?: {
    auto_advance_inbox_after_organize: boolean
  }
  note_types?: {
    directory: string
  }
  export: {
    bibliography_path: string
    csl_style_path: string
    export_on_save?: {
      enabled: boolean
      profile_id: string | null
    }
  }
  writing_targets?: {
    daily_words: number
    history_path: string | null
  }
  graph_groups?: Array<{ tag_prefix: string; color: string }>
  extra_roots?: string[]
  canvas?: { crdt_enabled: boolean }
  mcp?: {
    mode: 'off' | 'read-only' | 'draft' | 'write-approved'
    disabled?: boolean
  }
  saved_views?: SavedGraphView[]
  /** LaTeX / Tectonic compile settings */
  latex?: {
    enabled: boolean
    /** Path to tectonic binary; null = auto-discover from PATH */
    tectonic_path: string | null
    /** Output directory for compiled PDFs, relative to vault root */
    output_directory: string
    /** Extra tectonic flags e.g. ["--keep-logs"] */
    extra_flags: string[]
    /** Auto-compile on save for .tex files */
    compile_on_save: boolean
  }
  /** Google Calendar & Tasks sync */
  calendar_sync?: {
    enabled: boolean
    /** Google OAuth2 client ID (public; secret stored in OS keychain) */
    google_client_id: string | null
    /** Primary calendar ID to sync with; null = primary calendar */
    google_calendar_id: string | null
    /** Which task list to sync; null = @default */
    google_task_list_id: string | null
    /** Max days ahead to fetch events */
    lookahead_days: number
    /** Show events as tasks in the task panel */
    show_events_in_tasks: boolean
    /** Auto-extract vault tasks and push to Google Tasks */
    push_vault_tasks: boolean
    /** Inbox note path for quick-captured events */
    capture_note_path: string | null
  }
  /** Autosuggest / autocomplete tuning */
  autosuggest?: {
    enabled: boolean
    /** Minimum characters before suggestions fire */
    min_chars: number
    /** Max suggestions shown */
    max_results: number
    /** Include suggestions from all vault notes (cross-document) */
    cross_document: boolean
    /** Include wiki-link targets as suggestions */
    wikilinks: boolean
    /** Include tags as suggestions */
    tags: boolean
    /** Include headings as suggestions */
    headings: boolean
    /** Debounce delay in ms */
    debounce_ms: number
  }
  /** User-defined callout/admonition types */
  custom_callouts?: Array<{
    id: string
    label: string
    accent_color: string
    icon?: string
    description?: string
  }>
  /** Reading list metadata (statuses stored in note frontmatter via this index) */
  reading_list?: {
    enabled: boolean
    /** Frontmatter key used for reading status */
    status_key: string
  }
  /** Accessibility preferences */
  accessibility?: {
    reduced_motion: boolean
    high_contrast: boolean
    /** Font size scale factor (1.0 = default) */
    font_scale: number
    /** Enable ARIA live regions for editor events */
    live_regions: boolean
    /** Focus outline style */
    focus_outline: 'default' | 'strong' | 'custom'
    /** Custom focus outline color (CSS value) */
    focus_outline_color?: string
  }
  /** Semantic (embedding) search; opt-in, keys live in the OS keychain */
  semantic?: {
    provider: 'none' | 'ollama' | 'openai'
    base_url?: string | null
    model?: string | null
    dimension?: number | null
  }
  /** Feature flags: modules that can be enabled/disabled per-vault */
  features?: {
    latex: boolean
    calendar: boolean
    reading_list: boolean
    relationship_matrix: boolean
    automation_recorder: boolean
    link_decay: boolean
    footnote_manager: boolean
  }
}

export interface BibliographyEntry {
  key: string
  title: string
  source_path: string
  entry_type: string
  author?: string
  year?: string
}

export interface BacklinkHit {
  from_path: string
  from_title: string
  label: string
  kind: string
  line: number
}

export interface GraphNode {
  id: string
  path: string
  label: string
  unresolved: boolean
  color?: string
}

export interface GraphEdge {
  id: string
  source: string
  target: string
  kind: string
}

export interface GraphQueryOutput {
  nodes: GraphNode[]
  edges: GraphEdge[]
}

export interface RenameNoteDryRunOutput {
  affected_files: string[]
  link_edits: number
  warnings: string[]
}

export interface RenameNoteApplyOutput {
  from_path: string
  to_path: string
  affected_files: string[]
  link_edits: number
}

export interface LinkRewritePreview {
  affected_files: string[]
  edits: number
  warnings: string[]
}

export interface LinkRewriteApplyOutput {
  affected_files: string[]
  edits: number
}

export interface PandocDiscovery {
  path: string
  version: string
}

export interface ExportJobStarted {
  job_id: string
  note_path: string
  format: string
}

export interface ExportJobFinishedEvent {
  job_id: string
  result: ExportJobOutput
}

export interface ExportJobFailedEvent {
  job_id: string
  error: string
}

export interface ExportJobProgressEvent {
  job_id: string
  stream: 'stderr' | 'stdout'
  chunk: string
}

export interface ExportJobOutput {
  job_id: string
  format: string
  artifact_path: string
  command: string[]
  stdout: string
  stderr: string
  duration_ms: number
  dry_run: boolean
}

export interface ExportJobRecord {
  id: string
  profile_label: string
  note_path: string
  status: 'running' | 'success' | 'error' | 'dry-run' | 'cancelled'
  finished_at: string
  result?: ExportJobOutput
  error?: string
  live_stderr?: string
}

export interface GitChangedFile {
  path: string
  status: string
  conflict: boolean
}

export interface GitStatus {
  is_repo: boolean
  branch: string | null
  changed_files: GitChangedFile[]
  clean: boolean
  ahead: number
  behind: number
  has_upstream: boolean
  has_conflicts: boolean
  conflicted_files: GitChangedFile[]
}

export interface GitCommitOutput {
  commit_hash: string
  files_committed: string[]
}

export interface GitPullOutput {
  message: string
}

export interface GitPushOutput {
  message: string
}

// ── Publish plan types (W1-6 / W1-7) ────────────────────────────────────────

/** A single note eligible for publishing. Mirrors Rust `PublishCandidate`. */
export interface PublishCandidate {
  /** Vault-relative POSIX path (forward slashes, no leading slash). */
  rel_path: string
  /** SHA-256 hex of the note's raw bytes at planning time. */
  content_hash: string
}

/**
 * Four-bucket publish diff. Mirrors Rust `PublishPlan`.
 * Returned by `vault_publish_plan_starlight` before any write occurs.
 */
export interface PublishPlan {
  /** Present in vault, absent from bucket → will be uploaded. */
  new_items: PublishCandidate[]
  /** Present in both, hash differs → will be updated. */
  changed: PublishCandidate[]
  /** Present in both, hash identical → no action. */
  unchanged: PublishCandidate[]
  /** Present in bucket but absent from vault → candidate for deletion. */
  orphaned: string[]
}

export interface StarlightPublishPlanOutput {
  output: string
  docs_dir: string
  plan: PublishPlan
}

export interface StarlightPublishApplyOutput {
  output: string
  docs_dir: string
  written: string[]
  deleted: string[]
}
