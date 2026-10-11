import type { BibliographyEntry } from '../types/vault.ts'

export type DiagramLanguage = 'mermaid' | 'plantuml' | 'dot'

export function diagramDocument(language: DiagramLanguage, source: string, notePaths: string[] = []): string {
  if (!['mermaid', 'plantuml', 'dot'].includes(language)) throw new Error('Unsupported diagram language')
  if (new TextEncoder().encode(source).length > 65_536) throw new Error('Diagram source exceeds 64 KiB')
  if (!source.trim()) throw new Error('Enter diagram source')
  if (/^\s*`{3,}/m.test(source)) throw new Error('Diagram source must not contain a Markdown fence')
  if (notePaths.length > 100) throw new Error('A diagram can link at most 100 notes')
  for (const path of notePaths) {
    assetLink(path)
    if (path.length > 1024 || !path.endsWith('.md') || /[[\]#|]/.test(path)) throw new Error('Diagram note links must be vault-relative Markdown paths')
  }
  const related = [...new Set(notePaths)]
  return `\`\`\`${language}\n${source}\n\`\`\`\n${related.length ? `\nRelated notes:\n${related.map(path => `- [[${path}]]`).join('\n')}\n` : ''}`
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

/** Counts retained revisions only; empty cells mean no retained save for that day. */
export function revisionHeatmap(rows: Array<{ saved_at: string }>, maximumDays = 364): Array<{ date: string; count: number }> {
  if (!Number.isInteger(maximumDays) || maximumDays < 1 || maximumDays > 364) throw new Error('Activity coverage must be between 1 and 364 days')
  const activity = revisionActivity(rows)
  if (!activity.length) return []
  const counts = new Map(activity.map(day => [day.date, day.count]))
  const last = Date.parse(activity.at(-1)!.date + 'T00:00:00Z')
  const earliest = Math.max(Date.parse(activity[0].date + 'T00:00:00Z'), last - (maximumDays - 1) * 86_400_000)
  const weekday = new Date(earliest).getUTCDay()
  const monday = earliest - ((weekday + 6) % 7) * 86_400_000
  const cells = []
  for (let timestamp = monday; timestamp <= last; timestamp += 86_400_000) {
    const date = new Date(timestamp).toISOString().slice(0, 10)
    cells.push({ date, count: counts.get(date) ?? 0 })
  }
  return cells
}

export function vocabularyMetrics(markdown: string): { words: number; uniqueWords: number; diversity: number | null } {
  if (markdown.length > 3 * 1024 * 1024 || new TextEncoder().encode(markdown).byteLength > 3 * 1024 * 1024) throw new Error('Vocabulary analysis is limited to 3 MiB of source text')
  const words = markdown.normalize('NFC').toLowerCase().match(/[\p{L}\p{N}]+(?:(?:['-]|\u200c|\u200d)[\p{L}\p{N}]+)*/gu) ?? []
  const uniqueWords = new Set(words).size
  return { words: words.length, uniqueWords, diversity: words.length ? uniqueWords / words.length : null }
}
