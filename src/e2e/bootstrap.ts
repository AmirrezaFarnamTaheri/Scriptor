import { mockIPC } from '@tauri-apps/api/mocks'

import {
  SCREENSHOT_SCAN,
  SCREENSHOT_VAULT,
  screenshotDenseGraph,
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

function activeScanFixture() {
  if (window.sessionStorage.getItem('e2e:large-vault') !== '1') return SCREENSHOT_SCAN
  const generated = Array.from({ length: 600 }, (_, index) => {
    const ordinal = String(index + 1).padStart(4, '0')
    return {
      path: `Generated research note ${ordinal} with an intentionally long filename for truncation and virtualization coverage.md`,
      kind: 'note' as const,
      size_bytes: 512 + index,
      modified_at: '2026-06-23T10:00:00Z',
    }
  })
  return [...SCREENSHOT_SCAN, ...generated]
}

function knowledgeRepairFixture() {
  if (window.sessionStorage.getItem('e2e:knowledge-repair-notes') !== '1') return []
  return [
    {
      path: 'Research Plan.md',
      title: 'Research Plan',
      inbound_links: 12,
      outbound_links: 4,
    },
    {
      path: 'Field Notes.md',
      title: 'Field Notes with an intentionally long title for zoom coverage',
      inbound_links: 0,
      outbound_links: 9,
    },
    {
      path: 'daily/2026-08-26.md',
      title: '2026-08-26',
      inbound_links: 0,
      outbound_links: 0,
    },
  ]
}

function activeNoteSummaries() {
  const inboxFixture = window.sessionStorage.getItem('e2e:inbox-notes') === '1'
  return activeScanFixture().filter((entry) => entry.kind === 'note').map((entry, index) => {
    const doc = e2eNoteDocument(entry.path)
    return {
      path: entry.path,
      title: doc.metadata.title,
      modified_at: entry.modified_at ?? '',
      note_type: null,
      organized: inboxFixture ? index >= 2 : true,
      archived: false,
      tags: doc.metadata.tags,
    }
  })
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
  if (typeof window !== 'undefined' && window.sessionStorage.getItem('e2e:enable-gmail-plugin') === '1') {
    enabledPluginIds.add('scriptor.gmail-manager')
  }
  const populatedCanvasFixture =
    typeof window !== 'undefined' && window.sessionStorage.getItem('e2e:canvas-populated') === '1'
  let canvasDocumentJson = JSON.stringify({
    id: 'canvas-board-default',
    vaultId: 'screenshot-vault',
    title: 'Research board',
    mode: 'edgeless',
    layers: [{ id: 'layer-main', name: 'Main', visible: true, locked: false, order: 0 }],
    blocks: populatedCanvasFixture
      ? [
          { id: 'e2e-question', kind: 'sticky-note', layerId: 'layer-main', bounds: { x: -260, y: -120, width: 180, height: 110 }, zIndex: 1, contentRef: 'Research question', style: { fill: '#fef3c7', stroke: '#334155', strokeWidth: 1 } },
          { id: 'e2e-evidence', kind: 'sticky-note', layerId: 'layer-main', bounds: { x: -30, y: -120, width: 180, height: 110 }, zIndex: 2, contentRef: 'Evidence', style: { fill: '#dbeafe', stroke: '#334155', strokeWidth: 1 } },
          { id: 'e2e-synthesis', kind: 'sticky-note', layerId: 'layer-main', bounds: { x: 200, y: -120, width: 180, height: 110 }, zIndex: 3, contentRef: 'Synthesis', style: { fill: '#dcfce7', stroke: '#334155', strokeWidth: 1 } },
          { id: 'e2e-method', kind: 'markdown', layerId: 'layer-main', bounds: { x: -145, y: 80, width: 220, height: 140 }, zIndex: 4, contentRef: 'Methodology.md', sourceNoteId: 'Methodology.md', style: { fill: '#ffffff', stroke: '#94a3b8', strokeWidth: 1, textStyle: 'heading' } },
          { id: 'e2e-plan', kind: 'markdown', layerId: 'layer-main', bounds: { x: 115, y: 80, width: 220, height: 140 }, zIndex: 5, contentRef: 'Research Plan.md', sourceNoteId: 'Research Plan.md', style: { fill: '#ffffff', stroke: '#0f766e', strokeWidth: 2, textStyle: 'heading' } },
        ]
      : [],
    updatedAt: '2026-09-21T12:00:00.000Z',
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
      case 'google_gmail_get_authed_email':
        if (window.sessionStorage.getItem('e2e:enable-gmail-plugin') === '1') {
          throw new Error('GOOGLE_AUTH_REQUIRED: Gmail is not connected')
        }
        return undefined
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
        const document = e2eNoteDocument(readPath)
        if (
          readPath === 'Research Plan.md'
          && window.sessionStorage.getItem('e2e:frontmatter-populated') === '1'
          && !document.markdown.startsWith('---\n')
        ) {
          const markdown = `---\nproject: Scriptor research\nstatus: active\ntags: research, methods\n---\n\n${document.markdown}`
          return {
            ...document,
            metadata: {
              ...document.metadata,
              content_hash: 'hash-frontmatter-visual-fixture',
              word_count: markdown.split(/\\s+/).filter(Boolean).length,
            },
            markdown,
          }
        }
        return document
      }
      case 'vault_save_note': {
        const body = payload as {
          path?: string
          markdown?: string
          expectedContentHash?: string | null
          expectedVaultId?: string | null
        }
        const path = String(body.path ?? 'Research Plan.md')
        const markdown = String(body.markdown ?? '')
        if (body.expectedVaultId != null && body.expectedVaultId !== 'screenshot-vault') {
          throw new Error(
            `stale save target: note belongs to vault '${body.expectedVaultId}', but active vault is 'screenshot-vault'`,
          )
        }
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
        if (window.sessionStorage.getItem('e2e:snippets-populated') === '1') {
          return [
            {
              name: 'literature-note',
              description: 'Structure a literature finding with its source.',
              content: '## ${1:Finding}\\n\\nSource: ${2:citation}\\n\\n${3:Notes}',
            },
            {
              name: 'method-check',
              description: 'Record a methodology check before synthesis.',
              content: '- Method: ${1:name}\\n- Evidence: ${2:result}',
            },
          ]
        }
        return []
      case 'vault_list_recent_notes':
        return [{ path: 'Research Plan.md', opened_at: '2026-06-23T12:00:00.000Z' }]
      case 'vault_record_recent_note':
        return [{ path: String((payload as { path?: string }).path ?? ''), opened_at: new Date().toISOString() }]
      case 'vault_read_stats_history':
        return [
          { date: '2026-09-15', words: 280 },
          { date: '2026-09-16', words: 460 },
          { date: '2026-09-17', words: 510 },
          { date: '2026-09-18', words: 390 },
          { date: '2026-09-19', words: 620 },
          { date: '2026-09-20', words: 540 },
          { date: '2026-09-21', words: 198 },
        ]
      case 'vault_read_activity_log':
        return []
      case 'vault_append_activity_log':
        return undefined
      case 'vault_scan':
        if (window.sessionStorage.getItem('e2e:slow-vault') === '1') {
          return new Promise<typeof SCREENSHOT_SCAN>((resolve) => {
          window.setTimeout(() => resolve(activeScanFixture()), 2500)
          })
        }
        return activeScanFixture()
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
                activeNoteSummaries(),
              )
          }, 2500)
          })
        }
        return activeNoteSummaries()
      case 'indexer_backlinks':
        return []
      case 'indexer_graph': {
        if (window.sessionStorage.getItem('e2e:dense-graph') === '1') {
          return screenshotDenseGraph()
        }
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
            }, 1500)
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
        return activeNoteSummaries().filter((note) => !note.organized)
      case 'indexer_list_orphans':
      case 'indexer_list_dead_ends':
        return knowledgeRepairFixture()
      case 'indexer_list_unresolved_targets':
      case 'indexer_list_recent_files':
      case 'indexer_execute_dql':
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
      case 'reader_read_document': {
        const relPath = String((payload as { relPath?: string }).relPath ?? '')
        return Array.from(relPath.toLowerCase().endsWith('.epub') ? createMinimalReaderEpub() : createMinimalReaderPdf())
      }
      case 'reader_viewer_location': {
        const documentType = String((payload as { documentType?: string }).documentType ?? 'pdf')
        const filename = documentType === 'epub' ? 'epub-viewer.html' : 'pdf-viewer.html'
        return { url: `/reader/${filename}`, origin: window.location.origin }
      }
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
            return populatedCanvasFixture || (window.__scriptorE2eCanvasSaves?.length ?? 0) > 0
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
          if (cmd === 'canvas_apply_template') {
            const request = payload as { sceneJson?: string; templateId?: string }
            const document = JSON.parse(request.sceneJson ?? canvasDocumentJson) as {
              id: string
              title: string
              blocks: Array<Record<string, unknown>>
              updatedAt: string
            }
            const templateId = request.templateId ?? 'storyboard'
            const added = [
              { id: 'e2e-question', kind: 'sticky-note', layerId: 'layer-main', bounds: { x: 40, y: 40, width: 100, height: 80 }, zIndex: 2, contentRef: 'Question', style: { fill: '#fef3c7', stroke: '#334155', strokeWidth: 1 } },
              { id: 'e2e-evidence', kind: 'sticky-note', layerId: 'layer-main', bounds: { x: 220, y: 40, width: 100, height: 80 }, zIndex: 2, contentRef: 'Evidence', style: { fill: '#dbeafe', stroke: '#334155', strokeWidth: 1 } },
              { id: 'e2e-synthesis', kind: 'sticky-note', layerId: 'layer-main', bounds: { x: 400, y: 40, width: 100, height: 80 }, zIndex: 2, contentRef: 'Synthesis', style: { fill: '#dcfce7', stroke: '#334155', strokeWidth: 1 } },
              { id: 'e2e-summary', kind: 'markdown', layerId: 'layer-main', bounds: { x: 140, y: 220, width: 280, height: 160 }, zIndex: 3, contentRef: 'Summary note', style: { fill: '#ffffff', stroke: '#94a3b8', strokeWidth: 1, textStyle: 'heading' } },
            ]
            const next = { ...document, title: templateId, blocks: [...document.blocks, ...added], updatedAt: new Date().toISOString() }
            return {
              document: next,
              templateId,
              patchId: 'e2e-template-patch',
              checkpointPath: '.scriptor/checkpoints/e2e-template.json',
              blocksAdded: added.length,
            }
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
    if (window.sessionStorage.getItem('scriptor.plugins.safeMode') === null) {
      window.sessionStorage.setItem('scriptor.plugins.safeMode', 'false')
    }
  } catch {
    // ignore storage failures in e2e mode
  }
  installE2eMcpHarness()
}

