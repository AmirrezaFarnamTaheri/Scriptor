import type { PluginRuntimePolicy } from '@scriptor/core/contracts/plugin'

import { assertSandboxCapability } from './sandbox.ts'
import type { ReadOnlyVaultQuery } from './vault-query.ts'

export class PluginHost {
  private readonly policy: PluginRuntimePolicy
  private readonly vaultQuery: ReadOnlyVaultQuery | null

  constructor(policy: PluginRuntimePolicy, vaultQuery: ReadOnlyVaultQuery | null) {
    this.policy = policy
    this.vaultQuery = vaultQuery
  }

  readRawFile(_path: string): string {
    assertSandboxCapability(this.policy, 'raw-filesystem')
    throw new Error('unreachable')
  }

  async searchVault(query: string, limit = 10) {
    if (!this.vaultQuery) {
      throw new Error('vault query adapter is unavailable')
    }
    return this.vaultQuery.search(query, limit)
  }

  async readVaultNote(path: string) {
    if (!this.vaultQuery) {
      throw new Error('vault query adapter is unavailable')
    }
    return this.vaultQuery.readNote(path)
  }
}

export function runHostSandboxTests(): string[] {
  const failures: string[] = []
  const host = new PluginHost(
    {
      pluginId: 'fixture.malicious-plugin',
      enabled: true,
      grantedPermissions: ['read'],
      allowedVaultIds: [],
      networkAccess: 'blocked',
      allowlistedHosts: [],
    },
    null,
  )

  try {
    host.readRawFile('C:\\Windows\\System32\\config\\SAM')
    failures.push('malicious raw filesystem read should be blocked')
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (!message.includes('raw-filesystem')) {
      failures.push('malicious raw filesystem read should mention sandbox block')
    }
  }

  return failures
}
