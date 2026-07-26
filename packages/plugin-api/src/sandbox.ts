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

/** What a capability is being requested *against*, when that is meaningful. */
export interface SandboxTarget {
  /** Hostname for a `network` request, e.g. `api.example.com`. */
  host?: string
}

/**
 * Match a hostname against one allowlist entry.
 *
 * An entry matches itself and its subdomains, anchored on a dot boundary so
 * `evil-example.com` cannot satisfy an `example.com` entry. Comparison is
 * case-insensitive; a trailing dot (the FQDN root) is ignored.
 */
function hostMatches(host: string, entry: string): boolean {
  const normalize = (value: string) => value.trim().toLowerCase().replace(/\.$/, '')
  const candidate = normalize(host)
  const allowed = normalize(entry)
  if (!candidate || !allowed) return false
  return candidate === allowed || candidate.endsWith(`.${allowed}`)
}

export function evaluateSandboxCapability(
  policy: PluginRuntimePolicy,
  capability: SandboxCapability,
  target?: SandboxTarget,
): SandboxDecision {
  if (!policy.enabled) {
    return { allowed: false, reason: 'plugin is disabled' }
  }

  if (BLOCKED_BY_DEFAULT.has(capability)) {
    if (capability === 'network' && policy.networkAccess === 'allowlist') {
      // An allowlist that cannot see the destination is not an allowlist, so a
      // request with no host is denied rather than waved through.
      const host = target?.host?.trim()
      if (!host) {
        return {
          allowed: false,
          reason: 'network allowlist requires the destination host to be supplied',
        }
      }
      const hosts = policy.allowlistedHosts ?? []
      if (hosts.some((entry) => hostMatches(host, entry))) {
        return { allowed: true }
      }
      return { allowed: false, reason: `host ${host} is not in the plugin network allowlist` }
    }
    return { allowed: false, reason: `${capability} is blocked by default sandbox policy` }
  }

  return { allowed: true }
}

export function assertSandboxCapability(
  policy: PluginRuntimePolicy,
  capability: SandboxCapability,
  target?: SandboxTarget,
): void {
  const decision = evaluateSandboxCapability(policy, capability, target)
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

  const allowlisted: PluginRuntimePolicy = {
    ...policy,
    networkAccess: 'allowlist',
    allowlistedHosts: ['api.example.com'],
  }

  if (evaluateSandboxCapability(allowlisted, 'network').allowed) {
    failures.push('allowlist mode should deny a request with no host')
  }
  if (!evaluateSandboxCapability(allowlisted, 'network', { host: 'api.example.com' }).allowed) {
    failures.push('allowlist mode should permit an allowlisted host')
  }
  if (!evaluateSandboxCapability(allowlisted, 'network', { host: 'EU.API.example.com.' }).allowed) {
    failures.push('allowlist matching should be case-insensitive and cover subdomains')
  }
  if (evaluateSandboxCapability(allowlisted, 'network', { host: 'evil.com' }).allowed) {
    failures.push('allowlist mode should deny a host outside the allowlist')
  }
  if (
    evaluateSandboxCapability(allowlisted, 'network', { host: 'evil-api.example.com.attacker.net' })
      .allowed
  ) {
    failures.push('allowlist matching must anchor on a dot boundary')
  }
  if (evaluateSandboxCapability(allowlisted, 'network', { host: 'notapi.example.com.evil' }).allowed) {
    failures.push('allowlist matching must not permit a suffix-extended host')
  }
  if (
    evaluateSandboxCapability(
      { ...allowlisted, allowlistedHosts: [] },
      'network',
      { host: 'api.example.com' },
    ).allowed
  ) {
    failures.push('an empty allowlist should deny every host')
  }

  return failures
}
