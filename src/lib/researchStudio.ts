import type { BibliographyEntry } from '../types/vault.ts'

export type DiagramLanguage = 'mermaid' | 'plantuml'

export function diagramDocument(language: DiagramLanguage, source: string): string {
  if (!['mermaid', 'plantuml'].includes(language)) throw new Error('Unsupported diagram language')
  if (new TextEncoder().encode(source).length > 65_536) throw new Error('Diagram source exceeds 64 KiB')
  if (!source.trim()) throw new Error('Enter diagram source')
  if (/^\s*`{3,}/m.test(source)) throw new Error('Diagram source must not contain a Markdown fence')
  return `\`\`\`${language}\n${source}\n\`\`\`\n`
}

export function assetLink(path: string): string {
  if (!path || /^[a-zA-Z][a-zA-Z\d+.-]*:/.test(path) || path.startsWith('/') || path.startsWith('\\') || path.split(/[\\/]/).some((segment) => !segment || segment === '.' || segment === '..') || /[\r\n\0<>]/.test(path)) {
    throw new Error('Asset path must be vault relative')
  }
  return `<${path.replace(/\\/g, '/').replace(/ /g, '%20')}>`
}

export function annotationDocument(path: string, annotation: { quote: string; body: string; anchor: string; id: string }): string {
  if (annotation.quote.length + annotation.body.length + annotation.anchor.length > 65_536) throw new Error('Annotation exceeds 64 KiB')
  return `---\nsource_asset: ${JSON.stringify(path)}\nreader_anchor: ${JSON.stringify(annotation.anchor)}\nannotation_id: ${JSON.stringify(annotation.id)}\n---\n\n[Source](${assetLink(path)})\n\n${annotation.quote.split(/\r?\n/).map((line) => `> ${line}`).join('\n')}\n\n${annotation.body}\n`
}

export function referenceDocument(entry: BibliographyEntry): string {
  if (!/^[\w:./#$-]+$/.test(entry.key)) throw new Error('Unsupported citation key')
  const title = entry.title.replace(/[\r\n]/g, ' ').slice(0, 2_000)
  return `---\ncitation_key: ${JSON.stringify(entry.key)}\nbibliography_source: ${JSON.stringify(entry.source_path)}\n---\n\n# ${title}\n\n[@${entry.key}]\n\n${entry.author ?? ''}${entry.year ? ` (${entry.year})` : ''}\n\n## Evidence\n\n## Notes\n`
}

export function revisionActivity(rows: Array<{ saved_at: string }>): Array<{ date: string; count: number }> {
  const days = new Map<string, number>()
  for (const row of rows.slice(0, 1_000)) {
    const date = new Date(row.saved_at)
    if (Number.isNaN(date.getTime())) continue
    const key = date.toISOString().slice(0, 10)
    days.set(key, (days.get(key) ?? 0) + 1)
  }
  return [...days].sort(([a], [b]) => a.localeCompare(b)).map(([date, count]) => ({ date, count }))
}
