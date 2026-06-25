import type { ExportProfile } from '@scriptor/core/contracts/export'

export interface VaultExportConfig {
  bibliography_path: string
  csl_style_path: string
}

/** Apply vault-level bibliography/CSL defaults onto built-in export profiles. */
export function applyVaultExportToProfiles(
  profiles: ExportProfile[],
  config: VaultExportConfig,
): ExportProfile[] {
  const bibliographyPath = config.bibliography_path.trim() || undefined
  const cslStylePath = config.csl_style_path.trim() || undefined

  return profiles.map((profile) => ({
    ...profile,
    bibliographyPath: bibliographyPath ?? profile.bibliographyPath,
    cslStylePath: cslStylePath ?? profile.cslStylePath,
  }))
}
