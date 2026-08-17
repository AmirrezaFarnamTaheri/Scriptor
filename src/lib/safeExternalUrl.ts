/**
 * safeExternalUrl
 * ---------------
 * Scheme allow-listing for URLs that arrive from external systems (calendar
 * providers, clipped web content, plugin manifests) before they are rendered as
 * links or handed to the OS opener.
 *
 * Allow-list rather than deny-list: an unknown scheme is rejected, so a future
 * exotic scheme cannot slip through by simply not being enumerated.
 */

/** Schemes permitted for links surfaced in notes or opened externally. */
const ALLOWED_SCHEMES: readonly string[] = ['https:', 'http:']

/**
 * Return the URL when it parses and uses an allow-listed scheme, else `null`.
 *
 * Rejects `javascript:`, `data:`, `vbscript:`, `file:`, relative paths, blank
 * strings, and anything non-parsable.
 */
export function safeExternalUrl(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (trimmed.length === 0) return null

  let parsed: URL
  try {
    parsed = new URL(trimmed)
  } catch {
    // Relative or malformed: no scheme to verify, so it cannot be trusted.
    return null
  }

  if (!ALLOWED_SCHEMES.includes(parsed.protocol)) return null
  return trimmed
}

/** True when `value` is a URL safe to render as a link or open externally. */
export function isSafeExternalUrl(value: string | null | undefined): boolean {
  return safeExternalUrl(value) !== null
}
