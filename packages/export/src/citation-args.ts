import type { ExportProfile } from '@scriptor/core/contracts/export'

/** Append Pandoc citeproc arguments from an export profile. */
export function appendCitationExportArgs(
  extraPandocArgs: string[],
  profile: Pick<ExportProfile, 'bibliographyPath' | 'cslStylePath'>,
): string[] {
  const args = [...extraPandocArgs]
  if (profile.bibliographyPath) {
    if (!args.includes('--citeproc')) {
      args.push('--citeproc')
    }
    args.push(`--bibliography=${profile.bibliographyPath}`)
  }
  if (profile.cslStylePath) {
    args.push(`--csl=${profile.cslStylePath}`)
  }
  return args
}
