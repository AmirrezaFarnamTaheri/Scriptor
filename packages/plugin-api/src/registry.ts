import type { PluginManifest, PluginRuntimePolicy } from '@scriptor/core/contracts/plugin'

import { validatePluginManifest } from './manifest.ts'

export interface PluginRegistryEntry {
  manifestId: string
  enabled: boolean
  loadedAt?: string
  lastError?: string
}

export interface PluginRegistrySnapshot {
  entries: PluginRegistryEntry[]
  safeMode: boolean
}

export interface LoadedPlugin {
  manifest: PluginManifest
  enabled: boolean
  loadedAt: string
  lastError?: string
}

export class PluginRegistry {
  private plugins = new Map<string, LoadedPlugin>()
  private safeMode = false

  constructor(initialSafeMode = false) {
    this.safeMode = initialSafeMode
  }

  register(manifest: PluginManifest): { ok: true } | { ok: false; errors: string[] } {
    const validation = validatePluginManifest(manifest)
    if (!validation.ok) {
      return { ok: false, errors: validation.errors }
    }

    this.plugins.set(manifest.id, {
      manifest,
      enabled: !this.safeMode,
      loadedAt: new Date().toISOString(),
    })
    return { ok: true }
  }

  setSafeMode(enabled: boolean): void {
    this.safeMode = enabled
    for (const plugin of this.plugins.values()) {
      plugin.enabled = !enabled
      if (enabled) {
        plugin.lastError = undefined
      }
    }
  }

  isSafeMode(): boolean {
    return this.safeMode
  }

  setEnabled(pluginId: string, enabled: boolean): boolean {
    if (this.safeMode && enabled) return false
    const plugin = this.plugins.get(pluginId)
    if (!plugin) return false
    plugin.enabled = enabled
    plugin.lastError = undefined
    return true
  }

  get(pluginId: string): LoadedPlugin | undefined {
    return this.plugins.get(pluginId)
  }

  has(pluginId: string): boolean {
    return this.plugins.has(pluginId)
  }

  listEnabled(): LoadedPlugin[] {
    return Array.from(this.plugins.values()).filter((plugin) => plugin.enabled)
  }

  listAll(): LoadedPlugin[] {
    return Array.from(this.plugins.values())
  }

  getSnapshot(): PluginRegistrySnapshot {
    const entries: PluginRegistryEntry[] = this.listAll().map((plugin) => ({
      manifestId: plugin.manifest.id,
      enabled: plugin.enabled,
      loadedAt: plugin.loadedAt,
      lastError: plugin.lastError,
    }))
    return { entries, safeMode: this.safeMode }
  }

  defaultPolicy(pluginId: string): PluginRuntimePolicy | null {
    const plugin = this.plugins.get(pluginId)
    if (!plugin) return null
    return {
      pluginId,
      enabled: plugin.enabled,
      grantedPermissions: plugin.manifest.permissions.map((entry) => entry.permission),
      allowedVaultIds: [],
      networkAccess: 'blocked',
      allowlistedHosts: [],
    }
  }
}

export function runRegistryTests(): string[] {
  const failures: string[] = []
  const registry = new PluginRegistry(true)
  const result = registry.register({
    id: 'scriptor.test',
    name: 'Test',
    version: '0.0.1',
    publisher: 'Scriptor',
    description: 'Test plugin',
    activation: ['manual'],
    capabilities: ['command'],
    permissions: [{ permission: 'read', reason: 'test' }],
  })

  if (!result.ok) failures.push('registry should accept valid plugin')
  if (!registry.isSafeMode()) failures.push('registry should start in safe mode when configured')
  if (registry.listEnabled().length > 0) failures.push('safe mode should disable plugins')
  if (!registry.setEnabled('scriptor.test', true)) {
    // expected while safe mode is on
  } else {
    failures.push('should not enable plugin while safe mode is on')
  }

  registry.setSafeMode(false)
  if (!registry.setEnabled('scriptor.test', true)) failures.push('should enable plugin after safe mode off')
  if (registry.listEnabled().length !== 1) failures.push('enabled plugin should appear in list')

  return failures
}
