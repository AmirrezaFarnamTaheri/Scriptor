import styleXml from '../assets/citeproc/apa-lite.csl?raw'
import localeXml from '../assets/citeproc/locales-en-US.xml?raw'
import type { CiteprocFormatRequest, CiteprocFormatResponse } from '../workers/citeproc.worker'
import type { BibliographyEntry } from '../types/vault'

export interface CiteprocFormattedEntry {
  key: string
  inline: string
  bibliography: string
}

let worker: Worker | null = null
let nextRequestId = 0
const pending = new Map<
  string,
  { resolve: (value: CiteprocFormattedEntry[]) => void; reject: (reason: Error) => void }
>()

function ensureWorker(): Worker {
  if (worker) {
    return worker
  }

  worker = new Worker(new URL('../workers/citeproc.worker.ts', import.meta.url), { type: 'module' })
  worker.onmessage = (event: MessageEvent<CiteprocFormatResponse>) => {
    const payload = event.data
    const handler = pending.get(payload.requestId)
    if (!handler) {
      return
    }
    pending.delete(payload.requestId)

    if (!payload.ok) {
      handler.reject(new Error(payload.error ?? 'citeproc worker failed'))
      return
    }

    const keys = [...new Set([...Object.keys(payload.inline), ...Object.keys(payload.bibliography)])]
    handler.resolve(
      keys.map((key) => ({
        key,
        inline: payload.inline[key] ?? key,
        bibliography: payload.bibliography[key] ?? key,
      })),
    )
  }
  worker.onerror = (event) => {
    for (const [, handler] of pending) {
      handler.reject(new Error(event.message || 'citeproc worker crashed'))
    }
    pending.clear()
    worker?.terminate()
    worker = null
  }

  return worker
}

export async function formatBibliographyWithCiteproc(
  entries: BibliographyEntry[],
  keys?: string[],
): Promise<Map<string, CiteprocFormattedEntry>> {
  if (entries.length === 0) {
    return new Map()
  }

  const requestId = `citeproc-${nextRequestId++}`
  const request: CiteprocFormatRequest = {
    type: 'format',
    requestId,
    styleXml,
    localeXml,
    entries,
    keys,
  }

  const formatted = await new Promise<CiteprocFormattedEntry[]>((resolve, reject) => {
    pending.set(requestId, { resolve, reject })
    ensureWorker().postMessage(request)
  })

  return new Map(formatted.map((entry) => [entry.key, entry]))
}
