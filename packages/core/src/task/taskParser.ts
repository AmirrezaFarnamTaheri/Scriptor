/**
 * taskParser.ts — W4-3 TypeScript task parser for display and inline editing.
 *
 * ## Role (Single Definition Rule I-5)
 *
 * The Rust parser (`crates/indexer/src/tasks.rs`) is the authoritative indexer.
 * THIS file is the TS mirror used only for:
 *  - Real-time re-parsing of the editor buffer (before the indexer catches up).
 *  - Serialising a `Task` back to a Markdown line for inline edits.
 *  - Building the DQL `tasks:` clause payload on the TS side.
 *
 * The parser output MUST remain byte-for-byte consistent with the Rust parser
 * for the same input.  Any logic divergence is a bug.
 *
 * ## Supported syntax — identical to the Rust parser.
 *
 * Checkbox markers → status:
 *   `[ ]` open, `[x]` done, `[-]` cancelled, `[>]` forwarded, `[/]` in-progress
 *
 * Symbol date fields: calendar due, alarm due (alt), hourglass scheduled,
 * departure start, repeat rule.
 * Dataview fields:  `[due:: YYYY-MM-DD]`, `[scheduled:: …]`, `[start:: …]`, `[rrule:: …]`
 * Priority markers: high/highest/up, low/lower.
 *
 * Dates are always ISO-8601 (YYYY-MM-DD). Natural language dates are NEVER stored.
 */

import type { Task, TaskFieldStyle } from '../contracts/task'
import { checkboxCharToStatus, statusToCheckboxChar } from './statusRegistry'

const DUE_MARKER = '\u{1F4C5}'
const DUE_ALT_MARKER = '\u{23F0}'
const SCHEDULED_MARKER = '\u{23F3}'
const START_MARKER = '\u{1F6EB}'
const RRULE_MARKER = '\u{1F501}'

const PRIORITY_MARKERS = [
  '\u{1F53A}',
  '\u{23EB}',
  '\u{1F53C}',
  '\u{1F53D}',
  '\u{23EC}',
] as const

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Parse all tasks from a Markdown string.  Pure — no side-effects.
 *
 * @param markdown  Full note content or a single line.
 * @param noteId    Vault-relative path (used to populate `task.noteId`).
 */
export function parseTasksFromMarkdown(markdown: string, noteId = ''): Task[] {
  return markdown
    .split('\n')
    .flatMap((line, lineIdx) => parseTaskLine(line, lineIdx, noteId) ?? [])
}

/**
 * Serialise a `Task` back to a Markdown checkbox line.
 *
 * The output uses the same field style that was detected on parse
 * (`task.fieldStyle`).  Tags are embedded as-is (they are part of `task.text`).
 */
export function serializeTask(task: Task): string {
  const checkbox = statusToCheckboxChar(task.status)
  const fieldFn =
    task.fieldStyle === 'dataview' ? serializeDataviewFields : serializeEmojiFields
  const fields = fieldFn(task)
  const title = task.text.trim()
  return `- [${checkbox}] ${title}${fields}`
}

// ── Parser internals ──────────────────────────────────────────────────────────

function parseTaskLine(
  line: string,
  lineIdx: number,
  noteId: string,
): Task | null {
  // Match GFM list marker then checkbox.
  const match = line.match(/^[\t ]*[-*+] \[(.)\] (.*)$/)
  if (!match) return null

  const [, statusChar, rest] = match as [string, string, string]
  const status = checkboxCharToStatus(statusChar)

  // Determine field style from content before extracting.
  const fieldStyle: TaskFieldStyle = rest.includes('[due::') ||
    rest.includes('[scheduled::') ||
    rest.includes('[start::')
    ? 'dataview'
    : 'emoji'

  const { title, due, scheduled, start, rrule, tags } =
    fieldStyle === 'dataview'
      ? extractDataviewFields(rest)
      : extractEmojiFields(rest)

  const id = makeStableId(noteId, lineIdx)

  return {
    id,
    noteId,
    line: lineIdx,
    status,
    text: title.trim(),
    due: due ?? null,
    scheduled: scheduled ?? null,
    start: start ?? null,
    rrule: rrule ?? null,
    tags,
    fieldStyle,
  }
}

// ── Dataview-style extraction ─────────────────────────────────────────────────

interface ParsedFields {
  title: string
  due?: string
  scheduled?: string
  start?: string
  rrule?: string
  tags: string[]
}

function extractDataviewFields(text: string): ParsedFields {
  let clean = text
  let due: string | undefined
  let scheduled: string | undefined
  let start: string | undefined
  let rrule: string | undefined

  clean = removeDataviewField(clean, 'due', (v) => { due = v })
  clean = removeDataviewField(clean, 'scheduled', (v) => { scheduled = v })
  clean = removeDataviewField(clean, 'start', (v) => { start = v })
  clean = removeDataviewField(clean, 'rrule', (v) => { rrule = v })
  clean = removeDataviewField(clean, 'priority', () => {})

  const tags = extractTags(clean)
  return { title: clean.trim(), due, scheduled, start, rrule, tags }
}

