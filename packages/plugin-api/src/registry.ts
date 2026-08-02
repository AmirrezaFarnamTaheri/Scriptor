import type {
  PluginManifest,
  PluginPermission,
  PluginRuntimePolicy,
} from '@scriptor/core/contracts/plugin'

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

export interface PluginConsent {
  grantedPermissions: Array<PluginPermission['permission']>
  allowedVaultIds: string[]
  networkAccess?: 'blocked' | 'allowlist'
  allowlistedHosts?: string[]
  reviewedAt?: string
}

export interface LoadedPlugin {
  manifest: PluginManifest
  enabled: boolean
  loadedAt: string
  lastError?: string
}

function uniqueStrings(values: readonly string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)))
}

export class PluginRegistry {
  private plugins = new Map<string, LoadedPlugin>()
  private policies = new Map<string, PluginConsent>()
  private safeMode = false

  constructor(initialSafeMode = false, initialPolicies: Record<string, PluginConsent> = {}) {
    this.safeMode = initialSafeMode
    for (const [pluginId, consent] of Object.entries(initialPolicies)) {
      this.policies.set(pluginId, {
        grantedPermissions: uniqueStrings(consent.grantedPermissions) as Array<PluginPermission['permission']>,
        allowedVaultIds: uniqueStrings(consent.allowedVaultIds),
        networkAccess: consent.networkAccess === 'allowlist' ? 'allowlist' : 'blocked',
        allowlistedHosts: uniqueStrings(consent.allowlistedHosts ?? []),
        reviewedAt: consent.reviewedAt,
      })
    }
  }

  register(manifest: PluginManifest): { ok: true } | { ok: false; errors: string[] } {
    const validation = validatePluginManifest(manifest)
    if (!validation.ok) {
      return { ok: false, errors: validation.errors }
    }

    // Installation and execution are separate decisions. A valid manifest is
    // registered disabled until its requested permissions have been reviewed.
    this.plugins.set(manifest.id, {
      manifest,
      enabled: false,
      loadedAt: new Date().toISOString(),
    })
    return { ok: true }
  }

  setSafeMode(enabled: boolean): void {
    this.safeMode = enabled
    if (!enabled) return
    for (const plugin of this.plugins.values()) {
      plugin.enabled = false
      plugin.lastError = undefined
    }
  }

  isSafeMode(): boolean {
    return this.safeMode
  }

  setConsent(pluginId: string, consent: PluginConsent): boolean {
    const plugin = this.plugins.get(pluginId)
    if (!plugin) return false
    const declared = new Set(plugin.manifest.permissions.map((entry) => entry.permission))
    const grantedPermissions = uniqueStrings(consent.grantedPermissions).filter((permission) =>
      declared.has(permission as PluginPermission['permission']),
    ) as Array<PluginPermission['permission']>
    this.policies.set(pluginId, {
      grantedPermissions,
      allowedVaultIds: uniqueStrings(consent.allowedVaultIds),
      networkAccess: consent.networkAccess === 'allowlist' ? 'allowlist' : 'blocked',
      allowlistedHosts: uniqueStrings(consent.allowlistedHosts ?? []),
      reviewedAt: consent.reviewedAt ?? new Date().toISOString(),
    })
    if (!this.canEnable(pluginId)) plugin.enabled = false
    return true
  }

  revokeConsent(pluginId: string): boolean {
    const plugin = this.plugins.get(pluginId)
    if (!plugin) return false
    plugin.enabled = false
    this.policies.delete(pluginId)
    return true
  }

  getConsent(pluginId: string): PluginConsent | null {
    return this.policies.get(pluginId) ?? null
  }

  exportConsents(): Record<string, PluginConsent> {
    return Object.fromEntries(this.policies.entries())
  }

  canEnable(pluginId: string, vaultId?: string | null): boolean {
    if (this.safeMode) return false
    const plugin = this.plugins.get(pluginId)
    const consent = this.policies.get(pluginId)
    if (!plugin || !consent) return false
    const granted = new Set(consent.grantedPermissions)
    const required = plugin.manifest.permissions.filter((entry) => !entry.optional)
    if (!required.every((entry) => granted.has(entry.permission))) return false
    const needsVault = required.some((entry) => entry.permission === 'read' || entry.permission === 'write-approved')
    if (needsVault && (!vaultId || !consent.allowedVaultIds.includes(vaultId))) return false
    return true
  }

  setEnabled(pluginId: string, enabled: boolean, vaultId?: string | null): boolean {
    const plugin = this.plugins.get(pluginId)
    if (!plugin) return false
    if (enabled && !this.canEnable(pluginId, vaultId)) return false
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
    const consent = this.policies.get(pluginId)
    return {
      pluginId,
      enabled: plugin.enabled,
      grantedPermissions: consent?.grantedPermissions ?? [],
      allowedVaultIds: consent?.allowedVaultIds ?? [],
      networkAccess: consent?.networkAccess ?? 'blocked',
      allowlistedHosts: consent?.allowlistedHosts ?? [],
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
  if (registry.setEnabled('scriptor.test', true, 'vault-a')) {
    failures.push('safe mode should block plugin enablement')
  }

  registry.setSafeMode(false)
  if (registry.setEnabled('scriptor.test', true, 'vault-a')) {
    failures.push('unreviewed permissions should block plugin enablement')
  }
  registry.setConsent('scriptor.test', {
    grantedPermissions: ['read'],
    allowedVaultIds: ['vault-a'],
  })
  if (!registry.setEnabled('scriptor.test', true, 'vault-a')) {
    failures.push('reviewed plugin should enable for its allowed vault')
  }
  if (registry.setEnabled('scriptor.test', true, 'vault-b')) {
    failures.push('plugin should not enable for a vault outside its scope')
  }
  if (!registry.revokeConsent('scriptor.test')) failures.push('consent should be revocable')
  if (registry.listEnabled().length !== 0) failures.push('revocation should disable the plugin')

  return failures
}
