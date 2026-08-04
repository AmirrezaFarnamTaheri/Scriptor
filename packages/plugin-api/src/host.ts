import type { PluginPermission, PluginRuntimePolicy } from '@scriptor/core/contracts/plugin'

import { assertSandboxCapability } from './sandbox.ts'
import type { ReadOnlyVaultQuery } from './vault-query.ts'

function assertVaultPermission(
  policy: PluginRuntimePolicy,
  vaultId: string | null,
  permission: PluginPermission['permission'],
): void {
  if (!policy.enabled) throw new Error('plugin is disabled')
  if (!policy.grantedPermissions.includes(permission)) {
    throw new Error(`plugin permission not granted: ${permission}`)
  }
  if (!vaultId || !policy.allowedVaultIds.includes(vaultId)) {
    throw new Error('active vault is outside the plugin consent scope')
  }
}

export class PluginHost {
  private readonly policy: PluginRuntimePolicy
  private readonly vaultId: string | null
  private readonly vaultQuery: ReadOnlyVaultQuery | null

  constructor(
    policy: PluginRuntimePolicy,
    vaultId: string | null,
    vaultQuery: ReadOnlyVaultQuery | null,
  ) {
    this.policy = policy
    this.vaultId = vaultId
    this.vaultQuery = vaultQuery
  }

  readRawFile(_path: string): string {
    assertSandboxCapability(this.policy, 'raw-filesystem')
    throw new Error('unreachable')
  }

  async searchVault(query: string, limit = 10) {
    assertVaultPermission(this.policy, this.vaultId, 'read')
    if (!this.vaultQuery) throw new Error('vault query adapter is unavailable')
    return this.vaultQuery.search(query, limit)
  }

  async readVaultNote(path: string) {
    assertVaultPermission(this.policy, this.vaultId, 'read')
    if (!this.vaultQuery) throw new Error('vault query adapter is unavailable')
    return this.vaultQuery.readNote(path)
  }
}

export async function runHostSandboxTests(): Promise<string[]> {
  const failures: string[] = []
  const policy: PluginRuntimePolicy = {
    pluginId: 'fixture.malicious-plugin',
    enabled: true,
    grantedPermissions: ['read'],
    allowedVaultIds: ['vault-a'],
    networkAccess: 'blocked',
    allowlistedHosts: [],
  }
  const host = new PluginHost(policy, 'vault-a', null)

  try {
    host.readRawFile('C:\\Windows\\System32\\config\\SAM')
    failures.push('malicious raw filesystem read should be blocked')
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (!message.includes('raw-filesystem')) {
      failures.push('malicious raw filesystem read should mention sandbox block')
    }
  }

  const wrongVaultHost = new PluginHost(policy, 'vault-b', {
    search: async () => [],
    readNote: async () => ({ path: 'x.md', title: 'x', markdown: '' }),
    backlinks: async () => [],
    healthIssues: async () => [],
  })
  try {
    await wrongVaultHost.searchVault('test')
    failures.push('vault-scoped host should reject a different active vault')
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (!message.includes('outside the plugin consent scope')) {
      failures.push('vault-scoped rejection should explain the consent boundary')
    }
  }

  return failures
}
