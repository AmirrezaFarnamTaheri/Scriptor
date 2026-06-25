import type { ExportFormat, ExportProfile } from '@scriptor/core/contracts/export'

const EXPORT_FORMATS: ExportFormat[] = ['pdf', 'html', 'docx', 'latex', 'epub', 'wechat-html']

export function validateExportProfile(profile: ExportProfile): string[] {
  const errors: string[] = []
  if (!profile.id.trim()) {
    errors.push('profile id is required')
  }
  if (!profile.label.trim()) {
    errors.push('profile label is required')
  }
  if (!EXPORT_FORMATS.includes(profile.format)) {
    errors.push(`unsupported export format: ${profile.format}`)
  }
  if (!profile.outputDirectory.trim()) {
    errors.push('outputDirectory is required')
  }
  if (profile.outputDirectory.includes('..')) {
    errors.push('outputDirectory must stay inside the vault')
  }
  for (const arg of profile.extraPandocArgs) {
    if (/[;|&`]/.test(arg)) {
      errors.push(`disallowed shell metacharacter in extraPandocArgs: ${arg}`)
    }
  }
  return errors
}

export function validateExportProfiles(profiles: ExportProfile[]): string[] {
  const errors: string[] = []
  const ids = new Set<string>()
  for (const profile of profiles) {
    errors.push(...validateExportProfile(profile))
    if (ids.has(profile.id)) {
      errors.push(`duplicate profile id: ${profile.id}`)
    }
    ids.add(profile.id)
  }
  return errors
}
