import { invoke } from '@tauri-apps/api/core'

import type {
  BacklinkHit,
  BibliographyEntry,
  GraphQueryOutput,
  IncrementalIndexSummary,
  KnowledgeNoteSummary,
  NoteIndexSummary,
  RebuildSummary,
  RecentFileHit,
  SearchHit,
  TagSummary,
  TaggedNote,
  UnresolvedLinkTarget,
  WikilinkResolution,
} from '../../types/vault'
import { requireNative } from '../native.ts'

export async function indexerRebuild(): Promise<RebuildSummary> {
  requireNative()
  return invoke<RebuildSummary>('indexer_rebuild')
}

export async function indexerUpdateNote(path: string): Promise<boolean> {
  requireNative()
  return invoke<boolean>('indexer_update_note', { path })
}

export async function indexerApplyFilesystemChanges(paths: string[]): Promise<IncrementalIndexSummary> {
  requireNative()
  return invoke<IncrementalIndexSummary>('indexer_apply_filesystem_changes', { paths })
}

export async function indexerSearch(query: string, limit = 25): Promise<SearchHit[]> {
  requireNative()
  return invoke<SearchHit[]>('indexer_search', { query, limit })
}

export async function indexerListTags(): Promise<TagSummary[]> {
  requireNative()
  return invoke<TagSummary[]>('indexer_list_tags')
}

export async function indexerNotesForTag(tag: string): Promise<TaggedNote[]> {
  requireNative()
  return invoke<TaggedNote[]>('indexer_notes_for_tag', { tag })
}

export async function indexerListBibliography(): Promise<BibliographyEntry[]> {
  requireNative()
  return invoke<BibliographyEntry[]>('indexer_list_bibliography')
}

export async function indexerResolveWikilink(target: string): Promise<WikilinkResolution> {
  requireNative()
  return invoke<WikilinkResolution>('indexer_resolve_wikilink', { target })
}

export async function indexerListOrphans(): Promise<KnowledgeNoteSummary[]> {
  requireNative()
  return invoke<KnowledgeNoteSummary[]>('indexer_list_orphans')
}

export async function indexerListDeadEnds(): Promise<KnowledgeNoteSummary[]> {
  requireNative()
  return invoke<KnowledgeNoteSummary[]>('indexer_list_dead_ends')
}

export async function indexerListUnresolvedTargets(): Promise<UnresolvedLinkTarget[]> {
  requireNative()
  return invoke<UnresolvedLinkTarget[]>('indexer_list_unresolved_targets')
}

export async function indexerBacklinks(path: string): Promise<BacklinkHit[]> {
  requireNative()
  return invoke<BacklinkHit[]>('indexer_backlinks', { path })
}

export async function indexerGraph(focusPath?: string, depth = 1): Promise<GraphQueryOutput> {
  requireNative()
  return invoke<GraphQueryOutput>('indexer_graph', { focusPath: focusPath ?? null, depth })
}

export interface GraphTraverseStep {
  path: string
  depth: number
  parent_path?: string | null
  via?: string | null
}

export async function indexerTraverseGraph(focusPath: string, depth = 2): Promise<GraphTraverseStep[]> {
  requireNative()
  return invoke<GraphTraverseStep[]>('indexer_traverse_graph', { focusPath, depth })
}

export async function indexerListRecentFiles(limit = 20): Promise<RecentFileHit[]> {
  requireNative()
  return invoke<RecentFileHit[]>('indexer_list_recent_files', { limit })
}

export async function indexerRecordRecentAccess(path: string): Promise<void> {
  requireNative()
  return invoke<void>('indexer_record_recent_access', { path })
}

export async function indexerExecuteDql(
  query: string,
): Promise<Array<{ path: string; title: string; snippet: string }>> {
  requireNative()
  return invoke('indexer_execute_dql', { query })
}

export async function indexerEvaluateView(filterJson: string, path: string): Promise<boolean> {
  requireNative()
  return invoke<boolean>('indexer_evaluate_view', { filterJson, path })
}

