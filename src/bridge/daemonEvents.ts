import { isTauriRuntime } from './platform'
import type { VaultConfig } from '../types/vault'
import { parseVaultConfig } from '../types/vaultValidators'

export interface DaemonConfigReloadedEvent {
  json: string
  generation: number
}

export interface DaemonResyncRequiredEvent {
  reason: string
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

export async function subscribeDaemonResyncRequired(
  handler: (event: DaemonResyncRequiredEvent) => void,
): Promise<() => void> {
  if (!isTauriRuntime()) {
    return () => {}
  }

  const { listen } = await import('@tauri-apps/api/event')
  return listen<DaemonResyncRequiredEvent>('daemon:resync-required', (event) => handler(event.payload))
}

export function parseVaultConfigFromDaemonJson(json: string): VaultConfig {
  return parseVaultConfig(json)
}
