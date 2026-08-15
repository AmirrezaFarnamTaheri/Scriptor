/**
 * Bridge layer for plugin state persistence.
 */
import { invoke } from '@tauri-apps/api/core'
import { isNativeBridgeAvailable } from './platform.ts'
import { DEFAULT_ENABLED_PLUGINS } from '../context/plugin-defaults.ts'

const PLUGIN_STORAGE_KEY = 'scriptor_enabled_plugins'

type NativePluginState = { enabledPlugins: string[]; disabledPlugins: string[] }

function loadLegacyPluginIds(): string[] | null {
  if (typeof localStorage === 'undefined') return null
  const raw = localStorage.getItem(PLUGIN_STORAGE_KEY)
  if (!raw) return null
  const parsed: unknown = JSON.parse(raw)
  if (!Array.isArray(parsed) || !parsed.every((value) => typeof value === 'string')) {
    throw new Error('Legacy plugin state is malformed; it was not migrated')
  }
  return parsed
}

export async function savePluginState(enabledIds: Set<string> | string[], capabilityId?: string): Promise<void> {
  if (!isNativeBridgeAvailable()) return
  if (!capabilityId) throw new Error('capabilityId is required for vault-backed plugin state')
  await invoke('plugin_state_set_enabled', { capabilityId, enabled: Array.from(enabledIds).includes(capabilityId) })
}

export async function loadPluginState(): Promise<Set<string> | null> {
  if (isNativeBridgeAvailable()) {
    let state = await invoke<NativePluginState>('plugin_state_get')
    const legacyIds = loadLegacyPluginIds()
    if (legacyIds) {
      state = await invoke<NativePluginState>('plugin_state_migrate_legacy', { enabledPluginIds: legacyIds })
      localStorage.removeItem(PLUGIN_STORAGE_KEY)
    }
    const enabled = new Set(DEFAULT_ENABLED_PLUGINS)
    for (const id of state.enabledPlugins) enabled.add(id)
    for (const id of state.disabledPlugins) enabled.delete(id)
    return enabled
  }
  if (typeof localStorage !== 'undefined') {
    const legacyIds = loadLegacyPluginIds()
    if (legacyIds) return new Set(legacyIds)
  }
  return null
}