export async function indexerListNoteSummaries(): Promise<NoteIndexSummary[]> {
  requireNative()
  return invoke<NoteIndexSummary[]>('indexer_list_note_summaries')
}

export async function indexerListInbox(period?: string): Promise<NoteIndexSummary[]> {
  requireNative()
  return invoke<NoteIndexSummary[]>('indexer_list_inbox', { period: period ?? null })
}

export interface NoteMetaHit {
  path: string
  title: string | null
  modified_at: string | null
  exists: boolean
}

export async function indexerBatchNoteMeta(paths: string[]): Promise<NoteMetaHit[]> {
  requireNative()
  return invoke<NoteMetaHit[]>('indexer_batch_note_meta', { paths })
}

// ── W4: Task commands ────────────────────────────────────────────────────────

/** Mirrors `TaskFilter` in `crates/indexer/src/tasks.rs`. */
export interface TaskQueryFilter {
  status?: string | null
  tag?: string | null
  dueBefore?: string | null
  dueAfter?: string | null
}

/** Mirrors `TaskRow` returned by `query_tasks`. */
export interface TaskRow {
  id: string
  vaultId: string
  sourceNoteId: string | null
  line: number
  title: string
  status: string
  priority: number
  dueAt: string | null
  scheduledAt: string | null
  startAt: string | null
  rrule: string | null
  fieldStyle: 'emoji' | 'dataview'
  tags: string[]
  completedAt: string | null
  createdAt: string
  updatedAt: string
}

/** Mirrors `KanbanBoard` / `KanbanColumn` / `KanbanCard` in `kanban.rs`. */
export interface KanbanCardRow {
  text: string
  status: string
  line: number
  archived: boolean
}

export interface KanbanColumnRow {
  name: string
  cards: KanbanCardRow[]
}

export interface KanbanBoardRow {
  sourcePath: string
  columns: KanbanColumnRow[]
}

/**
 * Query tasks from the indexed SQLite store (W4-4).
 * All filter fields are optional; omit to list all tasks.
 */
export async function indexerQueryTasks(
  filter: TaskQueryFilter = {},
  limit = 200,
): Promise<TaskRow[]> {
  requireNative()
  return invoke<TaskRow[]>('indexer_query_tasks', {
    status: filter.status ?? null,
    tag: filter.tag ?? null,
    dueBefore: filter.dueBefore ?? null,
    dueAfter: filter.dueAfter ?? null,
    limit,
  })
}

/**
 * Patch a task's status (and optionally due date) in the index and rewrite the
 * source note line.  The Rust handler merges only the provided fields.
 */
export async function indexerUpdateTask(
  taskId: string,
  patch: { status?: string; dueAt?: string | null },
): Promise<void> {
  requireNative()
  return invoke<void>('indexer_update_task', { taskId, ...patch })
}

/**
 * Re-index tasks for a single note (called after note saves so the store
 * reflects edits before the next full rebuild).
 */
export async function indexerSyncNoteTasks(notePath: string): Promise<void> {
  requireNative()
  return invoke<void>('indexer_sync_note_tasks', { notePath })
}

/**
 * Parse and return the kanban board for the given vault-relative path.
 * Returns `null` if the file is not a kanban file.
 */
export async function indexerKanbanBoard(notePath: string): Promise<KanbanBoardRow | null> {
  requireNative()
  return invoke<KanbanBoardRow | null>('indexer_kanban_board', { notePath })
}

/**
 * Relocate a kanban card under a different `##` heading in its source file.
 *
 * `line` is the 0-based line number from `KanbanCardRow.line`.
 * `toColumn` is the destination kanban heading.
 * `newStatus` is a single character matching the obsidian-tasks status
 * convention (e.g. `' '` = todo, `'x'` = done, `'-'` = cancelled, `'>'` = deferred).
 *
 * The Rust handler goes through the vault write path, so file-watchers and
 * history entries fire normally.
 */
export async function indexerKanbanMoveCard(
  notePath: string,
  line: number,
  toColumn: string,
  newStatus: string,
): Promise<void> {
  requireNative()
  return invoke<void>('indexer_kanban_move_card', { notePath, line, toColumn, newStatus })
}
