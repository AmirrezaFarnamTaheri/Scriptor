import type {
  ExportJobFailedEvent,
  ExportJobFinishedEvent,
  ExportJobProgressEvent,
  ExportJobStarted,
} from '../types/vault'
import { isTauriRuntime } from './platform'

export type ExportEventUnlisten = () => void

export async function subscribeExportEvents(handlers: {
  onStarted?: (event: ExportJobStarted) => void
  onFinished?: (event: ExportJobFinishedEvent) => void
  onFailed?: (event: ExportJobFailedEvent) => void
  onProgress?: (event: ExportJobProgressEvent) => void
}): Promise<ExportEventUnlisten> {
  if (!isTauriRuntime()) {
    return () => {}
  }

  const { listen } = await import('@tauri-apps/api/event')
  const unlisteners: ExportEventUnlisten[] = []

  if (handlers.onStarted) {
    unlisteners.push(await listen<ExportJobStarted>('export:started', (event) => handlers.onStarted?.(event.payload)))
  }
  if (handlers.onFinished) {
    unlisteners.push(
      await listen<ExportJobFinishedEvent>('export:finished', (event) => handlers.onFinished?.(event.payload)),
    )
  }
  if (handlers.onFailed) {
    unlisteners.push(
      await listen<ExportJobFailedEvent>('export:failed', (event) => handlers.onFailed?.(event.payload)),
    )
  }
  if (handlers.onProgress) {
    unlisteners.push(
      await listen<ExportJobProgressEvent>('export:progress', (event) => handlers.onProgress?.(event.payload)),
    )
  }

  return () => {
    for (const unlisten of unlisteners) {
      unlisten()
    }
  }
}
