import { invoke } from '@tauri-apps/api/core'

import type {
  DailyNotePlan,
  LintApplyOutput,
  LinkRewriteApplyOutput,
  LinkRewritePreview,
  NoteDocument,
  OpenVaultOutput,
  RecentNoteEntry,
  RenameNoteApplyOutput,
  RenameNoteDryRunOutput,
  SaveNoteOutput,
  ScannedEntry,
  VaultConfig,
  VaultHealthDiagnostics,
  VaultHealthReport,
  VaultSnippet,
  ViewNoteHit,
} from '../../types/vault'
import { isHeadlessMode } from '../headlessMode.ts'
import { requireNative } from '../native.ts'
import { daemonHealthDiagnostics, daemonHealthReport, daemonRenameApply, daemonSaveNote } from './daemon.ts'

export async function vaultOpen(rootPath: string): Promise<OpenVaultOutput> {
  requireNative()
  return invoke<OpenVaultOutput>('vault_open', { rootPath })
}

export async function vaultScan(): Promise<ScannedEntry[]> {
  requireNative()
  return invoke<ScannedEntry[]>('vault_scan')
}

export async function vaultReadNote(path: string): Promise<NoteDocument> {
  requireNative()
  return invoke<NoteDocument>('vault_read_note', { path })
}

export async function vaultSaveNote(
  path: string,
  markdown: string,
  expectedContentHash?: string,
  dryRun?: boolean,
): Promise<SaveNoteOutput> {
  requireNative()
  if (isHeadlessMode()) {
    return daemonSaveNote(path, markdown, expectedContentHash, dryRun)
  }
  return invoke<SaveNoteOutput>('vault_save_note', {
    path,
    markdown,
    expectedContentHash: expectedContentHash ?? null,
    dryRun: dryRun ?? false,
  })
}

export async function vaultListRecentNotes(limit = 20): Promise<RecentNoteEntry[]> {
  requireNative()
  return invoke<RecentNoteEntry[]>('vault_list_recent_notes', { limit })
}

export async function vaultRecordRecentNote(path: string): Promise<RecentNoteEntry[]> {
  requireNative()
  return invoke<RecentNoteEntry[]>('vault_record_recent_note', { path })
}

export async function vaultDeleteNote(path: string): Promise<{ path: string; deleted: boolean }> {
  requireNative()
  return invoke<{ path: string; deleted: boolean }>('vault_delete_note', { path })
}

export async function vaultLoadConfig(): Promise<VaultConfig> {
  requireNative()
  return invoke<VaultConfig>('vault_load_config')
}

export async function vaultSaveConfig(config: VaultConfig): Promise<void> {
  requireNative()
  await invoke('vault_save_config_cmd', { config })
}

export async function vaultPlanDailyNote(date?: string): Promise<DailyNotePlan> {
  requireNative()
  return invoke<DailyNotePlan>('vault_plan_daily_note', { date: date ?? null })
}

export async function vaultSaveSnippets(snippets: VaultSnippet[]): Promise<void> {
  requireNative()
  await invoke('vault_save_snippets', { snippets })
}

export async function vaultLoadTemplate(templatePath: string): Promise<string> {
  requireNative()
  return invoke<string>('vault_load_template', { templatePath })
}

export async function vaultBuildNoteMarkdown(
  title: string,
  noteType?: string | null,
  templateBody?: string | null,
): Promise<string> {
  requireNative()
  return invoke<string>('vault_build_note_markdown', {
    title,
    noteType: noteType ?? null,
    templateBody: templateBody ?? null,
  })
}

export async function vaultRenameDryRun(
  fromPath: string,
  toPath: string,
  updateLinks: boolean,
): Promise<RenameNoteDryRunOutput> {
  requireNative()
  return invoke<RenameNoteDryRunOutput>('vault_rename_dry_run', { fromPath, toPath, updateLinks })
}

export async function vaultRenameApply(
  fromPath: string,
  toPath: string,
  updateLinks: boolean,
): Promise<RenameNoteApplyOutput> {
  requireNative()
  if (isHeadlessMode()) {
    return daemonRenameApply(fromPath, toPath, updateLinks)
  }
  return invoke<RenameNoteApplyOutput>('vault_rename_apply', { fromPath, toPath, updateLinks })
}

