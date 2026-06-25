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
import { isHeadlessMode } from '../headlessMode.ts'
import { requireNative } from '../native.ts'
import {
  daemonBacklinks,
  daemonGraph,
  daemonListNoteSummaries,
  daemonRebuildIndex,
  daemonSearch,
  daemonUpdateNoteIndex,
} from './daemon.ts'

export async function indexerRebuild(): Promise<RebuildSummary> {
  requireNative()
  if (isHeadlessMode()) {
    return daemonRebuildIndex()
  }
  return invoke<RebuildSummary>('indexer_rebuild')
}

export async function indexerUpdateNote(path: string): Promise<boolean> {
  requireNative()
  if (isHeadlessMode()) {
    return daemonUpdateNoteIndex(path)
  }
  return invoke<boolean>('indexer_update_note', { path })
}

export async function indexerApplyFilesystemChanges(paths: string[]): Promise<IncrementalIndexSummary> {
  requireNative()
  return invoke<IncrementalIndexSummary>('indexer_apply_filesystem_changes', { paths })
}

export async function indexerSearch(query: string, limit = 25): Promise<SearchHit[]> {
  requireNative()
  if (isHeadlessMode()) {
    return daemonSearch(query, limit)
  }
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
  if (isHeadlessMode()) {
    return daemonBacklinks(path)
  }
  return invoke<BacklinkHit[]>('indexer_backlinks', { path })
}

export async function indexerGraph(focusPath?: string, depth = 1): Promise<GraphQueryOutput> {
  requireNative()
  if (isHeadlessMode()) {
    return daemonGraph(focusPath ?? null, depth)
  }
  return invoke<GraphQueryOutput>('indexer_graph', { focusPath: focusPath ?? null, depth })
}

export interface GraphTraverseStep {
  path: string
  depth: number
  via: string | null
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
  if (isHeadlessMode()) {
    return daemonListNoteSummaries()
  }
  return invoke<NoteIndexSummary[]>('indexer_list_note_summaries')
}

export async function indexerListInbox(period?: string): Promise<NoteIndexSummary[]> {
  requireNative()
  return invoke<NoteIndexSummary[]>('indexer_list_inbox', { period: period ?? null })
}
