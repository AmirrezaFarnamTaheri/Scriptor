/// <reference lib="webworker" />

import type { BibliographyEntry } from '../types/vault'
import { formatCslEntries, type CslCitationCluster } from '../lib/citeprocEngine'

export interface CiteprocFormatRequest {
  type: 'format'
  requestId: string
  styleXml: string
  localeXml: string
  entries: BibliographyEntry[]
  keys?: string[]
  clusters?: CslCitationCluster[]
}

export interface CiteprocFormatResponse {
  requestId: string
  ok: boolean
  inline: Record<string, string>
  bibliography: Record<string, string>
  clusters?: Record<string, string>
  error?: string
}

self.onmessage = (event: MessageEvent<CiteprocFormatRequest>) => {
  const payload = event.data
  if (payload.type !== 'format') {
    return
  }

  try {
    const formatted = formatCslEntries(payload.styleXml, payload.localeXml, payload.entries, payload.keys, payload.clusters)
    const response: CiteprocFormatResponse = {
      requestId: payload.requestId,
      ok: true,
      inline: formatted.inline,
      bibliography: formatted.bibliography,
      clusters: formatted.clusters,
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
