import type { AppCommandId } from './appCommandRegistry'

export interface CommandShortcutEntry {
  id: AppCommandId | string
  label: string
  defaultShortcut?: string
}

export const COMMAND_SHORTCUT_REGISTRY: CommandShortcutEntry[] = [
  { id: 'open-inbox', label: 'Open inbox', defaultShortcut: 'Alt+I' },
  { id: 'open-daily-note', label: "Open today's daily note", defaultShortcut: 'Alt+D' },
  { id: 'manage-snippets', label: 'Manage snippet catalog', defaultShortcut: 'Alt+S' },
  { id: 'open-vault', label: 'Open vault', defaultShortcut: 'Alt+O' },
  { id: 'open-graph', label: 'Open graph', defaultShortcut: 'Alt+G' },
  { id: 'open-canvas', label: 'Open canvas', defaultShortcut: 'Alt+C' },
  { id: 'open-knowledge-workbench', label: 'Open knowledge workbench', defaultShortcut: 'Alt+K' },
  { id: 'reopen-closed-tab', label: 'Reopen closed tab', defaultShortcut: 'Ctrl+Shift+T' },
  { id: 'open-note-history', label: 'Note history timeline', defaultShortcut: 'Ctrl+Alt+H' },
  { id: 'focus-search', label: 'Focus vault search', defaultShortcut: 'F' },
  { id: 'open-settings', label: 'Open settings' },
  { id: 'open-git', label: 'Open Git panel' },
  { id: 'open-health', label: 'Open vault health' },
  { id: 'open-mcp', label: 'Open MCP panel' },
  { id: 'open-publish-center', label: 'Open publish center' },
  { id: 'open-tags', label: 'Browse tags' },
  { id: 'open-filters', label: 'Knowledge repair queue' },
  { id: 'open-saved-views', label: 'Saved views' },
  { id: 'open-smart-collections', label: 'Smart collections (DQL)' },
  { id: 'open-cheatsheet', label: 'Markdown cheatsheet' },
  { id: 'open-support', label: 'Support Scriptor' },
  { id: 'open-portal', label: 'Open portal clipboard' },
  { id: 'open-quick-capture', label: 'Quick capture' },
  { id: 'open-bibliography', label: 'Browse bibliography' },
  { id: 'toggle-split-preview', label: 'Toggle split preview' },
  { id: 'editor-view-source', label: 'Editor view: source only' },
  { id: 'editor-view-split', label: 'Editor view: split' },
  { id: 'editor-view-rendered', label: 'Editor view: rendered' },
  { id: 'toggle-vault-sidebar', label: 'Toggle vault sidebar' },
  { id: 'toggle-inspector', label: 'Toggle inspector' },
  { id: 'delete-active-note', label: 'Delete active note' },
  { id: 'insert-footnote', label: 'Insert footnote reference' },
  { id: 'rebuild-index', label: 'Rebuild index' },
  { id: 'generate-link-references', label: 'Generate Foam link references' },
  { id: 'lint-vault', label: 'Refresh vault lint' },
  { id: 'fix-vault-lint', label: 'Fix vault lint issues' },
  { id: 'organize-active-note', label: 'Mark active note organized' },
  { id: 'toggle-perf-hud', label: 'Toggle performance HUD' },
]
