import type { PluginRuntimePolicy } from '@scriptor/core/contracts/plugin'

export type SandboxCapability = 'raw-filesystem' | 'network' | 'secrets' | 'external-process'

export interface SandboxDecision {
  allowed: boolean
  reason?: string
}

const BLOCKED_BY_DEFAULT = new Set<SandboxCapability>([
  'raw-filesystem',
  'network',
  'secrets',
  'external-process',
])

export function evaluateSandboxCapability(
  policy: PluginRuntimePolicy,
  capability: SandboxCapability,
): SandboxDecision {
  if (!policy.enabled) {
    return { allowed: false, reason: 'plugin is disabled' }
  }

  if (BLOCKED_BY_DEFAULT.has(capability)) {
    if (capability === 'network' && policy.networkAccess === 'allowlist') {
      return { allowed: true }
    }
    return { allowed: false, reason: `${capability} is blocked by default sandbox policy` }
  }

  return { allowed: true }
}

export function assertSandboxCapability(
  policy: PluginRuntimePolicy,
  capability: SandboxCapability,
): void {
  const decision = evaluateSandboxCapability(policy, capability)
  if (!decision.allowed) {
    throw new Error(decision.reason ?? `sandbox denied ${capability}`)
  }
}

export function runSandboxTests(): string[] {
  const failures: string[] = []
  const policy: PluginRuntimePolicy = {
    pluginId: 'scriptor.test',
    enabled: true,
    grantedPermissions: ['read'],
    allowedVaultIds: [],
    networkAccess: 'blocked',
    allowlistedHosts: [],
  }

  if (evaluateSandboxCapability(policy, 'raw-filesystem').allowed) {
    failures.push('raw filesystem should be blocked')
  }
  if (evaluateSandboxCapability(policy, 'network').allowed) {
    failures.push('network should be blocked by default')
  }
  if (evaluateSandboxCapability({ ...policy, enabled: false }, 'raw-filesystem').allowed) {
    failures.push('disabled plugin should not access sandbox capabilities')
  }

  try {
    assertSandboxCapability(policy, 'external-process')
    failures.push('external-process should throw')
  } catch {
    // expected
  }

  return failures
}
