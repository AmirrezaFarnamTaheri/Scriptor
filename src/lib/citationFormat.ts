import type { BibliographyEntry } from '../types/vault'

/** APA-style one-line bibliography string for UI previews (citeproc fallback). */
export function formatBibliographyEntry(entry: BibliographyEntry): string {
  const author = entry.author?.trim()
  const year = entry.year?.trim()
  const title = entry.title?.trim()

  if (author && year && title) {
    return `${author} (${year}). ${title}.`
  }
  if (author && title) {
    return `${author}. ${title}.`
  }
  if (year && title) {
    return `(${year}). ${title}.`
  }
  if (title) {
    return title
  }
  return entry.key
}

/** APA-style parenthetical in-text citation for inspector previews. */
export function formatInlineCitation(entry: BibliographyEntry): string {
  const author = entry.author?.trim()
  const year = entry.year?.trim()
  if (author && year) {
    return `(${author}, ${year})`
  }
  if (author) {
    return `(${author})`
  }
  if (year) {
    return `(${year})`
  }
  return entry.key
}

export function buildReferencesBlock(entries: BibliographyEntry[]): string {
  if (entries.length === 0) return ''
  const lines = entries.map((entry) => `- ${formatBibliographyEntry(entry)}`)
  return `\n## References\n\n${lines.join('\n')}\n`
}
