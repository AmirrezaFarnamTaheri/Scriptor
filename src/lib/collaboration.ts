export interface SharedRevision {
  schema: 'scriptor.collaboration.v1'
  id: string
  document: string
  peer_id: string
  base_markdown: string
  markdown: string
  created_at: string
}

const fields = ['schema', 'id', 'document', 'peer_id', 'base_markdown', 'markdown', 'created_at']
const identity = /^[A-Za-z0-9_-]{1,200}$/
/** An initial share has no common ancestor. Using its own content as the base
 * would classify every incoming first share as an unchanged remote revision. */
export function sharedRevisionBase(known: { path: string; markdown: string } | null, path: string): string {
  return known?.path === path ? known.markdown : ''
}

export interface CollaborationMapping { schema: 'scriptor.collaboration.mapping.v1'; vaultId: string; folderId: string; path: string; peerId: string; markdown: string }
export function collaborationMappingKey(vaultId: string, folderId: string, path: string): string {
  return `scriptor:collaboration:${JSON.stringify([vaultId, folderId, path])}`
}
export function parseCollaborationMapping(raw: string, vaultId: string, folderId: string, path: string): CollaborationMapping {
  if (raw.length > 2 * 1024 * 1024) throw new Error('Saved collaboration mapping exceeds its limit')
  const value: unknown = JSON.parse(raw)
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid saved collaboration mapping')
  const item = value as Record<string, unknown>
  if (Object.keys(item).length !== 6 || item.schema !== 'scriptor.collaboration.mapping.v1' || item.vaultId !== vaultId || item.folderId !== folderId || item.path !== path
    || typeof item.peerId !== 'string' || !identity.test(item.peerId) || typeof item.markdown !== 'string' || new TextEncoder().encode(item.markdown).length > 1_572_864) throw new Error('Saved collaboration mapping does not match this note and folder')
  parseSharedRevision({ schema: 'scriptor.collaboration.v1', id: 'mapping-validation', document: path, peer_id: item.peerId, base_markdown: '', markdown: item.markdown, created_at: '2026-01-01T00:00:00Z' })
  return item as unknown as CollaborationMapping
}
export function parseSharedRevision(value: unknown): SharedRevision {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid shared revision')
  const record = value as Record<string, unknown>
  if (Object.keys(record).length !== fields.length || fields.some(key => typeof record[key] !== 'string')) throw new Error('Invalid shared revision fields')
  const result = record as unknown as SharedRevision
  if (result.schema !== 'scriptor.collaboration.v1' || !identity.test(result.id) || !identity.test(result.peer_id)
    || result.document.length > 1024 || !result.document.endsWith('.md') || /[\\\x00-\x1f:]/.test(result.document)
    || result.document.split('/').some(part => !part || part === '.' || part === '..')
    || result.created_at.length > 64 || !Number.isFinite(Date.parse(result.created_at))
    || new TextEncoder().encode(result.base_markdown + result.markdown).length > 3 * 1024 * 1024) {
    throw new Error('Invalid or oversized shared revision')
  }
  return result
}

/** A conservative three-way merge: separated edit spans merge, overlaps retain all three versions. */
export function mergeSharedRevision(base: string, local: string, remote: string): { markdown: string; conflict: boolean } {
  if (local === remote || remote === base) return { markdown: local, conflict: false }
  if (local === base) return { markdown: remote, conflict: false }
  const edit = (next: string) => {
    let start = 0
    while (start < base.length && start < next.length && base[start] === next[start]) start++
    let end = base.length, nextEnd = next.length
    while (end > start && nextEnd > start && base[end - 1] === next[nextEnd - 1]) { end--; nextEnd-- }
    return { start, end, text: next.slice(start, nextEnd) }
  }
  const a = edit(local), b = edit(remote)
  const ordered = a.start < b.start ? [a, b] : [b, a]
  if (ordered[0].end <= ordered[1].start && ordered[0].start !== ordered[1].start) {
    return { markdown: base.slice(0, ordered[0].start) + ordered[0].text + base.slice(ordered[0].end, ordered[1].start)
      + ordered[1].text + base.slice(ordered[1].end), conflict: false }
  }
  return { markdown: `<<<<<<< Local\n${local}\n||||||| Shared base\n${base}\n=======\n${remote}\n>>>>>>> Shared revision\n`, conflict: true }
}

export function hasUnresolvedSharedConflict(markdown: string): boolean {
  return /^(?:<<<<<<< Local|\|\|\|\|\|\|\| Shared base|>>>>>>> Shared revision)$/m.test(markdown)
}
