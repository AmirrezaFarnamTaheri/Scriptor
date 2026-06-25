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
  events: VaultWatchEvent[]
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
