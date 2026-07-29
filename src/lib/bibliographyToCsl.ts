import type { BibliographyEntry } from '../types/vault'

const ENTRY_TYPE_MAP: Record<string, string> = {
  article: 'article-journal',
  book: 'book',
  inbook: 'chapter',
  incollection: 'chapter',
  misc: 'article',
}

export function mapBibliographyEntryType(entryType: string): string {
  const normalized = entryType.trim().toLowerCase()
  return ENTRY_TYPE_MAP[normalized] ?? 'article'
}

/** Convert indexer bibliography rows into citeproc-js CSL JSON items. */
export function bibliographyEntryToCslItem(entry: BibliographyEntry): Record<string, unknown> {
  const item: Record<string, unknown> = {
    id: entry.key,
    type: mapBibliographyEntryType(entry.entry_type),
    title: entry.title,
  }

  const author = entry.author?.trim()
  if (author) {
    item.author = [{ literal: author }]
  }

  const year = Number.parseInt(entry.year?.trim() ?? '', 10)
  if (!Number.isNaN(year)) {
    item.issued = { 'date-parts': [[year]] }
  }

  return item
}

export function bibliographyEntriesToCslItems(
  entries: BibliographyEntry[],
): Record<string, Record<string, unknown>> {
  // Null-prototype: `.bib` files supply the keys, and an entry keyed
  // `__proto__` would otherwise hit the prototype setter and corrupt the map.
  const items: Record<string, Record<string, unknown>> = Object.create(null)
  for (const entry of entries) {
    items[entry.key] = bibliographyEntryToCslItem(entry)
  }
  return items
}
