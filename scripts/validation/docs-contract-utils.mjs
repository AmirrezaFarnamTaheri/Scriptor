export const SOURCE_IDENTITY_CLAIM = /\bsource(?:-|\s+)identity\b|\bsource-attributable\b/i

export function hasSourceIdentityClaim(source) {
  return SOURCE_IDENTITY_CLAIM.test(source)
}
