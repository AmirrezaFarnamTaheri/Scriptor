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
  { id: 'open-reader', label: 'Open reader' },
  { id: 'open-tasks', label: 'Open tasks panel' },
  { id: 'open-kanban', label: 'Open kanban board' },
  { id: 'open-knowledge-workbench', label: 'Open knowledge workbench', defaultShortcut: 'Alt+K' },
  { id: 'reopen-closed-tab', label: 'Reopen closed tab', defaultShortcut: 'Ctrl+Shift+T' },
  { id: 'open-note-history', label: 'Note history timeline', defaultShortcut: 'Ctrl+Alt+H' },
  { id: 'focus-search', label: 'Focus vault search', defaultShortcut: 'F' },
  { id: 'open-settings', label: 'Open settings' },
  { id: 'open-git', label: 'Open Git panel', defaultShortcut: 'Mod+Alt+G' },
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
  { id: 'toggle-vault-sidebar', label: 'Toggle vault sidebar', defaultShortcut: 'Mod+Alt+B' },
  { id: 'toggle-inspector', label: 'Toggle inspector', defaultShortcut: 'Mod+Alt+L' },
  { id: 'delete-active-note', label: 'Delete active note' },
  { id: 'insert-footnote', label: 'Insert footnote reference' },
  { id: 'rebuild-index', label: 'Rebuild index' },
  { id: 'generate-link-references', label: 'Generate Foam link references' },
  { id: 'lint-vault', label: 'Refresh vault lint' },
  { id: 'fix-vault-lint', label: 'Fix vault lint issues' },
  { id: 'organize-active-note', label: 'Mark active note organized' },
  { id: 'toggle-perf-hud', label: 'Toggle performance HUD' },
  { id: 'toggle-distraction-free', label: 'Toggle distraction-free mode', defaultShortcut: 'Mod+Shift+F' },
  { id: 'toggle-typewriter-mode', label: 'Toggle typewriter / focus mode', defaultShortcut: 'Mod+Shift+Y' },
  { id: 'open-templates', label: 'New note from template', defaultShortcut: 'Alt+T' },
  { id: 'import-obsidian-vault', label: 'Import Obsidian vault' },
  { id: 'toggle-breadcrumbs', label: 'Toggle document breadcrumbs', defaultShortcut: 'Alt+B' },
  { id: 'open-quick-capture-window', label: 'Open quick capture window' },
  { id: 'resolve-doi', label: 'Resolve DOI / arXiv / ISBN metadata' },
  { id: 'summarize-section', label: 'Summarize current section (AI)' },
  { id: 'export-audit-log', label: 'Export audit log' },
]

/** Returns the canonical default shortcut for a registered command, when assigned. */
export function getDefaultShortcut(commandId: string): string | undefined {
  return COMMAND_SHORTCUT_REGISTRY.find((entry) => entry.id === commandId)?.defaultShortcut
}
