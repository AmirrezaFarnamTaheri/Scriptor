/**
 * dateParser.ts — Single date parsing/formatting entry point (F-6, D10).
 *
 * Rules:
 * - ALL dates stored on disk are ISO-8601 (YYYY-MM-DD or full datetime).
 * - Natural language input is accepted here and converted; it is NEVER stored.
 * - This is the ONE date parser for the TS process (I-5). No second implementation
 *   may exist in `src/` or `packages/`.
 * - Uses `date-fns` only; `moment` is never a dependency.
 *
 * Verify: `pnpm --filter @scriptor/core test date`
 */

/** A parsed date in ISO-8601 format: YYYY-MM-DD */
export type IsoDate = string;

/** A parsed datetime in ISO-8601 format: YYYY-MM-DDTHH:mm:ssZ */
export type IsoDateTime = string;

export interface ParsedDate {
  /** ISO-8601 date string, always in this format for storage */
  iso: IsoDate;
  /** Original input that was parsed */
  input: string;
  /** Whether the input required NLP parsing (vs a direct ISO parse) */
  wasNaturalLanguage: boolean;
}

export interface ParseDateOptions {
  /** Reference date for relative expressions like "tomorrow", "next Monday" */
  referenceDate?: Date;
  /** IANA timezone, e.g. "America/New_York". Defaults to local system TZ. */
  timezone?: string;
}

/**
 * Natural-language patterns supported (case-insensitive):
 * - ISO dates: "2026-08-10", "2026-08-10T15:00:00Z"
 * - Relative: "today", "tomorrow", "yesterday"
 * - Weekday: "next Monday", "this Friday"
 * - Offset: "in 3 days", "in 2 weeks", "3 days ago"
 * - Named: "next week", "next month"
 */
const NL_PATTERNS: Array<{
  pattern: RegExp;
  resolve: (match: RegExpMatchArray, ref: Date) => Date | null;
}> = [
  {
    pattern: /^today$/i,
    resolve: (_m, ref) => ref,
  },
  {
    pattern: /^tomorrow$/i,
    resolve: (_m, ref) => addDays(ref, 1),
  },
  {
    pattern: /^yesterday$/i,
    resolve: (_m, ref) => addDays(ref, -1),
  },
  {
    pattern: /^in (\d+) days?$/i,
    resolve: (m, ref) => addDays(ref, parseInt(m[1], 10)),
  },
  {
    pattern: /^(\d+) days? ago$/i,
    resolve: (m, ref) => addDays(ref, -parseInt(m[1], 10)),
  },
  {
    pattern: /^in (\d+) weeks?$/i,
    resolve: (m, ref) => addDays(ref, parseInt(m[1], 10) * 7),
  },
  {
    pattern: /^(\d+) weeks? ago$/i,
    resolve: (m, ref) => addDays(ref, -parseInt(m[1], 10) * 7),
  },
  {
    pattern: /^in (\d+) months?$/i,
    resolve: (m, ref) => addMonths(ref, parseInt(m[1], 10)),
  },
  {
    pattern:
      /^next (monday|tuesday|wednesday|thursday|friday|saturday|sunday)$/i,
    resolve: (m, ref) => nextWeekday(ref, m[1]),
  },
  {
    pattern:
      /^this (monday|tuesday|wednesday|thursday|friday|saturday|sunday)$/i,
    resolve: (m, ref) => thisWeekday(ref, m[1]),
  },
  {
    pattern: /^next week$/i,
    resolve: (_m, ref) => addDays(ref, 7),
  },
  {
    pattern: /^next month$/i,
    resolve: (_m, ref) => addMonths(ref, 1),
  },
];

// ---------------------------------------------------------------------------
// Minimal date math (no moment, no heavyweight import — only date-fns helpers)
// These are thin wrappers so we can swap the engine without touching callers.
// ---------------------------------------------------------------------------

function addDays(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function addMonths(date: Date, n: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + n);
  return d;
}

const WEEKDAY_INDEX: Record<string, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

function nextWeekday(ref: Date, name: string): Date {
  const target = WEEKDAY_INDEX[name.toLowerCase()];
  const current = ref.getDay();
  const diff = ((target - current + 7) % 7) || 7; // at least 1 day ahead
  return addDays(ref, diff);
}

function thisWeekday(ref: Date, name: string): Date {
  const target = WEEKDAY_INDEX[name.toLowerCase()];
  const current = ref.getDay();
  const diff = (target - current + 7) % 7;
  return addDays(ref, diff === 0 ? 0 : diff);
}

// ---------------------------------------------------------------------------
// ISO format helpers
// ---------------------------------------------------------------------------

/**
 * Format a Date as YYYY-MM-DD (local date, not UTC).
 * This is the canonical on-disk format for task due/scheduled/start dates.
 */
export function toIsoDate(date: Date): IsoDate {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Format a Date as ISO-8601 datetime string (UTC).
 */
export function toIsoDateTime(date: Date): IsoDateTime {
  return date.toISOString();
}

/** Returns true if the string is a valid ISO-8601 date (YYYY-MM-DD). */
export function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !isNaN(Date.parse(value));
}

/** Returns true if the string is a valid ISO-8601 datetime. */
export function isIsoDateTime(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}T/.test(value) && !isNaN(Date.parse(value));
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Parse a date string — ISO or natural language — into a `ParsedDate`.
 *
 * Returns `null` if the input cannot be understood.
 * The `iso` field is always YYYY-MM-DD and safe to store on disk.
 */
export function parseDate(
  input: string,
  options: ParseDateOptions = {}
): ParsedDate | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const ref = options.referenceDate ?? new Date();

  // 1. Try direct ISO parse first
  if (isIsoDate(trimmed)) {
    return { iso: trimmed, input: trimmed, wasNaturalLanguage: false };
  }
  if (isIsoDateTime(trimmed)) {
    const d = new Date(trimmed);
    return { iso: toIsoDate(d), input: trimmed, wasNaturalLanguage: false };
  }

  // 2. Natural-language patterns
  for (const { pattern, resolve } of NL_PATTERNS) {
    const match = trimmed.match(pattern);
    if (match) {
      const resolved = resolve(match, ref);
      if (resolved) {
        return {
          iso: toIsoDate(resolved),
          input: trimmed,
          wasNaturalLanguage: true,
        };
      }
    }
  }

  return null;
}

/**
 * Parse a date string and return the ISO string, or `null` on failure.
 * Convenience wrapper for cases where only the ISO string is needed.
 */
export function parseDateIso(
  input: string,
  options?: ParseDateOptions
): IsoDate | null {
  return parseDate(input, options)?.iso ?? null;
}

/**
 * Compare two ISO dates. Returns negative if a < b, 0 if equal, positive if a > b.
 * Safe for `Array.prototype.sort`.
 */
export function compareIsoDates(a: IsoDate, b: IsoDate): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * Returns true if the ISO date is today (local date).
 */
export function isToday(iso: IsoDate): boolean {
  return iso === toIsoDate(new Date());
}

/**
 * Returns true if the ISO date is in the past (before today, local date).
 */
export function isPast(iso: IsoDate): boolean {
  return iso < toIsoDate(new Date());
}

/**
 * Returns true if the ISO date is in the future (after today, local date).
 */
export function isFuture(iso: IsoDate): boolean {
  return iso > toIsoDate(new Date());
}
