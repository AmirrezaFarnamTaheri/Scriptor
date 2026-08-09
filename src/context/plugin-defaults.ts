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

export const DEFAULT_ENABLED_PLUGINS: Set<string> = getProfilePluginIds(DEFAULT_INSTALLER_PROFILE)
