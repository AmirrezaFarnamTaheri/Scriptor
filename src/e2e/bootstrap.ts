import { mockIPC } from '@tauri-apps/api/mocks'

import {
  SCREENSHOT_SCAN,
  SCREENSHOT_VAULT,
  screenshotGraph,
  screenshotHealthDiagnostics,
  screenshotRebuildSummary,
} from '../screenshot/fixture.ts'
import {
  e2eNoteDocument,
  e2eKanbanBoard,
  e2eKanbanMoveCard,
  e2eQueryTasks,
  e2eRenameApply,
  e2eRenameDryRun,
  e2eSaveNote,
  e2eSearchNotes,
  e2eUpdateTask,
} from './state.ts'
import { installE2eMcpHarness } from './mcp.harness.ts'

const DEFAULT_CONFIG = {
  daily_note: {
    directory: 'daily',
    filename_format: '{iso}',
    title_format: '{iso}',
    template_path: null,
  },
  templates_directory: '.scriptor/templates',
  inbox: { enabled: true, period: 'all', new_note_directory: null },
  workflow: { auto_advance_inbox_after_organize: false },
  note_types: { directory: 'type' },
  export: {
    bibliography_path: 'references.bib',
    csl_style_path: 'apa-lite.csl',
    export_on_save: { enabled: false, profile_id: null },
  },
  writing_targets: { daily_words: 500, history_path: '.scriptor/stats-history.json' },
  graph_groups: [],
  extra_roots: [],
  mcp: { mode: 'read-only', disabled: false },
}

declare global {
  interface Window {
    /** Minimal marker used by the Tauri runtime detector in browser E2E mode. */
    __TAURI_INTERNALS__?: Record<string, never>
    /** Commits recorded by the mocked `git_commit_cmd`, oldest first. */
    __scriptorE2eGitCommits?: Array<{ files: string[]; message: string }>
    /** Payload of the most recent `git_apply_merged_conflict_cmd` call. */
    __scriptorE2eMergedConflict?: { path: string; mergedMarkdown: string }
    /** Payload of the most recent `vault_rename_apply` call. */
    __scriptorE2eRenameApply?: { fromPath: string; toPath: string; updateLinks: boolean }
    /** Serialized canvas documents persisted through the mocked native bridge. */
    __scriptorE2eCanvasSaves?: string[]
  }
}

/**
 * Conflicted `Field Notes.md` fixtures, selected by the `e2e:git-conflicts`
 * session-storage flag.
 *
 * - `'1'` — the original single balanced hunk. Kept byte-for-byte because the
 *   conflict-resolver screenshot snapshot is taken against it.
 * - `'2'` — a balanced hunk with content *before and after* it, followed by a
 *   dangling `<<<<<<<` with no `=======`/`>>>>>>>`. This is the shape that used
 *   to make `applyConflictChoices` truncate the file to EOF.
 */
const CONFLICT_FIXTURES: Record<string, string> = {
  '1':
    '# Field Notes\n\n<<<<<<< ours\nObservations from the first literature pass.\n\n- Link back to [[Research Plan]]\n=======\nUpdated field observations after second pass.\n\n- New findings from [[Methodology]] review\n>>>>>>> theirs\n',
  '2':
    '# Field Notes\n\nPreamble recorded before the merge.\n\n' +
    '<<<<<<< ours\nObservations from the first literature pass.\n\n- Link back to [[Research Plan]]\n' +
    '=======\nUpdated field observations after second pass.\n\n- New findings from [[Methodology]] review\n' +
    '>>>>>>> theirs\n\n## Next steps\n\n- Schedule follow-up interviews.\n\n' +
    '<<<<<<< ours\nDangling half-conflict with no closing marker.\n',
}

function activeConflictFixture(): string | null {
  const flag = window.sessionStorage.getItem('e2e:git-conflicts')
  if (!flag) return null
  return CONFLICT_FIXTURES[flag] ?? null
}

