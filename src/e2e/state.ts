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

function noteStem(path: string): string {
  return path.replace(/\.md$/i, '').split('/').pop() ?? path
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Match `[[Stem]]`, `[[Stem|alias]]` and `[[Stem#heading]]` for a single stem.
 * Deliberately narrow — the fixture vault only uses plain stem wikilinks.
 */
function wikilinkPattern(stem: string): RegExp {
  return new RegExp(`\\[\\[${escapeRegExp(stem)}((?:\\||#)[^\\]]*)?\\]\\]`, 'g')
}

function countWikilinks(markdown: string, stem: string): number {
  return markdown.match(wikilinkPattern(stem))?.length ?? 0
}

export function e2eListNotePaths(): string[] {
  return [...noteBodies.keys()]
}

/**
 * Preview a note rename the way the Rust `vault_rename_dry_run` command does:
 * report every other note that contains a wikilink to the source stem.
 */
export function e2eRenameDryRun(fromPath: string, toPath: string, updateLinks: boolean) {
  const stem = noteStem(fromPath)
  const affected_files: string[] = []
  let link_edits = 0
  if (updateLinks) {
    for (const [path, markdown] of noteBodies) {
      if (path === fromPath) continue
      const hits = countWikilinks(markdown, stem)
      if (hits > 0) {
        affected_files.push(path)
        link_edits += hits
      }
    }
  }
  const warnings = noteBodies.has(toPath) ? [`${toPath} already exists`] : []
  return { affected_files, link_edits, warnings }
}

/**
 * Apply a note rename in the in-memory fixture vault, rewriting wikilinks in
 * every other note when `updateLinks` is set. This mirrors the Rust
 * `vault_rename_apply` contract so the browser E2E can assert that the app
 * requests link rewriting and surfaces the rewritten note afterwards. It does
 * not (and cannot) verify the Rust rewriter itself.
 */
export function e2eRenameApply(fromPath: string, toPath: string, updateLinks: boolean) {
  const fromStem = noteStem(fromPath)
  const toStem = noteStem(toPath)
  const body = noteBodies.get(fromPath) ?? screenshotNoteDocument(fromPath).markdown
  noteBodies.delete(fromPath)
  noteBodies.set(toPath, body)

  const affected_files: string[] = []
  let link_edits = 0
  if (updateLinks) {
    for (const [path, markdown] of noteBodies) {
      if (path === toPath) continue
      const hits = countWikilinks(markdown, fromStem)
      if (hits === 0) continue
      noteBodies.set(
        path,
        markdown.replace(wikilinkPattern(fromStem), (_match, suffix: string | undefined) =>
          `[[${toStem}${suffix ?? ''}]]`,
        ),
      )
      affected_files.push(path)
      link_edits += hits
    }
  }

  return { from_path: fromPath, to_path: toPath, affected_files, link_edits }
}

export { SCREENSHOT_SCAN, SCREENSHOT_VAULT }
