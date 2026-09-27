/**
 * statusRegistry.ts — W4-1: Single authoritative registry of all task statuses.
 *
 * Rules (I-5 / one definition per concept):
 *   - All status rendering, icons, labels, and filter logic derives from this
 *     table. Components must NOT hard-code status strings.
 *   - Custom statuses added by the user are stored as plain strings and rendered
 *     with the `custom` fallback entry.
 *   - This registry is the TS mirror of the `TaskStatus` type in `contracts/task.ts`.
 *
 * Usage:
 *   import { statusRegistry, getStatusMeta } from '@scriptor/core/task'
 *   const meta = getStatusMeta('done') // → { label: 'Done', emoji: 'x', … }
 */

import type { TaskStatus } from '../contracts/task'

/** All metadata for a single status. */
export interface StatusMeta {
  /** Unique status key — what is stored on disk. */
  key: TaskStatus
  /** User-facing label. */
  label: string
  /** Single emoji that represents the status in compact displays. */
  emoji: string
  /**
   * Checkbox character used in Markdown (the character between `[` and `]`).
   * ` ` = open, `x` = done, `-` = cancelled, `>` = forwarded, `/` = in-progress.
   */
  checkboxChar: string
  /** Whether this status counts as "completed" for progress calculations. */
  isTerminal: boolean
  /**
   * CSS class suffix for coloring (e.g. `'done'` → `'task-status--done'`).
   * Alias of `colorClass`.
   */
  cssClass: string
  /** @deprecated Use `cssClass`. */
  colorClass: string
  /** Display order in the status filter dropdown (lower = first). */
  order: number
}

/** Built-in status definitions — ordered for display. */
const BUILT_IN: readonly StatusMeta[] = [
  {
    key: 'open',
    label: 'Open',
    emoji: '○',
    checkboxChar: ' ',
    isTerminal: false,
    colorClass: 'open',
    cssClass: 'open',
    order: 0,
  },
  {
    key: 'in-progress',
    label: 'In Progress',
    emoji: '◑',
    checkboxChar: '/',
    isTerminal: false,
    colorClass: 'in-progress',
    cssClass: 'in-progress',
    order: 1,
  },
  {
    key: 'done',
    label: 'Done',
    emoji: 'x',
    checkboxChar: 'x',
    isTerminal: true,
    colorClass: 'done',
    cssClass: 'done',
    order: 2,
  },
  {
    key: 'cancelled',
    label: 'Cancelled',
    emoji: '✗',
    checkboxChar: '-',
    isTerminal: true,
    colorClass: 'cancelled',
    cssClass: 'cancelled',
    order: 3,
  },
  {
    key: 'forwarded',
    label: 'Forwarded',
    emoji: '→',
    checkboxChar: '>',
    isTerminal: false,
    colorClass: 'forwarded',
    cssClass: 'forwarded',
    order: 4,
  },
] as const

/** Immutable registry map: status key → meta. */
export const statusRegistry: ReadonlyMap<string, StatusMeta> = new Map(
  BUILT_IN.map((m) => [m.key, m]),
)

/**
 * Every character Scriptor accepts between `[` and `]` on a task line: the
 * built-in statuses plus GFM's uppercase `X`, which the registry does not
 * store.
 *
 * `[/]`, `[-]` and `[>]` are the *same syntax* as `[ ]` and `[x]`, and
 * `serializeTask` writes them. A pattern that hard-codes `[ xX]` therefore
 * treats a task the app itself authored as ordinary text — which is how the
 * `[/]` marker came to be reported as a missing link reference, how the
 * WYSIWYG surface lost its brackets, and how `[>]` came to be counted as a
 * word. Derive every task-marker pattern from this set.
 */
export const TASK_CHECKBOX_CHARS: readonly string[] = Array.from(
  new Set([...Array.from(statusRegistry.values(), (meta) => meta.checkboxChar), 'X']),
)

/** True when `char` is a task checkbox character, without its brackets. */
export function isTaskCheckboxChar(char: string): boolean {
  return TASK_CHECKBOX_CHARS.includes(char)
}

/**
 * Body for a regular-expression character class matching any task checkbox
 * character: `TASK_CHECKBOX_CLASS_SOURCE` is safe to interpolate between
 * `[` and `]`. `-` is escaped so it can never be read as a range.
 */
export const TASK_CHECKBOX_CLASS_SOURCE: string = TASK_CHECKBOX_CHARS.map((char) =>
  char.replace(/[\\\]^-]/g, '\\$&'),
).join('')

/** The markers GFM already understands, so a consumer must not claim them twice. */
const GFM_CHECKBOX_CHARS: ReadonlySet<string> = new Set([' ', 'x', 'X'])

/**
 * The markers Scriptor adds on top of GFM: `[/]`, `[-]`, `[>]`. These are the
 * ones a consumer must recognise as task syntax, because nothing upstream
 * handles them for it.
 *
 * Two independent parsers have to agree on this exact set — the CodeMirror
 * block parser in `packages/editor` and the preprocessor in
 * `packages/renderer` — or the editor and the exported document would read the
 * same line differently.
 */
export const EXTENDED_TASK_CHECKBOX_CHARS: readonly string[] = TASK_CHECKBOX_CHARS.filter(
  (char) => !GFM_CHECKBOX_CHARS.has(char),
)

export const EXTENDED_TASK_CHECKBOX_CLASS_SOURCE: string = EXTENDED_TASK_CHECKBOX_CHARS.map((char) =>
  char.replace(/[\\\]^-]/g, '\\$&'),
).join('')

/**
 * Look up status metadata.  Returns the built-in entry if found, or a generic
 * "custom" fallback for unknown statuses.
 */
export function getStatusMeta(status: string): StatusMeta {
  const found = statusRegistry.get(status)
  if (found) return found
  return {
    key: status as TaskStatus,
    label: status.charAt(0).toUpperCase() + status.slice(1),
    emoji: '●',
    checkboxChar: status,
    isTerminal: false,
    colorClass: 'custom',
    cssClass: 'custom',
    order: 99,
  }
}

/**
 * Return all built-in statuses sorted by `order`.
 * Custom statuses are not included (they are not known at registry time).
 */
export function allBuiltInStatuses(): StatusMeta[] {
  return [...BUILT_IN].sort((a, b) => a.order - b.order)
}

/**
 * Ordered array of built-in status keys for cycling (open → in-progress → done → cancelled → forwarded → open).
 * Import this to drive `cycleStatus` logic without hard-coding strings.
 */
export const STATUS_ORDER: readonly string[] = [...BUILT_IN]
  .sort((a, b) => a.order - b.order)
  .map((m) => m.key)

/**
 * Convert a Markdown checkbox character to a `TaskStatus`.
 * Falls back to the raw character for unknown chars.
 */
export function checkboxCharToStatus(char: string): TaskStatus {
  const trimmed = char.trim()
  const meta = BUILT_IN.find((m) => m.checkboxChar === trimmed)
  return meta?.key ?? (trimmed || 'open')
}

/**
 * Convert a `TaskStatus` back to the checkbox character used in Markdown.
 */
export function statusToCheckboxChar(status: TaskStatus): string {
  return statusRegistry.get(status)?.checkboxChar ?? status
}
