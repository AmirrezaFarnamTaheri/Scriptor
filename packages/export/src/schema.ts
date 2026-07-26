import type { ExportFormat, ExportProfile } from '@scriptor/core/contracts/export'

const EXPORT_FORMATS: ExportFormat[] = ['pdf', 'html', 'docx', 'latex', 'epub', 'wechat-html']

/** True when the directory is absolute, UNC, drive-lettered, or has a `..` segment. */
function escapesVault(directory: string): boolean {
  const normalized = directory.replace(/\\/g, '/')
  if (normalized.startsWith('/') || /^[a-zA-Z]:/.test(normalized)) return true
  return normalized.split('/').some((segment) => segment === '..')
}

const PANDOC_LONG_FLAG = /^--[a-zA-Z][a-zA-Z0-9-]*(=.*)?$/
const PANDOC_SHORT_FLAG = /^-[a-zA-Z]$/
// Args never pass through a shell, but reject anything that could smuggle
// shell-style substitutions or redirections into downstream tooling.
const UNSAFE_ARG = /[;|&`$<>]|[\u0000-\u001f]/

function validatePandocArg(arg: string): string | null {
  if (UNSAFE_ARG.test(arg)) {
    return `disallowed shell metacharacter in extraPandocArgs: ${arg}`
  }
  const isFlag = PANDOC_LONG_FLAG.test(arg) || PANDOC_SHORT_FLAG.test(arg)
  const isValue = !arg.startsWith('-')
  if (!isFlag && !isValue) {
    return `unrecognized pandoc argument form in extraPandocArgs: ${arg}`
  }
  return null
}

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
  if (escapesVault(profile.outputDirectory)) {
    errors.push('outputDirectory must stay inside the vault')
  }
  for (const arg of profile.extraPandocArgs) {
    const error = validatePandocArg(arg)
    if (error) errors.push(error)
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