export function installE2eBridge(): void {
  // Once a commit has been recorded, `git_status_cmd` reports a clean tree so
  // tests can assert that a commit round trip actually changed something.
  let committed = false
  let conflictsResolved = false
  let hashMismatchTriggered = false
  const enabledPluginIds = new Set([
    'scriptor.export',
    'scriptor.citations',
    'scriptor.graph',
    'scriptor.canvas',
    'scriptor.mcp',
  ])
  let canvasDocumentJson = JSON.stringify({
    id: 'canvas-board-default',
    vaultId: 'screenshot-vault',
    title: 'Research board',
    mode: 'edgeless',
    layers: [{ id: 'layer-main', name: 'Main', visible: true, locked: false, order: 0 }],
    blocks: [],
    updatedAt: new Date().toISOString(),
  })
  // Mock Tauri internals so `isTauriRuntime` returns true
  if (typeof window !== 'undefined' && !('__TAURI_INTERNALS__' in window)) {
    window.__TAURI_INTERNALS__ = {}
  }
  mockIPC((cmd, payload) => {
    switch (cmd) {
      case 'vault_open':
        if (window.sessionStorage.getItem('e2e:slow-vault') === '1') {
          return new Promise((resolve) => {
            window.setTimeout(
              () => resolve({ vault: SCREENSHOT_VAULT, scan_job_id: 'e2e-scan' }),
              2500,
            )
          })
        }
        return { vault: SCREENSHOT_VAULT, scan_job_id: 'e2e-scan' }
      case 'plugin_state_get':
        return { enabledPlugins: [...enabledPluginIds], disabledPlugins: [] }
      case 'plugin_state_set_enabled': {
        const body = payload as { capabilityId?: string; enabled?: boolean }
        const capabilityId = String(body.capabilityId ?? '')
        if (body.enabled) enabledPluginIds.add(capabilityId)
        else enabledPluginIds.delete(capabilityId)
        return undefined
      }
      case 'vault_read_note': {
        const readPath = String((payload as { path?: string }).path ?? 'Research Plan.md')
        const conflictFixture = readPath === 'Field Notes.md' ? activeConflictFixture() : null
        if (conflictFixture && !conflictsResolved) {
          return {
            metadata: {
              id: 'note-field-notes',
              vault_id: 'screenshot-vault',
              path: 'Field Notes.md',
              title: 'Field Notes',
              content_hash: 'hash-conflict',
              modified_at: '2026-06-23T12:00:00.000Z',
              word_count: 18,
              reading_time_minutes: 1,
              tags: [],
              note_type: null,
              organized: true,
              archived: false,
            },
            markdown: conflictFixture,
          }
        }
        if (hashMismatchTriggered && readPath === 'Research Plan.md') {
          const document = e2eNoteDocument(readPath)
          return {
            ...document,
            metadata: { ...document.metadata, content_hash: 'hash-external-change' },
            markdown: `${document.markdown}\n\nExternal disk edit.`,
          }
        }
        return e2eNoteDocument(readPath)
      }
      case 'vault_save_note': {
        const body = payload as {
          path?: string
          markdown?: string
          expectedContentHash?: string | null
        }
        const path = String(body.path ?? 'Research Plan.md')
        const markdown = String(body.markdown ?? '')
        if (
          window.sessionStorage.getItem('e2e:hash-mismatch') === '1' &&
          body.expectedContentHash &&
          !hashMismatchTriggered
        ) {
          hashMismatchTriggered = true
          throw new Error(
            `content hash mismatch: expected ${body.expectedContentHash}, found hash-external-change`,
          )
        }
        return e2eSaveNote(path, markdown)
      }
      case 'vault_rename_dry_run': {
        const body = payload as { fromPath?: string; toPath?: string; updateLinks?: boolean }
        return e2eRenameDryRun(
          String(body.fromPath ?? ''),
          String(body.toPath ?? ''),
          body.updateLinks !== false,
        )
      }
      case 'vault_rename_apply': {
        const body = payload as { fromPath?: string; toPath?: string; updateLinks?: boolean }
        const fromPath = String(body.fromPath ?? '')
        const toPath = String(body.toPath ?? '')
        const updateLinks = body.updateLinks !== false
        window.__scriptorE2eRenameApply = { fromPath, toPath, updateLinks }
        return e2eRenameApply(fromPath, toPath, updateLinks)
      }
      case 'vault_load_config':
        return DEFAULT_CONFIG
      case 'vault_load_snippets':
        return []
      case 'vault_list_recent_notes':
        return [{ path: 'Research Plan.md', opened_at: '2026-06-23T12:00:00.000Z' }]
      case 'vault_record_recent_note':
        return [{ path: String((payload as { path?: string }).path ?? ''), opened_at: new Date().toISOString() }]
      case 'vault_read_activity_log':
        return []
      case 'vault_append_activity_log':
        return undefined
      case 'vault_scan':
        if (window.sessionStorage.getItem('e2e:slow-vault') === '1') {
          return new Promise<typeof SCREENSHOT_SCAN>((resolve) => {
          window.setTimeout(() => resolve(SCREENSHOT_SCAN), 2500)
          })
        }
        return SCREENSHOT_SCAN
      case 'indexer_rebuild':
        if (window.sessionStorage.getItem('e2e:slow-vault') === '1') {
          return new Promise((resolve) => {
          window.setTimeout(() => resolve(screenshotRebuildSummary()), 2500)
          })
        }
        return screenshotRebuildSummary()
      case 'indexer_health_diagnostics':
        return JSON.stringify(screenshotHealthDiagnostics())
      case 'vault_health':
        return JSON.stringify(screenshotHealthDiagnostics().summary)
      case 'indexer_list_note_summaries':
        if (window.sessionStorage.getItem('e2e:slow-vault') === '1') {
          return new Promise((resolve) => {
          window.setTimeout(() => {
              resolve(
                SCREENSHOT_SCAN.filter((entry) => entry.kind === 'note').map((entry) => {
                  const doc = e2eNoteDocument(entry.path)
                  return {
                    path: entry.path,
                    title: doc.metadata.title,
                    modified_at: entry.modified_at ?? '',
                    note_type: null,
                    organized: true,
                    archived: false,
                    tags: doc.metadata.tags,
                  }
                }),
              )
          }, 2500)
          })
        }
        return SCREENSHOT_SCAN.filter((entry) => entry.kind === 'note').map((entry) => {
          const doc = e2eNoteDocument(entry.path)
          return {
            path: entry.path,
            title: doc.metadata.title,
            modified_at: entry.modified_at ?? '',
            note_type: null,
            organized: true,
            archived: false,
            tags: doc.metadata.tags,
          }
        })
      case 'indexer_backlinks':
        return []
      case 'indexer_graph': {
        const focusPath = (payload as { focusPath?: string | null }).focusPath ?? null
        return screenshotGraph(focusPath)
      }
      case 'indexer_search': {
        const query = String((payload as { query?: string }).query ?? '')
        const limit = Number((payload as { limit?: number }).limit ?? 25)
        return e2eSearchNotes(query, limit)
      }
      case 'indexer_update_note':
        return true
      case 'indexer_query_tasks':
        return e2eQueryTasks()
      case 'indexer_update_task': {
        if (window.sessionStorage.getItem('e2e:task-update-failure') === '1') {
          throw new Error('E2E task write unavailable')
        }
        const body = payload as { taskId?: string; status?: string; dueAt?: string | null }
        e2eUpdateTask(String(body.taskId ?? ''), { status: body.status, dueAt: body.dueAt })
        return undefined
      }
      case 'indexer_kanban_move_card': {
        const body = payload as { notePath?: string; line?: number; toColumn?: string; newStatus?: string }
        const move = () => e2eKanbanMoveCard(
          String(body.notePath ?? ''),
          Number(body.line),
          String(body.toColumn ?? ''),
          String(body.newStatus ?? ' '),
        )
        if (window.sessionStorage.getItem('e2e:kanban-move-delay') === '1') {
          return new Promise<void>((resolve) => {
            window.setTimeout(() => {
              move()
              resolve()
            }, 500)
          })
        }
        move()
        return undefined
      }
      case 'indexer_kanban_board':
        return e2eKanbanBoard(String((payload as { notePath?: string }).notePath ?? ''))
      case 'indexer_record_recent_access':
        return undefined
      case 'indexer_resolve_wikilink': {
        const target = String((payload as { target?: string }).target ?? '').trim()
        const match = SCREENSHOT_SCAN.find(
          (entry) => entry.kind === 'note' && entry.path.replace(/\.md$/i, '') === target,
        )
        if (match) {
          return { kind: 'resolved', path: match.path, candidates: [] }
        }
        return { kind: 'missing', path: null, candidates: [] }
      }
      case 'indexer_list_bibliography':
        return [
          {
            key: 'smith2024',
            type: 'article',
            title: 'Research Methods',
            author: 'Smith, Jane',
            year: '2024',
          },
        ]
      case 'indexer_list_tags':
        return [{ tag: 'research', note_count: 1 }]
      case 'indexer_list_inbox':
      case 'indexer_list_orphans':
      case 'indexer_list_dead_ends':
      case 'indexer_list_unresolved_targets':
      case 'indexer_list_recent_files':
      case 'vault_list_view_notes':
        return []
      case 'git_status_cmd': {
        if (window.sessionStorage.getItem('e2e:git-status-failure') === '1') {
          throw new Error('E2E Git bridge unavailable')
        }
        const hasConflicts =
          activeConflictFixture() !== null && !conflictsResolved
        if (committed) {
          return {
            is_repo: true,
            branch: 'main',
            changed_files: [],
            clean: true,
            ahead: 1,
            behind: 0,
            has_upstream: true,
            has_conflicts: false,
            conflicted_files: [],
          }
        }
        return {
          is_repo: true,
          branch: 'main',
          changed_files: hasConflicts
            ? [
                { path: 'Research Plan.md', status: 'M', conflict: false },
                { path: 'Field Notes.md', status: 'U', conflict: true },
              ]
            : [{ path: 'Research Plan.md', status: 'M', conflict: false }],
          clean: false,
          ahead: 0,
          behind: 0,
          has_upstream: true,
          has_conflicts: hasConflicts,
          conflicted_files: hasConflicts ? ['Field Notes.md'] : [],
        }
      }
      case 'authorize_sensitive_operation': {
        const body = payload as { operation?: string; scope?: string | null }
        return {
          token: 'e2e-authorization-token',
          operation: String(body.operation ?? ''),
          scope: body.scope ?? null,
          expiresAtMs: Date.now() + 60_000,
        }
      }
      case 'git_commit_cmd': {
        const body = payload as { files?: string[]; message?: string }
        const files = body.files ?? []
        const message = String(body.message ?? '')
        window.__scriptorE2eGitCommits = [
          ...(window.__scriptorE2eGitCommits ?? []),
          { files, message },
        ]
        committed = true
        return { commit_hash: 'e2ecommit', files_committed: files }
      }
      case 'git_read_conflict_markers_cmd': {
        const path = String((payload as { path?: string }).path ?? 'Field Notes.md')
        if (path === 'Field Notes.md' && activeConflictFixture() !== null) {
          return ['# Conflict markers found', '=======', '>>>>>>> theirs']
        }
        return []
      }
      case 'git_show_head_file_cmd': {
        const path = String((payload as { path?: string }).path ?? '')
        if (path === 'Field Notes.md' && activeConflictFixture() !== null) {
          return '# Field Notes\n\nOurs version of the field notes.\n'
        }
        return null
      }
      case 'git_show_merge_base_file_cmd': {
        const path = String((payload as { path?: string }).path ?? '')
        if (path === 'Field Notes.md' && activeConflictFixture() !== null) {
          return '# Field Notes\n\nBase ancestor version.\n'
        }
        return null
      }
      case 'git_resolve_conflict_cmd': {
        conflictsResolved = true
        const body = payload as { path?: string; strategy?: string }
        return { path: String(body.path ?? ''), strategy: String(body.strategy ?? 'ours') }
      }
      case 'git_apply_merged_conflict_cmd': {
        const body = payload as { path?: string; mergedMarkdown?: string }
        const path = String(body.path ?? '')
        const mergedMarkdown = String(body.mergedMarkdown ?? '')
        window.__scriptorE2eMergedConflict = { path, mergedMarkdown }
        // The resolved file is written back to the vault, so subsequent reads
        // must return the merged text rather than the conflicted fixture.
        e2eSaveNote(path, mergedMarkdown)
        conflictsResolved = true
        return { path, strategy: 'merged' }
      }
      case 'system_info':
        return {
          os: 'Windows',
          arch: 'x86_64',
          app_version: '1.0.0',
          rust_version: 'e2e',
          pandoc_version: '3.1.11',
        }
      case 'export_discover':
        return { path: 'C:/Program Files/Pandoc/pandoc.exe', version: '3.1.11' }
      case 'export_run_markdown':
      case 'export_run_note': {
        const body = payload as {
          notePath?: string
          format?: string
          dryRun?: boolean
          sourceMarkdown?: string
        }
        const notePath = String(body.notePath ?? 'Research Plan.md')
        const format = String(body.format ?? 'html')
        const dryRun = Boolean(body.dryRun)
        const stem = notePath.replace(/\.md$/i, '').split('/').pop() ?? 'note'
        const extension = format === 'html' || format === 'wechat-html' ? 'html' : format
        const artifactPath = `.scriptor/exports/${format}/${stem}.${extension}`
        return {
          job_id: crypto.randomUUID(),
          format,
          artifact_path: artifactPath,
          command: [
            'C:/Program Files/Pandoc/pandoc.exe',
            notePath,
            '-o',
            artifactPath,
            '--citeproc',
          ],
          stdout: '',
          stderr: '',
          duration_ms: dryRun ? 0 : 42,
          dry_run: dryRun,
        }
      }
      case 'vault_read_note_history_revision':
        return '# Previous revision\n'
      case 'reader_read_document':
        return Array.from(new TextEncoder().encode('%PDF-1.4\n%Scriptor E2E fixture\n'))
      case 'reader_load_annotations':
        return []
      case 'reader_save_annotations':
        return undefined
      case 'vault_list_note_history':
        return [
          {
            id: 'rev-1',
            saved_at: '2026-06-23T12:00:00.000Z',
            content_hash: 'hash-prev',
            word_count: 12,
            preview: '# Previous revision',
          },
        ]
      case 'vault_restore_note_history_revision':
        return e2eSaveNote(String((payload as { path?: string }).path ?? 'Research Plan.md'), '# Restored\n')
      case 'vault_read_workspace_session':
        return {
          version: 1,
          active_path: window.localStorage.getItem('e2e:active-path'),
          open_tabs: JSON.parse(window.localStorage.getItem('e2e:open-tabs') ?? '[]'),
          collapsed_folders: JSON.parse(window.localStorage.getItem('e2e:collapsed-folders') ?? '{}'),
          sidebar_view: window.localStorage.getItem('e2e:sidebar-view') ?? 'vault',
        }
      case 'vault_save_workspace_session': {
        const body = payload as {
          active_path?: string | null
          open_tabs?: Array<{ path: string; pinned?: boolean }>
          collapsed_folders?: Record<string, boolean>
          sidebar_view?: string
        }
        window.localStorage.setItem('e2e:active-path', body.active_path ?? '')
        window.localStorage.setItem('e2e:open-tabs', JSON.stringify(body.open_tabs ?? []))
        window.localStorage.setItem(
          'e2e:collapsed-folders',
          JSON.stringify(body.collapsed_folders ?? {}),
        )
        window.localStorage.setItem('e2e:sidebar-view', body.sidebar_view ?? 'vault')
        return undefined
      }
      case 'set_headless_engine':
        return undefined
      case 'health_check':
        return 'ok'
      case 'plugin:path|document_dir':
        return 'C:/Users/e2e/Documents'
      case 'plugin:path|join': {
        const paths = (payload as { paths?: string[] }).paths ?? []
        return paths.join('/')
      }
      default:
        if (cmd.startsWith('canvas_')) {
          if (cmd === 'canvas_list_documents') {
            const document = JSON.parse(canvasDocumentJson) as {
              id: string
              title: string
              updatedAt: string
              blocks: unknown[]
            }
            return (window.__scriptorE2eCanvasSaves?.length ?? 0) > 0
              ? [
                  {
                    id: document.id,
                    title: document.title,
                    updatedAt: document.updatedAt,
                    blockCount: document.blocks.length,
                    path: `.scriptor/canvas/${document.id}.json`,
                  },
                ]
              : []
          }
          if (cmd === 'canvas_load_document') {
            return canvasDocumentJson
          }
          if (cmd === 'canvas_save_document') {
            canvasDocumentJson = String((payload as { sceneJson?: string }).sceneJson ?? canvasDocumentJson)
            window.__scriptorE2eCanvasSaves = [
              ...(window.__scriptorE2eCanvasSaves ?? []),
              canvasDocumentJson,
            ]
            const document = JSON.parse(canvasDocumentJson) as { id: string }
            return `.scriptor/canvas/${document.id}.json`
          }
          if (cmd === 'canvas_query_blocks') return []
          if (cmd === 'canvas_hit_test') return null
          return null
        }
        if (cmd.startsWith('daemon_')) {
          return cmd === 'daemon_ping' ? { version: '1.0.0-e2e' } : null
        }
        return null
    }
  }, { shouldMockEvents: true })

  try {
    const setDefault = (key: string, value: string) => {
      if (window.localStorage.getItem(key) === null) {
        window.localStorage.setItem(key, value)
      }
    }
    // Theme and onboarding are controlled by Playwright init scripts — do not override here.
    setDefault('scriptor:headless-engine', 'false')
    setDefault('scriptor.plugins.safeMode', 'false')
    setDefault('scriptor:editor-mode', 'monaco')
    setDefault('scriptor:editor-theme', 'light')
    if (window.sessionStorage.getItem('scriptor.plugins.safeMode') === null) {
      window.sessionStorage.setItem('scriptor.plugins.safeMode', 'false')
    }
  } catch {
    // ignore storage failures in e2e mode
  }
  installE2eMcpHarness()
}
