import type { PaletteCommand } from '../components/CommandPalette'

export type AppCommandId =
  | 'open-inbox'
  | 'open-vault'
  | 'rebuild-index'
  | 'generate-link-references'
  | 'lint-vault'
  | 'fix-vault-lint'
  | 'open-graph'
  | 'open-canvas'
  | 'open-reader'
  | 'open-tasks'
  | 'open-kanban'
  | 'open-git'
  | 'open-health'
  | 'open-mcp'
  | 'open-settings'
  | 'open-knowledge-workbench'
  | 'open-publish-center'
  | 'open-tags'
  | 'open-filters'
  | 'open-saved-views'
  | 'open-smart-collections'
  | 'reopen-closed-tab'
  | 'open-cheatsheet'
  | 'open-portal'
  | 'open-quick-capture'
  | 'open-note-history'
  | 'open-bibliography'
  | 'toggle-split-preview'
  | 'focus-search'
  | 'open-daily-note'
  | 'manage-snippets'
  | 'open-templates'
  | 'import-obsidian-vault'
  | 'organize-active-note'
  | 'export-reveal-slides'
  | 'editor-view-source'
  | 'editor-view-split'
  | 'editor-view-rendered'
  | 'toggle-vault-sidebar'
  | 'toggle-inspector'
  | 'delete-active-note'
  | 'open-support'
  | 'insert-footnote'
  | 'toggle-perf-hud'
  | 'toggle-hibernate-graph'
  | 'toggle-hibernate-mcp'
  | 'toggle-hibernate-watcher'
  | 'toggle-hibernate-git'
  | 'toggle-hibernate-spellcheck'
  | 'open-plugin-manager'
  | 'open-gmail-manager'

export interface AppCommandDefinition {
  id: AppCommandId
  label: string
  keywords?: string[]
  shortcut?: string
  run: () => void
}

function categoryForCommand(id: AppCommandId): string {
  if (id === 'delete-active-note') return 'Note'
  if (id.startsWith('editor-') || id === 'insert-footnote' || id === 'organize-active-note') return 'Editor'
  if (id.startsWith('toggle-')) return 'Workspace'
  if (id.startsWith('export-') || id === 'open-publish-center') return 'Export'
  if (['rebuild-index', 'generate-link-references', 'lint-vault', 'fix-vault-lint'].includes(id)) return 'Maintenance'
  if (id === 'focus-search') return 'Search'
  if (id.startsWith('open-') || id === 'reopen-closed-tab' || id === 'manage-snippets' || id === 'import-obsidian-vault') return 'Open'
  return 'Command'
}

function toneForCommand(id: AppCommandId): PaletteCommand['tone'] {
  if (id === 'delete-active-note') return 'danger'
  if (['rebuild-index', 'generate-link-references', 'lint-vault', 'fix-vault-lint'].includes(id)) return 'maintenance'
  return 'default'
}

export function toPaletteCommands(definitions: AppCommandDefinition[]): PaletteCommand[] {
  return definitions.map((definition) => ({
    id: definition.id,
    label: definition.label,
    keywords: definition.keywords,
    shortcut: definition.shortcut,
    category: categoryForCommand(definition.id),
    tone: toneForCommand(definition.id),
    run: definition.run,
  }))
}
