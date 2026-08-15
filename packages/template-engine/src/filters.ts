/**
 * @scriptor/template-engine — Built-in filters (W2-1/W2-2)
 *
 * A filter is a pure function `(value: unknown, arg?: string) => string`.
 * All registered names live here and are exported as `BUILTIN_FILTER_NAMES`
 * (a `ReadonlySet<string>`) for use by the parser's unknown-filter guard.
 *
 * Design:
 *   - Every filter is a deterministic, side-effect-free transformation.
 *   - Unknown filter names are caught at parse time, not here.
 *   - `arg` is always a string or `undefined`; filters parse it as needed.
 */

export type FilterFn = (value: unknown, arg?: string) => string

// ── Filter implementations ─────────────────────────────────────────────────────

function toString(value: unknown): string {
  if (value === null || value === undefined) return ''
  return String(value)
}

/** `upper` — locale-insensitive uppercase */
const upper: FilterFn = v => toString(v).toUpperCase()

/** `lower` — locale-insensitive lowercase */
const lower: FilterFn = v => toString(v).toLowerCase()

/** `trim` — strip leading/trailing whitespace */
const trim: FilterFn = v => toString(v).trim()

/**
 * `truncate:N` — keep at most N characters (default 80), appending `…` if cut.
 * `truncate` without an arg behaves like `truncate:80`.
 */
const truncate: FilterFn = (v, arg) => {
  const max = arg !== undefined ? Math.max(1, Number(arg) || 80) : 80
  const s = toString(v)
  return s.length <= max ? s : s.slice(0, max) + '…'
}

/**
 * `default:fallback` — return `fallback` when value is empty/null/undefined.
 */
const defaultFilter: FilterFn = (v, arg) => {
  const s = toString(v)
  return s.length > 0 ? s : (arg ?? '')
}

/**
 * `date:format` — format an ISO-8601 date string or `Date` object.
 *
 * Supported tokens (mirrors `dateParser.ts` ISO-on-disk rule):
 *   `YYYY`, `MM`, `DD`, `HH`, `mm`, `ss`
 * The format string defaults to `YYYY-MM-DD` when omitted.
 */
const date: FilterFn = (v, arg) => {
  const raw = toString(v)
  const d = new Date(raw)
  if (isNaN(d.getTime())) return raw // not a date — pass through unchanged

  const fmt = arg ?? 'YYYY-MM-DD'
  const pad = (n: number, w = 2) => String(n).padStart(w, '0')
  return fmt
    .replace('YYYY', pad(d.getFullYear(), 4))
    .replace('MM',   pad(d.getMonth() + 1))
    .replace('DD',   pad(d.getDate()))
    .replace('HH',   pad(d.getHours()))
    .replace('mm',   pad(d.getMinutes()))
    .replace('ss',   pad(d.getSeconds()))
}

/**
 * `slugify` — replace spaces with hyphens and strip non-alphanumeric chars.
 * Useful for building file names from titles.
 */
const slugify: FilterFn = v =>
  toString(v)
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')

// ── Registry ──────────────────────────────────────────────────────────────────

/** All built-in filter implementations keyed by their name. */
export const BUILTIN_FILTERS: ReadonlyMap<string, FilterFn> = new Map([
  ['upper',   upper],
  ['lower',   lower],
  ['trim',    trim],
  ['truncate', truncate],
  ['default', defaultFilter],
  ['date',    date],
  ['slugify', slugify],
])

/**
 * The set of all known built-in filter names.
 *
 * Pass to `parse(source, BUILTIN_FILTER_NAMES)` so that unknown filter names
 * are caught at parse time rather than silently passing through.
 */
export const BUILTIN_FILTER_NAMES: ReadonlySet<string> = new Set(BUILTIN_FILTERS.keys())
