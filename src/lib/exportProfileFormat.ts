import type { ExportProfile } from '@scriptor/core/contracts/export'

/**
 * The format badge shown beside an export profile's name, or `null` when it
 * would only repeat the name.
 *
 * Most profiles are named after their format, so an unconditional badge rendered
 * `HTML HTML`, `PDF PDF` and `LaTeX LATEX` side by side. It still earns its place
 * when the profile's name says something the format does not — `Reveal.js slides`
 * is an HTML profile, and without the badge the two are indistinguishable.
 */
export function formatBadgeFor(profile: ExportProfile): string | null {
  const format = profile.format.toUpperCase()
  return profile.label.toUpperCase() === format ? null : format
}
