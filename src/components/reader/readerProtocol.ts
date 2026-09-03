import type { ReaderAnnotation } from './useReaderStore'

export interface ReaderViewerLocation {
  url: string
  origin: string
}

export type ReaderInboundMessage =
  | { type: 'READY' }
  | { type: 'LOADED' }
  | { type: 'POSITION'; position: string }
  | { type: 'SELECTION'; anchor: string; quote: string }
  | { type: 'SELECTION_CLEAR' }
  | { type: 'ERROR'; message: string }

export type ReaderOutboundMessage =
  | { type: 'LOAD_BYTES'; bytes: ArrayBuffer }
  | { type: 'GOTO'; position: string }
  | { type: 'ZOOM'; delta: number }
  | { type: 'HIGHLIGHT'; annotation: ReaderAnnotation }
  | { type: 'HIGHLIGHTS'; annotations: ReaderAnnotation[] }

export function parseReaderInboundMessage(value: unknown): ReaderInboundMessage | null {
  if (!isRecord(value) || typeof value.type !== 'string') return null
  switch (value.type) {
    case 'READY':
    case 'LOADED':
    case 'SELECTION_CLEAR':
      return { type: value.type }
    case 'POSITION':
      return typeof value.position === 'string'
        ? { type: 'POSITION', position: value.position }
        : null
    case 'SELECTION':
      return typeof value.anchor === 'string' && typeof value.quote === 'string'
        ? { type: 'SELECTION', anchor: value.anchor, quote: value.quote }
        : null
    case 'ERROR':
      return typeof value.message === 'string'
        ? { type: 'ERROR', message: value.message }
        : null
    default:
      return null
  }
}

export function readerUrl(location: ReaderViewerLocation, appOrigin: string): string {
  const separator = location.url.includes('?') ? '&' : '?'
  return `${location.url}${separator}parentOrigin=${encodeURIComponent(appOrigin)}`
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
