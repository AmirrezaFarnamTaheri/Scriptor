import type { ScannedEntry } from '../../types/vault'

import { previewDailyTokens } from './dailyNote.ts'

export interface TemplateDefinition {
  name: string
  path: string
}

export function discoverTemplatePaths(
  entries: ScannedEntry[],
  templatesDirectory = '.scriptor/templates',
): TemplateDefinition[] {
  const prefix = `${templatesDirectory.replace(/\/$/, '')}/`
  return entries
    .filter((entry) => entry.kind === 'note' && entry.path.startsWith(prefix) && entry.path.endsWith('.md'))
    .map((entry) => {
      const relative = entry.path.slice(prefix.length).replace(/\.md$/i, '')
      const name = relative.split('/').pop() ?? relative
      return { name, path: entry.path }
    })
    .sort((left, right) => left.name.localeCompare(right.name))
}

export function planDailyNotePreview(
  config: { directory: string; filename_format: string; title_format: string },
  isoDate: string,
): { path: string; title: string } {
  const stem = previewDailyTokens(config.filename_format, isoDate)
  const title = previewDailyTokens(config.title_format, isoDate)
  const directory = config.directory.replace(/\/$/, '')
  return {
    path: `${directory}/${stem}.md`,
    title,
  }
}
