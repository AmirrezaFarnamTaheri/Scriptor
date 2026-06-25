import type { VaultFilesystemChangedEvent } from '../types/vault'
import { isTauriRuntime } from './platform'

export type VaultEventUnlisten = () => void

export async function subscribeVaultEvents(handlers: {
  onFilesystemChanged?: (event: VaultFilesystemChangedEvent) => void
}): Promise<VaultEventUnlisten> {
  if (!isTauriRuntime()) {
    return () => {}
  }

  const { listen } = await import('@tauri-apps/api/event')
  const unlisteners: VaultEventUnlisten[] = []

  if (handlers.onFilesystemChanged) {
    unlisteners.push(
      await listen<VaultFilesystemChangedEvent>('vault:filesystem-changed', (event) =>
        handlers.onFilesystemChanged?.(event.payload),
      ),
    )
  }

  return () => {
    for (const unlisten of unlisteners) {
      unlisten()
    }
  }
}