export async function vaultRenameTagDryRun(oldTag: string, newTag: string): Promise<LinkRewritePreview> {
  requireNative()
  return invoke<LinkRewritePreview>('vault_rename_tag_dry_run', { oldTag, newTag })
}

export async function vaultRenameTagApply(oldTag: string, newTag: string): Promise<LinkRewriteApplyOutput> {
  requireNative()
  return invoke<LinkRewriteApplyOutput>('vault_rename_tag_apply', { oldTag, newTag })
}

export async function vaultRenameSectionDryRun(
  notePath: string,
  oldSection: string,
  newSection: string,
  updateHeading: boolean,
): Promise<LinkRewritePreview> {
  requireNative()
  return invoke<LinkRewritePreview>('vault_rename_section_dry_run', {
    notePath,
    oldSection,
    newSection,
    updateHeading,
  })
}

export async function vaultRenameSectionApply(
  notePath: string,
  oldSection: string,
  newSection: string,
  updateHeading: boolean,
): Promise<LinkRewriteApplyOutput> {
  requireNative()
  return invoke<LinkRewriteApplyOutput>('vault_rename_section_apply', {
    notePath,
    oldSection,
    newSection,
    updateHeading,
  })
}

export async function vaultRenameBlockDryRun(
  notePath: string,
  oldBlock: string,
  newBlock: string,
  updateAnchor: boolean,
): Promise<LinkRewritePreview> {
  requireNative()
  return invoke<LinkRewritePreview>('vault_rename_block_dry_run', {
    notePath,
    oldBlock,
    newBlock,
    updateAnchor,
  })
}

export async function vaultRenameBlockApply(
  notePath: string,
  oldBlock: string,
  newBlock: string,
  updateAnchor: boolean,
): Promise<LinkRewriteApplyOutput> {
  requireNative()
  return invoke<LinkRewriteApplyOutput>('vault_rename_block_apply', {
    notePath,
    oldBlock,
    newBlock,
    updateAnchor,
  })
}

export async function vaultHealth(): Promise<VaultHealthReport> {
  requireNative()
  if (isHeadlessMode()) {
    return daemonHealthReport()
  }
  const payload = await invoke<string>('vault_health')
  return JSON.parse(payload) as VaultHealthReport
}

export async function vaultHealthDiagnostics(): Promise<VaultHealthDiagnostics> {
  requireNative()
  if (isHeadlessMode()) {
    return daemonHealthDiagnostics()
  }
  const payload = await invoke<string>('indexer_health_diagnostics')
  return JSON.parse(payload) as VaultHealthDiagnostics
}

export async function vaultLintFix(): Promise<LintApplyOutput> {
  requireNative()
  return invoke<LintApplyOutput>('vault_lint_fix')
}

export async function vaultLoadSnippets(): Promise<VaultSnippet[]> {
  requireNative()
  return invoke<VaultSnippet[]>('vault_load_snippets')
}

export async function vaultListViewNotes(filterJson: string): Promise<ViewNoteHit[]> {
  requireNative()
  return invoke<ViewNoteHit[]>('vault_list_view_notes', { filterJson })
}

export interface StatsHistoryEntry {
  date: string
  words: number
}

export async function vaultReadStatsHistory(): Promise<StatsHistoryEntry[]> {
  requireNative()
  return invoke<StatsHistoryEntry[]>('vault_read_stats_history')
}

export async function vaultAppendStatsHistory(date: string, words: number): Promise<StatsHistoryEntry[]> {
  requireNative()
  return invoke<StatsHistoryEntry[]>('vault_append_stats_history', { date, words })
}

export async function vaultFrontmatterSet(
  path: string,
  field: string,
  value: string,
): Promise<{ path: string; field: string; value: string | null; markdown: string }> {
  requireNative()
  return invoke('vault_frontmatter_set', { path, field, value })
}

export async function vaultPublishStarlight(outputPath: string): Promise<{
  output: string
  notes_copied: number
  docs_dir: string
}> {
  requireNative()
  return invoke('vault_publish_starlight', { outputPath })
}

export async function pickVaultFolder(): Promise<string | null> {
  requireNative()
  const { open } = await import('@tauri-apps/plugin-dialog')
  const selection = await open({ directory: true, multiple: false, title: 'Open Markdown Vault' })
  if (selection === null) return null
  return Array.isArray(selection) ? selection[0] ?? null : selection
}
