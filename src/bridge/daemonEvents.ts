import { isTauriRuntime } from './platform'
import type { VaultConfig } from '../types/vault'

export interface DaemonConfigReloadedEvent {
  json: string
  generation: number
}

export async function subscribeDaemonConfigReloaded(
  handler: (event: DaemonConfigReloadedEvent) => void,
): Promise<() => void> {
  if (!isTauriRuntime()) {
    return () => {}
  }

  const { listen } = await import('@tauri-apps/api/event')
  return listen<DaemonConfigReloadedEvent>('daemon:config-reloaded', (event) => handler(event.payload))
}

export function parseVaultConfigFromDaemonJson(json: string): VaultConfig {
  return JSON.parse(json) as VaultConfig
}
