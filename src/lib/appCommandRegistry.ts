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
  | 'open-bibliography'
  | 'toggle-split-preview'
  | 'focus-search'
  | 'open-daily-note'
  | 'manage-snippets'
  | 'organize-active-note'
  | 'export-reveal-slides'
  | 'editor-view-source'
  | 'editor-view-split'
  | 'editor-view-rendered'
  | 'toggle-vault-sidebar'
  | 'toggle-inspector'
  | 'delete-active-note'
  | 'open-support'

export interface AppCommandDefinition {
  id: AppCommandId
  label: string
  keywords?: string[]
  shortcut?: string
  run: () => void
}

export function toPaletteCommands(definitions: AppCommandDefinition[]): PaletteCommand[] {
  return definitions.map((definition) => ({
    id: definition.id,
    label: definition.shortcut ? `${definition.label} (${definition.shortcut})` : definition.label,
    run: definition.run,
  }))
}
