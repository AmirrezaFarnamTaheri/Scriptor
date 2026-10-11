export interface OverleafSnapshot { head: string; content: string | null; content_hash: string | null }
export function overleafProjectId(value: string): string {
  const input = value.trim()
  const id = /^[a-zA-Z0-9_-]{6,64}$/.test(input) ? input : /^https:\/\/(?:www\.overleaf\.com\/project\/|git\.overleaf\.com\/)([a-zA-Z0-9_-]{6,64})\/?$/.exec(input)?.[1]
  if (!id) throw new Error('Use an Overleaf Cloud project ID or its official project URL without credentials or query parameters.')
  return id
}
export function overleafFilePath(value: string): string {
  if (value.length > 1024 || /[\\:%\x00-\x1f\x7f]/.test(value) || value.split('/').some(part => !part || part.startsWith('.') || /[. ]$/.test(part)) || !/\.(tex|ltx|bib)$/i.test(value)) throw new Error('Select a literal relative .tex, .ltx or .bib project file without hidden folders or parent paths.')
  return value
}
export function parseOverleafSnapshot(value: unknown): OverleafSnapshot {
  if (!value || typeof value !== 'object') throw new Error('Invalid Overleaf snapshot')
  const item = value as Record<string, unknown>
  if (typeof item.head !== 'string' || !/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(item.head) || !(item.content === null && item.content_hash === null || typeof item.content === 'string' && new TextEncoder().encode(item.content).length <= 2 * 1024 * 1024 && !item.content.includes('\0') && typeof item.content_hash === 'string' && /^[a-f0-9]{64}$/.test(item.content_hash))) throw new Error('Invalid Overleaf snapshot')
  return { head: item.head, content: item.content as string | null, content_hash: item.content_hash as string | null }
}
