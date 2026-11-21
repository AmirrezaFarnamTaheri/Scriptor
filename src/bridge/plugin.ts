/**
 * Bridge layer for plugin state persistence.
 */
import { invoke } from '@tauri-apps/api/core'
import { isNativeBridgeAvailable } from './platform.ts'
import { DEFAULT_ENABLED_PLUGINS } from '../context/plugin-defaults.ts'

type NativePluginState = {
  enabledPlugins: string[]
  disabledPlugins: string[]
  settings?: Record<string, Record<string, unknown>>
}

export async function setPluginCapabilityEnabled(capabilityId: string, enabled: boolean): Promise<void> {
  if (!isNativeBridgeAvailable()) return
  if (!capabilityId) throw new Error('capabilityId is required for vault-backed plugin state')
  await invoke('plugin_state_set_enabled', { capabilityId, enabled })
}

export async function savePluginState(enabledIds: Set<string> | string[], capabilityId?: string): Promise<void> {
  if (!capabilityId) throw new Error('capabilityId is required for vault-backed plugin state')
  await setPluginCapabilityEnabled(capabilityId, Array.from(enabledIds).includes(capabilityId))
}

export async function loadPluginState(): Promise<Set<string> | null> {
  if (!isNativeBridgeAvailable()) return null
  const state = await invoke<NativePluginState>('plugin_state_get')
  const enabled = new Set(DEFAULT_ENABLED_PLUGINS)
  for (const id of state.enabledPlugins) enabled.add(id)
  for (const id of state.disabledPlugins) enabled.delete(id)
  return enabled
}

const AGENT_ACCESS_CAPABILITY = 'scriptor.mcp'
const AGENT_ACCESS_MODES = ['off', 'read-only', 'draft', 'write-approved'] as const
export type AgentAccessMode = (typeof AGENT_ACCESS_MODES)[number]

/** Per-user agent access level; `null` when the user never chose one. A vault
 * can never supply this value, so a cloned vault cannot grant agents access. */
export async function loadAgentAccessMode(): Promise<AgentAccessMode | null> {
  if (!isNativeBridgeAvailable()) return null
  const state = await invoke<NativePluginState>('plugin_state_get')
  const mode = state.settings?.[AGENT_ACCESS_CAPABILITY]?.mode
  return AGENT_ACCESS_MODES.find((candidate) => candidate === mode) ?? null
}

export async function saveAgentAccessMode(mode: AgentAccessMode): Promise<void> {
  if (!isNativeBridgeAvailable()) return
  await invoke('plugin_state_set_setting', { capabilityId: AGENT_ACCESS_CAPABILITY, key: 'mode', value: mode })
}
