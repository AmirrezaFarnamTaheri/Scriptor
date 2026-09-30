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
export function parseSharedRevision(value: unknown): SharedRevision {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid shared revision')
  const record = value as Record<string, unknown>
  if (Object.keys(record).length !== fields.length || fields.some(key => typeof record[key] !== 'string')) throw new Error('Invalid shared revision fields')
  const result = record as unknown as SharedRevision
  if (result.schema !== 'scriptor.collaboration.v1' || !identity.test(result.id) || !identity.test(result.peer_id)
    || result.document.length > 1024 || !result.document.endsWith('.md') || /[\\\0:]/.test(result.document)
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
