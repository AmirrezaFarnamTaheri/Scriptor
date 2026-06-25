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
  const [citeprocMap, setCiteprocMap] = useState<Map<string, CiteprocFormattedEntry> | null>(null)
  const [usingCiteproc, setUsingCiteproc] = useState(false)

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
        setCiteprocMap(result)
        setUsingCiteproc(true)
      })
      .catch(() => {
        if (cancelled) {
          return
        }
        setCiteprocMap(buildFallbackMap(targetEntries))
        setUsingCiteproc(false)
      })

    return () => {
      cancelled = true
    }
  }, [entries, keys, requestKey, targetEntries])

  const formatted = useMemo(() => {
    if (targetEntries.length === 0) {
      return new Map<string, CiteprocFormattedEntry>()
    }
    if (citeprocMap) {
      return citeprocMap
    }
    return buildFallbackMap(targetEntries)
  }, [citeprocMap, targetEntries])

  const formatInline = (entry: BibliographyEntry): string =>
    formatted.get(entry.key)?.inline ?? formatInlineCitation(entry)

  const formatBibliography = (entry: BibliographyEntry): string =>
    formatted.get(entry.key)?.bibliography ?? formatBibliographyEntry(entry)

  const activeUsingCiteproc = targetEntries.length > 0 && usingCiteproc

  return { formatted, formatInline, formatBibliography, usingCiteproc: activeUsingCiteproc }
}
