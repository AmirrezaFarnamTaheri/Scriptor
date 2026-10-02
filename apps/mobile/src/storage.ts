export interface Metadata { path: string; title: string; content_hash: string }
export interface Note { markdown: string; metadata: Metadata }
export interface Draft { markdown: string; baseHash: string }
export interface PdfExport { saved: boolean; filename: string; page_count: number; warnings: string[] }

export function parsePdfExport(value: unknown): PdfExport {
  const item = record(value)
  const filename = string(item.filename)
  if (typeof item.saved !== 'boolean' || filename.length > 1024 || !/^[^/\\:\u0000-\u001f]+\.pdf$/u.test(filename)
    || typeof item.page_count !== 'number' || !Number.isInteger(item.page_count) || item.page_count < 1 || item.page_count > 256
    || !Array.isArray(item.warnings) || item.warnings.length > 4) throw new Error('Invalid PDF export response')
  const warnings = item.warnings.map(value => { const text = string(value); if (text.length > 4096) throw new Error('Invalid PDF warning'); return text })
  return { saved: item.saved, filename, page_count: item.page_count, warnings }
}

export function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid native response')
  return value as Record<string, unknown>
}
export function string(value: unknown): string {
  if (typeof value !== 'string') throw new Error('Invalid native text')
  return value
}
export function parseMetadata(value: unknown): Metadata {
  const item = record(value)
  return { path: string(item.path), title: string(item.title), content_hash: string(item.content_hash) }
}
export function parseNote(value: unknown): Note {
  const item = record(value)
  return { markdown: string(item.markdown), metadata: parseMetadata(item.metadata) }
}
export function parseSearch(value: unknown): { notes: Metadata[]; truncated: boolean } {
  const item = record(value)
  if (!Array.isArray(item.notes) || typeof item.truncated !== 'boolean') throw new Error('Invalid search results')
  return { notes: item.notes.map(parseMetadata), truncated: item.truncated }
}
export function parseDraft(raw: string | null): Draft | null {
  if (!raw) return null
  try {
    const item = record(JSON.parse(raw))
    const markdown = string(item.markdown)
    const baseHash = string(item.baseHash)
    return markdown.length <= 2 * 1024 * 1024 && baseHash ? { markdown, baseHash } : null
  } catch { return null }
}
export function draftKey(path: string): string { return `scriptor-mobile:draft:${path}` }