function createMinimalReaderPdf(): Uint8Array {
  const encoder = new TextEncoder()
  const stream = [
    'BT /F1 24 Tf 54 724 Td (Scriptor Reader) Tj ET',
    'BT /F1 14 Tf 54 684 Td (Deterministic portrait PDF fixture for visual review.) Tj ET',
    'BT /F1 14 Tf 54 656 Td (The reader must preserve the full page and support vertical inspection.) Tj ET',
    'BT /F1 14 Tf 54 72 Td (End of reader fixture.) Tj ET',
    '',
  ].join('\n')
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${encoder.encode(stream).length} >>\nstream\n${stream}endstream`,
  ]
  let source = '%PDF-1.4\n%âãÏÓ\n'
  const offsets = [0]
  for (let index = 0; index < objects.length; index += 1) {
    offsets.push(encoder.encode(source).length)
    source += `${index + 1} 0 obj\n${objects[index]}\nendobj\n`
  }
  const xrefOffset = encoder.encode(source).length
  source += `xref\n0 ${objects.length + 1}\n`
  source += '0000000000 65535 f \n'
  for (const offset of offsets.slice(1)) {
    source += `${String(offset).padStart(10, '0')} 00000 n \n`
  }
  source += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`
  return encoder.encode(source)
}

function appendZipU16(target: number[], value: number) {
  target.push(value & 0xff, (value >>> 8) & 0xff)
}

