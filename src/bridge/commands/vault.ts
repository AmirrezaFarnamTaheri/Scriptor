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
import { requireNative } from '../native.ts'
import { authorizeSensitiveOperation } from './authorization.ts'
import { parseVaultHealthDiagnostics, parseVaultHealthReport } from '../../types/vaultValidators'

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
  const authorizationToken = await authorizeSensitiveOperation('delete_note', path)
  return invoke<{ path: string; deleted: boolean }>('vault_delete_note', {
    path,
    authorizationToken,
  })
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
  const payload = await invoke<string>('vault_health')
  return parseVaultHealthReport(payload)
}

export async function vaultHealthDiagnostics(): Promise<VaultHealthDiagnostics> {
  requireNative()
  const payload = await invoke<string>('indexer_health_diagnostics')
  return parseVaultHealthDiagnostics(payload)
}

export async function vaultLintFix(vaultId: string): Promise<LintApplyOutput> {
  requireNative()
  const authorizationToken = await authorizeSensitiveOperation('apply_bulk_fix', vaultId)
  return invoke<LintApplyOutput>('vault_lint_fix', { authorizationToken })
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

export interface PersistedActivityEntry {
  id: string
  ts: number
  kind: string
  message: string
  detail?: string | null
}

export async function vaultReadActivityLog(limit = 100): Promise<PersistedActivityEntry[]> {
  requireNative()
  return invoke<PersistedActivityEntry[]>('vault_read_activity_log', { limit })
}

export async function vaultAppendActivityLog(entry: PersistedActivityEntry): Promise<void> {
  requireNative()
  await invoke('vault_append_activity_log', {
    id: entry.id,
    ts: entry.ts,
    kind: entry.kind,
    message: entry.message,
    detail: entry.detail ?? null,
  })
}

export interface WorkspaceSessionPayload {
  version: number
  active_path: string | null
  open_tabs: Array<{ path: string; pinned: boolean }>
  collapsed_folders: Record<string, boolean>
  sidebar_view?: string | null
}

export async function vaultReadWorkspaceSession(): Promise<WorkspaceSessionPayload> {
  requireNative()
  return invoke<WorkspaceSessionPayload>('vault_read_workspace_session')
}

export async function vaultSaveWorkspaceSession(session: WorkspaceSessionPayload): Promise<void> {
  requireNative()
  await invoke('vault_save_workspace_session', { session })
}

export interface NoteHistoryRevision {
  id: string
  saved_at: string
  content_hash: string
  word_count: number
  preview: string
}

export async function vaultListNoteHistory(path: string): Promise<NoteHistoryRevision[]> {
  requireNative()
  return invoke<NoteHistoryRevision[]>('vault_list_note_history', { path })
}

export async function vaultReadNoteHistoryRevision(path: string, revisionId: string): Promise<string> {
  requireNative()
  return invoke<string>('vault_read_note_history_revision', { path, revisionId })
}

export async function vaultRestoreNoteHistoryRevision(path: string, revisionId: string): Promise<SaveNoteOutput> {
  requireNative()
  const authorizationToken = await authorizeSensitiveOperation('restore_history', path)
  return invoke<SaveNoteOutput>('vault_restore_note_history_revision', {
    path,
    revisionId,
    authorizationToken,
  })
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
  const authorizationToken = await authorizeSensitiveOperation('publish_site', outputPath)
  return invoke('vault_publish_starlight', { outputPath, authorizationToken })
}

export async function pickVaultFolder(): Promise<string | null> {
  requireNative()
  const { open } = await import('@tauri-apps/plugin-dialog')
  const selection = await open({ directory: true, multiple: false, title: 'Open Markdown Vault' })
  if (selection === null) return null
  return Array.isArray(selection) ? selection[0] ?? null : selection
}

export interface VaultBackupEntry {
  name: string
  path: string
  created_at: string
  size_bytes: number
  storage_kind: 'local_snapshot' | 'external_backup'
  verified: boolean
}

export async function vaultCreateBackup(backupPath?: string): Promise<VaultBackupEntry> {
  requireNative()
  const scope = backupPath?.trim() || 'local-snapshot'
  const authorizationToken = await authorizeSensitiveOperation('create_backup', scope)
  return invoke<VaultBackupEntry>('vault_create_backup', {
    backupPath: backupPath?.trim() || null,
    authorizationToken,
  })
}

export async function vaultListBackups(backupPath?: string): Promise<VaultBackupEntry[]> {
  requireNative()
  return invoke<VaultBackupEntry[]>('vault_list_backups', { backupPath: backupPath ?? null })
}

export async function vaultRestoreBackup(backupName: string, backupPath?: string): Promise<string> {
  requireNative()
  const authorizationToken = await authorizeSensitiveOperation('restore_backup', backupName)
  return invoke<string>('vault_restore_backup', {
    backupName,
    backupPath: backupPath ?? null,
    authorizationToken,
  })
}

export async function vaultDeleteBackup(backupName: string, backupPath?: string): Promise<void> {
  requireNative()
  const authorizationToken = await authorizeSensitiveOperation('delete_backup', backupName)
  await invoke('vault_delete_backup', {
    backupName,
    backupPath: backupPath ?? null,
    authorizationToken,
  })
}

export interface ObsidianImportOptions {
  convertWikilinks?: boolean
  importAttachments?: boolean
  preserveFrontmatter?: boolean
}

export interface ObsidianImportResult {
  notesImported: number
  attachmentsImported: number
  skippedFiles: number
  errors: string[]
  importedPaths: string[]
}

export async function vaultDetectObsidian(obsidianPath: string): Promise<boolean> {
  requireNative()
  return invoke<boolean>('vault_detect_obsidian', { obsidianPath })
}

export async function vaultImportObsidian(
  obsidianPath: string,
  options?: ObsidianImportOptions,
): Promise<ObsidianImportResult> {
  requireNative()
  const authorizationToken = await authorizeSensitiveOperation('import_vault', obsidianPath)
  return invoke<ObsidianImportResult>('vault_import_obsidian', {
    obsidianPath,
    convertWikilinks: options?.convertWikilinks ?? true,
    importAttachments: options?.importAttachments ?? true,
    preserveFrontmatter: options?.preserveFrontmatter ?? true,
    authorizationToken,
  })
}

/**
 * Export the vault audit log as a string.
 * @param format  'json' (default) or 'csv'
 */
export async function vaultExportAuditLog(format: 'json' | 'csv' = 'json'): Promise<string> {
  requireNative()
  return invoke<string>('vault_export_audit_log', { format })
}
