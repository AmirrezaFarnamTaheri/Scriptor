import type { NoteDocument, SearchHit } from '../types/vault'
import type { KanbanBoardRow, TaskRow } from '../bridge/commands/indexer'
import { SCREENSHOT_SCAN, SCREENSHOT_VAULT, screenshotNoteDocument } from '../screenshot/fixture.ts'

const noteBodies = new Map<string, string>()

for (const entry of SCREENSHOT_SCAN) {
  if (entry.kind === 'note') {
    noteBodies.set(entry.path, screenshotNoteDocument(entry.path).markdown)
  }
}

const statusToCheckbox: Record<string, string> = {
  open: ' ',
  'in-progress': '/',
  done: 'x',
  cancelled: '-',
  forwarded: '>',
}

const checkboxToStatus: Record<string, string> = {
  ' ': 'open',
  '/': 'in-progress',
  x: 'done',
  '-': 'cancelled',
  '>': 'forwarded',
}

function taskFromMarkdown(path: string, line: string, lineNumber: number): TaskRow | null {
  const match = /^- \[([- /x>])\] (.*?)(?: (?:📅 |due: )(\d{4}-\d{2}-\d{2}))?$/.exec(line)
  if (!match) return null
  const [, checkbox, title, dueAt] = match
  return {
    id: `${path}:${lineNumber}`,
    vaultId: SCREENSHOT_VAULT.id,
    sourceNoteId: `${SCREENSHOT_VAULT.id}:${path}`,
    sourceNotePath: path,
    line: lineNumber,
    title,
    status: checkboxToStatus[checkbox] ?? 'open',
    priority: title === 'Collect sources' ? 1 : 0,
    dueAt: dueAt ?? null,
    scheduledAt: null,
    startAt: null,
    rrule: null,
    fieldStyle: 'emoji',
    tags: path === 'Research Plan.md' ? ['research'] : ['release'],
    completedAt: checkboxToStatus[checkbox] === 'done' ? '2026-06-20T10:00:00Z' : null,
    createdAt: '2026-06-20T10:00:00Z',
    updatedAt: '2026-06-20T10:00:00Z',
  }
}

/** Read task rows from the fixture Markdown at query time, never from a side cache. */
export function e2eQueryTasks(): TaskRow[] {
  const rows: TaskRow[] = []
  for (const [path, markdown] of noteBodies) {
    markdown.split('\n').forEach((line, lineNumber) => {
      const task = taskFromMarkdown(path, line, lineNumber)
      if (task) rows.push(task)
    })
  }
  return rows
}

/** Rewrite the matching Markdown task and let subsequent queries re-parse it. */
export function e2eUpdateTask(taskId: string, patch: { status?: string; dueAt?: string | null }): void {
  const task = e2eQueryTasks().find((row) => row.id === taskId)
  if (!task || !task.sourceNotePath) throw new Error(`E2E task not found: ${taskId}`)
  const lines = (noteBodies.get(task.sourceNotePath) ?? '').split('\n')
  const status = patch.status ?? task.status
  const dueAt = patch.dueAt === undefined ? task.dueAt : patch.dueAt
  lines[task.line] = `- [${statusToCheckbox[status] ?? ' '}] ${task.title}${dueAt ? ` due: ${dueAt}` : ''}`
  noteBodies.set(task.sourceNotePath, lines.join('\n'))
}

function kanbanColumns(markdown: string): KanbanBoardRow['columns'] {
  const columns: KanbanBoardRow['columns'] = []
  let column: KanbanBoardRow['columns'][number] | null = null
  markdown.split('\n').forEach((line, lineNumber) => {
    const heading = /^## (.+)$/.exec(line)
    if (heading) {
      column = { name: heading[1], cards: [] }
      columns.push(column)
      return
    }
    const card = /^- \[([- /x>])\] (.+)$/.exec(line)
    if (card && column) {
      column.cards.push({
        text: card[2],
        status: card[1],
        line: lineNumber,
        archived: card[1] === 'x',
      })
    }
  })
  return columns
}

/** Parse the board afresh from its Markdown source, matching the native contract. */
export function e2eKanbanBoard(notePath: string): KanbanBoardRow | null {
  const markdown = noteBodies.get(notePath)
  if (!markdown?.includes('kanban-plugin: basic')) return null
  return { sourcePath: notePath, columns: kanbanColumns(markdown) }
}

/** Move a card by rewriting its source Markdown, then rely on a fresh parse. */
export function e2eKanbanMoveCard(notePath: string, line: number, toColumn: string, newStatus: string): void {
  const lines = (noteBodies.get(notePath) ?? '').split('\n')
  const card = lines[line]
  if (!/^\s*- \[[- /x>]\] /.test(card)) throw new Error(`E2E kanban card not found at ${notePath}:${line}`)
  const destination = lines.findIndex((value) => value === `## ${toColumn}`)
  if (destination < 0) throw new Error(`E2E kanban column not found: ${toColumn}`)
  const text = card.replace(/^\s*- \[[- /x>]\] /, '')
  lines.splice(line, 1)
  const adjustedDestination = line < destination ? destination - 1 : destination
  let insertAt = adjustedDestination + 1
  while (insertAt < lines.length && !lines[insertAt].startsWith('## ')) insertAt += 1
  lines.splice(insertAt, 0, `- [${newStatus}] ${text}`)
  noteBodies.set(notePath, lines.join('\n'))
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