function appendZipU32(target: number[], value: number) {
  target.push(value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff, (value >>> 24) & 0xff)
}

function appendZipBytes(target: number[], bytes: Uint8Array) {
  for (const byte of bytes) target.push(byte)
}

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff
  for (const byte of bytes) {
    crc ^= byte
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0)
    }
  }
  return (crc ^ 0xffffffff) >>> 0
}

function createStoredZip(entries: readonly { name: string; body: string }[]): Uint8Array {
  const encoder = new TextEncoder()
  const local: number[] = []
  const central: number[] = []

  for (const entry of entries) {
    const name = encoder.encode(entry.name)
    const body = encoder.encode(entry.body)
    const checksum = crc32(body)
    const localOffset = local.length

    appendZipU32(local, 0x04034b50)
    appendZipU16(local, 20)
    appendZipU16(local, 0)
    appendZipU16(local, 0)
    appendZipU16(local, 0)
    appendZipU16(local, 0)
    appendZipU32(local, checksum)
    appendZipU32(local, body.length)
    appendZipU32(local, body.length)
    appendZipU16(local, name.length)
    appendZipU16(local, 0)
    appendZipBytes(local, name)
    appendZipBytes(local, body)

    appendZipU32(central, 0x02014b50)
    appendZipU16(central, 20)
    appendZipU16(central, 20)
    appendZipU16(central, 0)
    appendZipU16(central, 0)
    appendZipU16(central, 0)
    appendZipU16(central, 0)
    appendZipU32(central, checksum)
    appendZipU32(central, body.length)
    appendZipU32(central, body.length)
    appendZipU16(central, name.length)
    appendZipU16(central, 0)
    appendZipU16(central, 0)
    appendZipU16(central, 0)
    appendZipU16(central, 0)
    appendZipU32(central, 0)
    appendZipU32(central, localOffset)
    appendZipBytes(central, name)
  }

  const centralOffset = local.length
  const output = [...local, ...central]
  appendZipU32(output, 0x06054b50)
  appendZipU16(output, 0)
  appendZipU16(output, 0)
  appendZipU16(output, entries.length)
  appendZipU16(output, entries.length)
  appendZipU32(output, central.length)
  appendZipU32(output, centralOffset)
  appendZipU16(output, 0)
  return Uint8Array.from(output)
}

