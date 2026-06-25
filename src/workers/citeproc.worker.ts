/// <reference lib="webworker" />

import CSL from 'citeproc/citeproc_commonjs.js'

import type { BibliographyEntry } from '../types/vault'
import { bibliographyEntriesToCslItems } from '../lib/bibliographyToCsl'

export interface CiteprocFormatRequest {
  type: 'format'
  requestId: string
  styleXml: string
  localeXml: string
  entries: BibliographyEntry[]
  keys?: string[]
}

export interface CiteprocFormatResponse {
  requestId: string
  ok: boolean
  inline: Record<string, string>
  bibliography: Record<string, string>
  error?: string
}

function stripHtml(value: string): string {
  return value.replace(/<[^>]+>/g, '').trim()
}

function formatEntries(
  styleXml: string,
  localeXml: string,
  entries: BibliographyEntry[],
  keys?: string[],
): { inline: Record<string, string>; bibliography: Record<string, string> } {
  const items = bibliographyEntriesToCslItems(entries)
  const targetKeys = (keys?.length ? keys : entries.map((entry) => entry.key)).filter((key) => items[key])

  const sys = {
    retrieveLocale: (lang: string) => {
      if (lang === 'us' || lang === 'en-US') {
        return localeXml
      }
      return false
    },
    retrieveItem: (id: string) => items[id] ?? null,
  }

  const engine = new CSL.Engine(sys, styleXml)
  engine.updateItems(Object.keys(items))

  const inline: Record<string, string> = {}
  const bibliography: Record<string, string> = {}

  for (const key of targetKeys) {
    const preview = engine.previewCitationCluster({ citationItems: [{ id: key }] }, [], 0)
    inline[key] = stripHtml(preview[1] ?? key)

    engine.updateItems([key])
    const bib = engine.makeBibliography()
    bibliography[key] = stripHtml(bib[1]?.[0] ?? items[key]?.title?.toString() ?? key)
    engine.updateItems(Object.keys(items))
  }

  return { inline, bibliography }
}

self.onmessage = (event: MessageEvent<CiteprocFormatRequest>) => {
  const payload = event.data
  if (payload.type !== 'format') {
    return
  }

  try {
    const formatted = formatEntries(payload.styleXml, payload.localeXml, payload.entries, payload.keys)
    const response: CiteprocFormatResponse = {
      requestId: payload.requestId,
      ok: true,
      inline: formatted.inline,
      bibliography: formatted.bibliography,
    }
    self.postMessage(response)
  } catch (error) {
    const response: CiteprocFormatResponse = {
      requestId: payload.requestId,
      ok: false,
      inline: {},
      bibliography: {},
      error: error instanceof Error ? error.message : String(error),
    }
    self.postMessage(response)
  }
}
