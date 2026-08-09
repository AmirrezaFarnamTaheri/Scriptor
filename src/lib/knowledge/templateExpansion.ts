/**
 * Template variable expansion for Scriptor note templates.
 *
 * Supported variables:
 *   {{date}}      — ISO 8601 date (YYYY-MM-DD)
 *   {{time}}      — HH:MM (24-hour)
 *   {{datetime}}  — ISO 8601 datetime
 *   {{weekday}}   — Long weekday name (e.g. "Monday")
 *   {{title}}     — The note title supplied by the caller
 *   {{cursor}}    — Cursor placement marker (removed from output)
 *
 * Templates live in .scriptor/templates/*.md inside the vault.
 */

export interface ExpandedTemplate {
  /** Final markdown content with all variables resolved. */
  markdown: string
  /**
   * Character offset where {{cursor}} was found.
   * -1 if no cursor placeholder existed (use end of document).
   */
  cursorOffset: number
}

const VARIABLE_RE = /\{\{(\w+)\}\}/g

/**
 * Expand template variables in a raw template string.
 *
 * @param raw    Raw template markdown read from disk.
 * @param title  Title the user supplied for the new note.
 * @param now    Optional date override (defaults to `new Date()`).
 */
export function expandTemplateVariables(
  raw: string,
  title: string,
  now: Date = new Date(),
): ExpandedTemplate {
  const padZ = (n: number): string => String(n).padStart(2, '0')
  const isoDate = `${now.getFullYear()}-${padZ(now.getMonth() + 1)}-${padZ(now.getDate())}`
  const isoTime = `${padZ(now.getHours())}:${padZ(now.getMinutes())}`
  const isoDatetime = `${isoDate}T${isoTime}`
  const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const weekday = weekdays[now.getDay()] ?? ''

  const replacements: Record<string, string> = {
    date: isoDate,
    time: isoTime,
    datetime: isoDatetime,
    weekday,
    title,
    cursor: '\x00', // handled after replacement pass
  }

  const expanded = raw.replace(VARIABLE_RE, (_, key: string) =>
    Object.prototype.hasOwnProperty.call(replacements, key)
      ? (replacements[key] ?? `{{${key}}}`)
      : `{{${key}}}`,
  )

  const cursorOffset = expanded.indexOf('\x00')
  const markdown = expanded.replace('\x00', '')
  return { markdown, cursorOffset }
}

/**
 * Build the default content for a note with no template applied:
 * an H1 title with the cursor positioned after it.
 */
export function buildDefaultNoteContent(title: string): ExpandedTemplate {
  const markdown = `# ${title}\n\n`
  return { markdown, cursorOffset: markdown.length }
}
