import { mockIPC } from '@tauri-apps/api/mocks'

import {
  SCREENSHOT_SCAN,
  SCREENSHOT_VAULT,
  SCREENSHOT_VAULT_ROOT,
  screenshotGraph,
  screenshotHealthDiagnostics,
  screenshotNoteDocument,
  screenshotRebuildSummary,
} from './fixture.ts'

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

export function installScreenshotBridge(): void {
  mockIPC((cmd, payload) => {
    switch (cmd) {
      case 'vault_open':
        return { vault: SCREENSHOT_VAULT, scan_job_id: 'screenshot-scan' }
      case 'vault_scan':
        return SCREENSHOT_SCAN
      case 'vault_read_note':
        return screenshotNoteDocument(String((payload as { path?: string }).path ?? 'Research Plan.md'))
      case 'vault_load_config':
        return DEFAULT_CONFIG
      case 'vault_load_snippets':
        return []
      case 'vault_list_recent_notes':
        return [{ path: 'Research Plan.md', opened_at: '2026-06-23T12:00:00.000Z' }]
      case 'vault_record_recent_note':
        return [{ path: String((payload as { path?: string }).path ?? ''), opened_at: new Date().toISOString() }]
      case 'indexer_rebuild':
        return screenshotRebuildSummary()
      case 'indexer_health_diagnostics':
        return JSON.stringify(screenshotHealthDiagnostics())
      case 'vault_health':
        return JSON.stringify(screenshotHealthDiagnostics().summary)
      case 'indexer_list_note_summaries':
        return SCREENSHOT_SCAN.filter((entry) => entry.kind === 'note').map((entry) => {
          const doc = screenshotNoteDocument(entry.path)
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
      case 'indexer_search':
        return []
      case 'indexer_update_note':
        return true
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
      case 'git_status_cmd':
        return {
          is_repo: true,
          branch: 'main',
          changed_files: [{ path: 'Research Plan.md', status: 'M', conflict: false }],
          clean: false,
          ahead: 0,
          behind: 0,
          has_upstream: true,
          has_conflicts: false,
          conflicted_files: [],
        }
      case 'system_info':
        return {
          os: 'Windows',
          arch: 'x86_64',
          app_version: '0.1.0',
          rust_version: 'screenshot',
          pandoc_version: null,
        }
      case 'export_discover':
        return { path: 'C:/Program Files/Pandoc/pandoc.exe', version: '3.1.11' }
      case 'health_check':
        return 'ok'
      default:
        if (cmd.startsWith('daemon_')) {
          return cmd === 'daemon_ping' ? { version: '0.1.0-screenshot' } : null
        }
        return null
    }
  }, { shouldMockEvents: true })

  try {
    window.localStorage.setItem('scriptor:app-theme', 'light')
    window.localStorage.setItem('scriptor:headless-engine', 'false')
    window.localStorage.setItem('scriptor.plugins.safeMode', 'false')
    window.localStorage.setItem('scriptor:editor-mode', 'monaco')
    window.localStorage.setItem('scriptor:editor-theme', 'light')
    window.sessionStorage.setItem('scriptor.plugins.safeMode', 'false')
  } catch {
    // ignore storage failures in screenshot mode
  }

  void SCREENSHOT_VAULT_ROOT
}
