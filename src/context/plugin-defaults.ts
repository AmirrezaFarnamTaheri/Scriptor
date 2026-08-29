export type InstallerProfile =
  | 'minimal'
  | 'writer'
  | 'scientific'
  | 'researcher'
  | 'developer'
  | 'complete'
  | 'focused'
  | 'custom'

export const INSTALLER_PROFILES: Record<Exclude<InstallerProfile, 'custom'>, readonly string[]> = {
  focused: [],
  minimal: ['scriptor.export'],
  writer: ['scriptor.export', 'scriptor.canvas'],
  scientific: ['scriptor.export', 'scriptor.citations', 'scriptor.graph'],
  researcher: ['scriptor.export', 'scriptor.graph', 'scriptor.mcp'],
  developer: ['scriptor.export', 'scriptor.graph', 'scriptor.canvas', 'scriptor.mcp'],
  complete: ['scriptor.export', 'scriptor.citations', 'scriptor.graph', 'scriptor.canvas', 'scriptor.mcp'],
} as const

export const DEFAULT_INSTALLER_PROFILE: InstallerProfile = 'complete'

export function getProfilePluginIds(profile: InstallerProfile): Set<string> {
  if (profile === 'custom') return new Set(INSTALLER_PROFILES.complete)
  return new Set(INSTALLER_PROFILES[profile] ?? INSTALLER_PROFILES.complete)
}

/**
 * Applies an installer profile to the built-in plugin set without removing
 * third-party plugins. Keeping this transition pure lets the UI publish one
 * coherent state instead of flashing through each individual toggle.
 */
export function applyProfileToEnabledPlugins(
  current: ReadonlySet<string>,
  knownPluginIds: ReadonlySet<string>,
  profile: Exclude<InstallerProfile, 'custom'>,
): Set<string> {
  const target = getProfilePluginIds(profile)
  const next = new Set([...current].filter((id) => !knownPluginIds.has(id)))
  for (const id of target) next.add(id)
  return next
}

export function getMatchingInstallerProfile(
  enabled: ReadonlySet<string>,
  knownPluginIds: ReadonlySet<string>,
): InstallerProfile {
  const enabledKnown = [...enabled].filter((id) => knownPluginIds.has(id)).sort()
  for (const [profile, ids] of Object.entries(INSTALLER_PROFILES)) {
    if ([...ids].sort().join('\0') === enabledKnown.join('\0')) return profile as InstallerProfile
  }
  return 'custom'
}

export const DEFAULT_ENABLED_PLUGINS: Set<string> = getProfilePluginIds(DEFAULT_INSTALLER_PROFILE)
