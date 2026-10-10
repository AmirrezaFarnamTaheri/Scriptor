import styleXml from '../assets/citeproc/apa-lite.csl?raw'
import localeXml from '../assets/citeproc/locales-en-US.xml?raw'
// Classic bundled worker (vite worker.format=iife) - module workers never
// start under the Tauri custom protocol.
import CiteprocWorker from '../workers/citeproc.worker.ts?worker'
import type { CiteprocFormatRequest, CiteprocFormatResponse } from '../workers/citeproc.worker'
import type { BibliographyEntry } from '../types/vault'
import type { CslCitationCluster } from './citeprocEngine'

export interface CiteprocFormattedEntry {
  key: string
  inline: string
  bibliography: string
}

let worker: Worker | null = null
let nextRequestId = 0
const REQUEST_TIMEOUT_MS = 20_000
const pending = new Map<
  string,
  {
    resolve: (value: CiteprocFormatResponse) => void
    reject: (reason: Error) => void
    timeoutId: number
  }
>()

function ensureWorker(): Worker {
  if (worker) {
    return worker
  }

  worker = new CiteprocWorker()
  worker.onmessage = (event: MessageEvent<CiteprocFormatResponse>) => {
    const payload = event.data
    const handler = pending.get(payload.requestId)
    if (!handler) {
      return
    }
    pending.delete(payload.requestId)
    window.clearTimeout(handler.timeoutId)

    if (!payload.ok) {
      handler.reject(new Error(payload.error ?? 'citeproc worker failed'))
      return
    }

    handler.resolve(payload)
  }
  worker.onerror = (event) => {
    for (const [, handler] of pending) {
      window.clearTimeout(handler.timeoutId)
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

  const payload = await requestCiteproc(entries, keys)
  const resultKeys = [...new Set([...Object.keys(payload.inline), ...Object.keys(payload.bibliography)])]
  return new Map(resultKeys.map(key => [key, {
    key, inline: payload.inline[key] ?? key, bibliography: payload.bibliography[key] ?? key,
  }]))
}

export async function formatCitationClustersWithCiteproc(entries: BibliographyEntry[], clusters: CslCitationCluster[]): Promise<ReadonlyMap<string, string>> {
  if (entries.length === 0 || clusters.length === 0) return new Map()
  const keys = [...new Set(clusters.flatMap(cluster => cluster.items.map(item => item.id)))]
  const payload = await requestCiteproc(entries, keys, clusters)
  return new Map(Object.entries(payload.clusters ?? {}))
}

async function requestCiteproc(entries: BibliographyEntry[], keys?: string[], clusters?: CslCitationCluster[]): Promise<CiteprocFormatResponse> {
  if (pending.size >= 16) throw new Error('citation preview queue is full')

  const requestId = `citeproc-${nextRequestId++}`
  const request: CiteprocFormatRequest = {
    type: 'format',
    requestId,
    styleXml,
    localeXml,
    entries,
    keys,
    clusters,
  }

  return new Promise<CiteprocFormatResponse>((resolve, reject) => {
    const timeoutId = window.setTimeout(() => {
      pending.delete(requestId)
      reject(new Error('citeproc worker timed out'))
    }, REQUEST_TIMEOUT_MS)
    pending.set(requestId, { resolve, reject, timeoutId })
    try {
      ensureWorker().postMessage(request)
    } catch (error) {
      window.clearTimeout(timeoutId)
      pending.delete(requestId)
      reject(error instanceof Error ? error : new Error('citation worker could not start'))
    }
  })

}
