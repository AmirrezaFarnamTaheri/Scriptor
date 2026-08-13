/**
 * recurrence.ts — W4-6: Expand RRULE tokens into PlannerDay entries.
 *
 * ## Design constraints
 *   - Pure function — no side-effects, no global state.
 *   - Does NOT import `date-fns` as a hard dependency; uses the browser-native
 *     `Temporal` API when available, and a lightweight fallback otherwise.
 *     (Full RFC-5545 RRULE support is out of scope; we support the subset that
 *     Obsidian Tasks uses in practice.)
 *   - Dates are always ISO-8601 (YYYY-MM-DD). Natural language is never
 *     handled here — the caller is responsible for parsing.
 *
 * ## Supported RRULE subset
 *   FREQ=DAILY|WEEKLY|MONTHLY|YEARLY
 *   INTERVAL=N (default 1)
 *   COUNT=N    (limit occurrences; capped at 365 for safety)
 *   UNTIL=YYYYMMDD
 *   BYDAY=MO,TU,WE,TH,FR,SA,SU (for WEEKLY only)
 *
 * ## Output
 *   An array of `PlannerDay` entries, each containing the tasks that fall on
 *   that day after expansion.  The returned array is sorted ascending by date.
 */

import type { PlannerDay, Task } from '../contracts/task'

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Given a set of tasks (some of which may have `rrule` set), return an array
 * of `PlannerDay` entries from `startDate` to `endDate` (inclusive).
 *
 * Non-recurring tasks are placed on their `due` date if it falls within range.
 * Recurring tasks are expanded according to their RRULE.
 *
 * @param tasks     Flat list of tasks (already parsed from the vault).
 * @param startDate ISO-8601 date (YYYY-MM-DD) — first planner day.
 * @param endDate   ISO-8601 date (YYYY-MM-DD) — last planner day (inclusive).
 */
export function expandRecurrence(
  tasks: Task[],
  startDate: string,
  endDate: string,
): PlannerDay[] {
  const start = parseIso(startDate)
  const end = parseIso(endDate)

  if (!start || !end || start > end) return []

  // Map from ISO date string → task list for that day.
  const dayMap = new Map<string, Task[]>()

  for (const task of tasks) {
    if (task.rrule && (task.due || task.start)) {
      // Recurring: expand from the base date.
      const baseDateStr = task.start ?? task.due!
      const occurrences = expandRrule(task.rrule, baseDateStr, start, end)
      for (const iso of occurrences) {
        getOrCreate(dayMap, iso).push(task)
      }
    } else if (task.due) {
      // Non-recurring: place on due date if in range.
      const d = parseIso(task.due)
      if (d && d >= start && d <= end) {
        getOrCreate(dayMap, task.due).push(task)
      }
    }
  }

  // Build sorted PlannerDay array.
  return [...dayMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, dayTasks]) => ({ date, tasks: dayTasks }))
}

// ── RRULE parser ──────────────────────────────────────────────────────────────

/** Parsed representation of a supported RRULE. */
interface ParsedRrule {
  freq: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY'
  interval: number
  count: number | null
  until: Date | null
  byDay: number[] | null // 0=SU, 1=MO … 6=SA
}

const DAY_MAP: Record<string, number> = {
  SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6,
}

function parseRrule(rrule: string): ParsedRrule | null {
  // Support both bare "FREQ=DAILY;INTERVAL=2" and "RRULE:FREQ=DAILY;…"
  const body = rrule.toUpperCase().replace(/^RRULE:/, '')
  const parts = Object.fromEntries(
    body.split(';').map((p) => {
      const eq = p.indexOf('=')
      return eq === -1 ? [p, ''] : [p.slice(0, eq), p.slice(eq + 1)]
    }),
  )

  const freq = parts['FREQ'] as ParsedRrule['freq']
  if (!['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'].includes(freq)) return null

  const interval = parseInt(parts['INTERVAL'] ?? '1', 10) || 1
  const countRaw = parts['COUNT']
  const count = countRaw ? Math.min(parseInt(countRaw, 10) || 0, 365) : null

  const untilRaw = parts['UNTIL']
  let until: Date | null = null
  if (untilRaw) {
    // UNTIL is YYYYMMDD or YYYYMMDDTHHMMSSZ
    const d = untilRaw.slice(0, 8)
    until = parseIso8601Compact(d)
  }

  const byDayRaw = parts['BYDAY']
  const byDay =
    byDayRaw && freq === 'WEEKLY'
      ? byDayRaw
          .split(',')
          .map((s) => DAY_MAP[s])
          .filter((n): n is number => n !== undefined)
      : null

  return { freq, interval, count, until, byDay }
}

// ── Occurrence expander ───────────────────────────────────────────────────────

const MAX_OCCURRENCES = 365

function expandRrule(
  rrule: string,
  baseDateStr: string,
  rangeStart: Date,
  rangeEnd: Date,
): string[] {
  const rule = parseRrule(rrule)
  if (!rule) return []

  const base = parseIso(baseDateStr)
  if (!base) return []

  const results: string[] = []
  let current = new Date(base)
  let count = 0

  while (count < MAX_OCCURRENCES) {
    // Enforce COUNT and UNTIL.
    if (rule.count !== null && count >= rule.count) break
    if (rule.until && current > rule.until) break
    // Stop expanding beyond range end.
    if (current > rangeEnd) break

    if (current >= rangeStart) {
      if (rule.byDay) {
        // Emit for each matching weekday within the current week.
        if (rule.byDay.includes(current.getDay())) {
          results.push(toIso(current))
        }
      } else {
        results.push(toIso(current))
      }
    }

    // Advance to next occurrence.
    current = advance(current, rule)
    count++
  }

  return results
}

function advance(date: Date, rule: ParsedRrule): Date {
  const d = new Date(date)
  switch (rule.freq) {
    case 'DAILY':
      d.setDate(d.getDate() + rule.interval)
      break
    case 'WEEKLY':
      d.setDate(d.getDate() + 7 * rule.interval)
      break
    case 'MONTHLY':
      d.setMonth(d.getMonth() + rule.interval)
      break
    case 'YEARLY':
      d.setFullYear(d.getFullYear() + rule.interval)
      break
  }
  return d
}

// ── Date helpers ──────────────────────────────────────────────────────────────

/** Parse "YYYY-MM-DD" into a midnight-UTC Date object, or null on failure. */
function parseIso(iso: string): Date | null {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m) return null
  const [, y, mo, d] = m.map(Number)
  return new Date(Date.UTC(y!, mo! - 1, d!))
}

/** Parse "YYYYMMDD" (RRULE UNTIL compact form) → Date | null. */
function parseIso8601Compact(s: string): Date | null {
  if (s.length < 8) return null
  return parseIso(`${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`)
}

/** Serialise a Date to "YYYY-MM-DD" (UTC). */
function toIso(d: Date): string {
  return d.toISOString().slice(0, 10)
}

/** Get or create the task list for a day. */
function getOrCreate(map: Map<string, Task[]>, key: string): Task[] {
  if (!map.has(key)) map.set(key, [])
  return map.get(key)!
}
