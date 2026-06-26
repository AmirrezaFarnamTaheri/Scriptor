import type { NoteDocument, SearchHit } from '../types/vault'
import { SCREENSHOT_SCAN, SCREENSHOT_VAULT, screenshotNoteDocument } from '../screenshot/fixture.ts'

const noteBodies = new Map<string, string>()

for (const entry of SCREENSHOT_SCAN) {
  if (entry.kind === 'note') {
    noteBodies.set(entry.path, screenshotNoteDocument(entry.path).markdown)
  }
}

function contentHash(markdown: string): string {
  let hash = 0
  for (let i = 0; i < markdown.length; i += 1) {
    hash = (Math.imul(31, hash) + markdown.charCodeAt(i)) >>> 0
  }
  return `hash-${hash.toString(16)}`
}

export function e2eNoteDocument(path: string): NoteDocument {
  const base = screenshotNoteDocument(path)
  const markdown = noteBodies.get(path) ?? base.markdown
  return {
    metadata: {
      ...base.metadata,
      content_hash: contentHash(markdown),
      word_count: markdown.split(/\s+/).filter(Boolean).length,
    },
    markdown,
  }
}

export function e2eSaveNote(path: string, markdown: string) {
  noteBodies.set(path, markdown)
  const doc = e2eNoteDocument(path)
  return {
    metadata: doc.metadata,
    dry_run: false,
  }
}

export function e2eSearchNotes(query: string, limit: number): SearchHit[] {
  const needle = query.trim().toLowerCase()
  if (!needle) return []

  const hits: SearchHit[] = []
  for (const entry of SCREENSHOT_SCAN) {
    if (entry.kind !== 'note') continue
    const doc = e2eNoteDocument(entry.path)
    const haystack = `${doc.metadata.title}\n${doc.markdown}`.toLowerCase()
    if (!haystack.includes(needle)) continue
    const index = haystack.indexOf(needle)
    const snippet = doc.markdown.slice(Math.max(0, index - 24), index + needle.length + 48).trim()
    hits.push({
      note_id: doc.metadata.id,
      path: entry.path,
      title: doc.metadata.title,
      snippet,
    })
  }

  return hits.slice(0, limit)
}

export { SCREENSHOT_SCAN, SCREENSHOT_VAULT }
