import type { ExportProfile } from '@scriptor/core/contracts/export'
import type { ExportProfileContribution } from '@scriptor/core/contracts/plugin'

export function mergePluginExportProfiles(
  base: ExportProfile[],
  contributions: ExportProfileContribution[],
): ExportProfile[] {
  const merged = [...base]
  for (const contribution of contributions) {
    if (merged.some((profile) => profile.id === contribution.id)) {
      continue
    }
    merged.push({
      id: contribution.id,
      label: contribution.label,
      format: contribution.format,
      outputDirectory: `.scriptor/exports/${contribution.format}`,
      extraPandocArgs: [],
    })
  }
  return merged
}
