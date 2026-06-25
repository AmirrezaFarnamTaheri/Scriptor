import { invoke } from '@tauri-apps/api/core'

import type {
  BacklinkHit,
  GraphQueryOutput,
  NoteIndexSummary,
  RebuildSummary,
  SaveNoteOutput,
  SearchHit,
  VaultHealthDiagnostics,
  VaultHealthReport,
} from '../../types/vault'
import { requireNative } from '../native.ts'

export interface DaemonEndpoint {
  socket_name: string
  pid: number
}

export interface DaemonPingOutput {
  version: string
}

export async function daemonPing(): Promise<DaemonPingOutput> {
  requireNative()
  return invoke<DaemonPingOutput>('daemon_ping')
}

export async function daemonEndpoint(): Promise<DaemonEndpoint> {
  requireNative()
  return invoke<DaemonEndpoint>('daemon_endpoint')
}

export async function daemonStart(): Promise<DaemonEndpoint> {
  requireNative()
  return invoke<DaemonEndpoint>('daemon_start')
}

export async function ensureDaemonReady(): Promise<DaemonEndpoint> {
  try {
    return await daemonPing().then(() => daemonEndpoint())
  } catch {
    return daemonStart()
  }
}

export async function daemonOpenVault(rootPath: string): Promise<void> {
  requireNative()
  await invoke('daemon_open_vault', { rootPath })
}

export async function daemonHealthDiagnostics(): Promise<VaultHealthDiagnostics> {
  requireNative()
  const payload = await invoke<string>('daemon_health_diagnostics')
  return JSON.parse(payload) as VaultHealthDiagnostics
}

export async function daemonHealthReport(): Promise<VaultHealthReport> {
  requireNative()
  const payload = await invoke<string>('daemon_health_report')
  return JSON.parse(payload) as VaultHealthReport
}

export async function daemonRebuildIndex(): Promise<RebuildSummary> {
  requireNative()
  const payload = await invoke<string>('daemon_rebuild_index')
  return JSON.parse(payload) as RebuildSummary
}

export async function daemonSearch(query: string, limit = 25): Promise<SearchHit[]> {
  requireNative()
  const payload = await invoke<string>('daemon_search', { query, limit })
  return JSON.parse(payload) as SearchHit[]
}

export async function daemonListNoteSummaries(): Promise<NoteIndexSummary[]> {
  requireNative()
  const payload = await invoke<string>('daemon_list_note_summaries')
  return JSON.parse(payload) as NoteIndexSummary[]
}

export async function daemonBacklinks(path: string): Promise<BacklinkHit[]> {
  requireNative()
  const payload = await invoke<string>('daemon_backlinks', { path })
  return JSON.parse(payload) as BacklinkHit[]
}

export async function daemonGraph(focusPath?: string | null, depth = 1): Promise<GraphQueryOutput> {
  requireNative()
  const payload = await invoke<string>('daemon_graph', {
    focusPath: focusPath ?? null,
    depth,
  })
  return JSON.parse(payload) as GraphQueryOutput
}

export async function daemonGitStatusJson(): Promise<string> {
  requireNative()
  return invoke<string>('daemon_git_status')
}

export async function daemonSaveNote(
  path: string,
  markdown: string,
  expectedContentHash?: string,
  dryRun?: boolean,
): Promise<SaveNoteOutput> {
  requireNative()
  const payload = await invoke<string>('daemon_save_note', {
    path,
    markdown,
    expectedContentHash: expectedContentHash ?? null,
    dryRun: dryRun ?? false,
  })
  return JSON.parse(payload) as SaveNoteOutput
}

export async function daemonUpdateNoteIndex(path: string): Promise<boolean> {
  requireNative()
  return invoke<boolean>('daemon_update_note_index', { path })
}

export async function daemonRenameApply(
  fromPath: string,
  toPath: string,
  updateLinks: boolean,
): Promise<import('../../types/vault').RenameNoteApplyOutput> {
  requireNative()
  const payload = await invoke<string>('daemon_rename_apply', {
    fromPath,
    toPath,
    updateLinks,
  })
  return JSON.parse(payload) as import('../../types/vault').RenameNoteApplyOutput
}

export async function daemonExportRunNote(
  notePath: string,
  format: string,
  dryRun = false,
  extraPandocArgs: string[] = [],
  outputSubdirectory?: string,
): Promise<import('../../types/vault').ExportJobOutput> {
  requireNative()
  const payload = await invoke<string>('daemon_export_run_note', {
    notePath,
    format,
    dryRun,
    extraPandocArgs,
    outputSubdirectory: outputSubdirectory ?? null,
  })
  return JSON.parse(payload) as import('../../types/vault').ExportJobOutput
}

export async function daemonExportRunMarkdown(
  notePath: string,
  sourceMarkdown: string,
  format: string,
  dryRun = false,
  extraPandocArgs: string[] = [],
  outputSubdirectory?: string,
): Promise<import('../../types/vault').ExportJobOutput> {
  requireNative()
  const payload = await invoke<string>('daemon_export_run_markdown', {
    notePath,
    sourceMarkdown,
    format,
    dryRun,
    extraPandocArgs,
    outputSubdirectory: outputSubdirectory ?? null,
  })
  return JSON.parse(payload) as import('../../types/vault').ExportJobOutput
}