function removeDataviewField(
  text: string,
  key: string,
  setter: (v: string) => void,
): string {
  const marker = `[${key}::`
  const idx = text.indexOf(marker)
  if (idx === -1) return text
  const afterMarker = text.slice(idx + marker.length)
  const closeIdx = afterMarker.indexOf(']')
  if (closeIdx === -1) return text
  const value = afterMarker.slice(0, closeIdx).trim()
  if (value) setter(value)
  return (text.slice(0, idx) + afterMarker.slice(closeIdx + 1)).trim()
}

// ── Emoji-style extraction ────────────────────────────────────────────────────

const ISO_DATE_RE = /\d{4}-\d{2}-\d{2}/

function extractEmojiFields(text: string): ParsedFields {
  let clean = text
  let due: string | undefined

  for (const marker of PRIORITY_MARKERS) {
    if (clean.includes(marker)) {
      clean = clean.replace(marker, '')
      break
    }
  }

  const duePrimary = extractEmojiDate(clean, DUE_MARKER, due)
  clean = duePrimary[0]
  due = duePrimary[1]

  const dueAlt = extractEmojiDate(clean, DUE_ALT_MARKER, due)
  clean = dueAlt[0]
  due = dueAlt[1]

  const scheduledResult = extractEmojiDate(clean, SCHEDULED_MARKER, undefined)
  clean = scheduledResult[0]
  const scheduled = scheduledResult[1]

  const startResult = extractEmojiDate(clean, START_MARKER, undefined)
  clean = startResult[0]
  const start = startResult[1]

  const rruleResult = extractEmojiRrule(clean, RRULE_MARKER, undefined)
  clean = rruleResult[0]
  const rrule = rruleResult[1]

  const tags = extractTags(clean)
  return { title: clean.trim(), due, scheduled, start, rrule, tags }
}

function extractEmojiDate(
  text: string,
  emoji: string,
  current: string | undefined,
): [string, string | undefined] {
  const idx = text.indexOf(emoji)
  if (idx === -1) return [text, current]
  const after = text.slice(idx + emoji.length).trimStart()
  const m = after.match(ISO_DATE_RE)
  if (!m || m.index !== 0) return [text, current]
  const date = m[0]
  // Only set if not already found (first emoji wins, same as Rust).
  const result = current ?? date
  const cleaned = (text.slice(0, idx) + after.slice(date.length)).trim()
  return [cleaned, result]
}

function extractEmojiRrule(
  text: string,
  emoji: string,
  current: string | undefined,
): [string, string | undefined] {
  const idx = text.indexOf(emoji)
  if (idx === -1) return [text, current]
  const after = text.slice(idx + emoji.length).trimStart()
  const token = after.split(/\s/)[0] ?? ''
  if (!token) return [text, current]
  const result = current ?? token
  const cleaned = (text.slice(0, idx) + after.slice(token.length)).trim()
  return [cleaned, result]
}

// ── Tag extraction ────────────────────────────────────────────────────────────

const TAG_RE = /(?:^|[^\w])#([\w/]+)/g

function extractTags(text: string): string[] {
  const tags: string[] = []
  for (let match = TAG_RE.exec(text); match !== null; match = TAG_RE.exec(text)) {
    tags.push(match[1]!)
  }
  TAG_RE.lastIndex = 0
  return [...new Set(tags)]
}

// ── Serialiser ────────────────────────────────────────────────────────────────

function serializeEmojiFields(task: Task): string {
  let suffix = ''
  if (task.due) suffix += ` ${DUE_MARKER} ${task.due}`
  if (task.scheduled) suffix += ` ${SCHEDULED_MARKER} ${task.scheduled}`
  if (task.start) suffix += ` ${START_MARKER} ${task.start}`
  if (task.rrule) suffix += ` ${RRULE_MARKER} ${task.rrule}`
  return suffix
}

function serializeDataviewFields(task: Task): string {
  let suffix = ''
  if (task.due) suffix += ` [due:: ${task.due}]`
  if (task.scheduled) suffix += ` [scheduled:: ${task.scheduled}]`
  if (task.start) suffix += ` [start:: ${task.start}]`
  if (task.rrule) suffix += ` [rrule:: ${task.rrule}]`
  return suffix
}

// ── ID helper ─────────────────────────────────────────────────────────────────

/**
 * Build a stable task ID from note path + line number.
 * Uses a simple deterministic hash so IDs are consistent on re-parse without
 * requiring the Rust UUID v5 algorithm.  The Rust side is authoritative for
 * persisted IDs; this is only used for in-memory keying in the React layer.
 */
function makeStableId(noteId: string, line: number): string {
  return `task:${noteId}:${line}`
}