function createMinimalReaderEpub(): Uint8Array {
  return createStoredZip([
    { name: 'mimetype', body: 'application/epub+zip' },
    {
      name: 'META-INF/container.xml',
      body: '<?xml version="1.0" encoding="UTF-8"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>',
    },
    {
      name: 'OEBPS/content.opf',
      body: '<?xml version="1.0" encoding="UTF-8"?><package version="3.0" unique-identifier="bookid" xmlns="http://www.idpf.org/2007/opf"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="bookid">scriptor-e2e</dc:identifier><dc:title>Scriptor Reader EPUB</dc:title><dc:language>en</dc:language><meta property="dcterms:modified">2026-09-20T00:00:00Z</meta></metadata><manifest><item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/><item id="chapter" href="chapter.xhtml" media-type="application/xhtml+xml"/></manifest><spine><itemref idref="chapter"/></spine></package>',
    },
    {
      name: 'OEBPS/nav.xhtml',
      body: '<?xml version="1.0" encoding="UTF-8"?><html xmlns="http://www.w3.org/1999/xhtml"><head><title>Contents</title></head><body><nav xmlns:epub="http://www.idpf.org/2007/ops" epub:type="toc"><ol><li><a href="chapter.xhtml">Reader fixture</a></li></ol></nav></body></html>',
    },
    {
      name: 'OEBPS/chapter.xhtml',
      body: '<?xml version="1.0" encoding="UTF-8"?><html xmlns="http://www.w3.org/1999/xhtml"><head><title>Scriptor Reader EPUB</title></head><body><h1>Scriptor Reader EPUB</h1><p>Deterministic EPUB fixture for visual review.</p><p>This chapter verifies that the bundled EPUB reader renders real publication content instead of PDF bytes.</p></body></html>',
    },
  ])
}
