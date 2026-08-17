/**
 * Bridge layer for plugin state persistence.
 */
import { invoke } from '@tauri-apps/api/core'
import { isNativeBridgeAvailable } from './platform.ts'
import { DEFAULT_ENABLED_PLUGINS } from '../context/plugin-defaults.ts'

type NativePluginState = { enabledPlugins: string[]; disabledPlugins: string[] }

export async function savePluginState(enabledIds: Set<string> | string[], capabilityId?: string): Promise<void> {
  if (!isNativeBridgeAvailable()) return
  if (!capabilityId) throw new Error('capabilityId is required for vault-backed plugin state')
  await invoke('plugin_state_set_enabled', { capabilityId, enabled: Array.from(enabledIds).includes(capabilityId) })
}

export async function loadPluginState(): Promise<Set<string> | null> {
  if (!isNativeBridgeAvailable()) return null
  const state = await invoke<NativePluginState>('plugin_state_get')
  const enabled = new Set(DEFAULT_ENABLED_PLUGINS)
  for (const id of state.enabledPlugins) enabled.add(id)
  for (const id of state.disabledPlugins) enabled.delete(id)
  return enabled
}
