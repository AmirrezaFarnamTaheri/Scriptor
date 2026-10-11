import { useEffect, useMemo, useState } from 'react'

import { formatBibliographyWithCiteproc, type CiteprocFormattedEntry } from '../lib/citeprocClient'
import { formatBibliographyEntry, formatInlineCitation } from '../lib/citationFormat'
import type { BibliographyEntry } from '../types/vault'

function fallbackFormatted(entry: BibliographyEntry): CiteprocFormattedEntry {
  return {
    key: entry.key,
    inline: formatInlineCitation(entry),
    bibliography: formatBibliographyEntry(entry),
  }
}

function buildFallbackMap(entries: BibliographyEntry[]): Map<string, CiteprocFormattedEntry> {
  return new Map(entries.map((entry) => [entry.key, fallbackFormatted(entry)]))
}

export function useCiteprocPreview(entries: BibliographyEntry[], keys?: string[]) {
  const [result, setResult] = useState<{ entries: BibliographyEntry[]; keys: string[] | undefined; map: Map<string, CiteprocFormattedEntry>; usingCiteproc: boolean } | null>(null)

  const targetEntries = useMemo(() => {
    if (!keys?.length) {
      return entries
    }
    const byKey = new Map(entries.map((entry) => [entry.key, entry]))
    return keys.map((key) => byKey.get(key)).filter((entry): entry is BibliographyEntry => Boolean(entry))
  }, [entries, keys])

  const requestKey = useMemo(
    () =>
      `${targetEntries.map((entry) => `${entry.key}:${entry.title}:${entry.author ?? ''}:${entry.year ?? ''}`).join('|')}|${keys?.join(',') ?? '*'}`,
    [keys, targetEntries],
  )

  useEffect(() => {
    if (targetEntries.length === 0) {
      return
    }

    let cancelled = false
    void formatBibliographyWithCiteproc(entries, keys)
      .then((result) => {
        if (cancelled) {
          return
        }
        setResult({ entries, keys, map: result, usingCiteproc: true })
      })
      .catch(() => {
        if (cancelled) {
          return
        }
        setResult({ entries, keys, map: buildFallbackMap(targetEntries), usingCiteproc: false })
      })

    return () => {
      cancelled = true
    }
  }, [entries, keys, requestKey, targetEntries])

  const formatted = useMemo(() => {
    if (targetEntries.length === 0) {
      return new Map<string, CiteprocFormattedEntry>()
    }
    if (result?.entries === entries && result.keys === keys) {
      return result.map
    }
    return buildFallbackMap(targetEntries)
  }, [result, entries, keys, targetEntries])

  const formatInline = (entry: BibliographyEntry): string =>
    formatted.get(entry.key)?.inline ?? formatInlineCitation(entry)

  const formatBibliography = (entry: BibliographyEntry): string =>
    formatted.get(entry.key)?.bibliography ?? formatBibliographyEntry(entry)

  const activeUsingCiteproc = targetEntries.length > 0 && result?.entries === entries && result.keys === keys && result.usingCiteproc

  return { formatted, formatInline, formatBibliography, usingCiteproc: activeUsingCiteproc }
}
