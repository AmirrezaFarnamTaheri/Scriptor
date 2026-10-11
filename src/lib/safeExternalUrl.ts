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
const ALLOWED_SCHEMES: readonly string[] = ['https:', 'http:', 'mailto:']

/**
 * Return the URL when it parses and uses an allow-listed scheme, else `null`.
 *
 * Rejects `javascript:`, `data:`, `vbscript:`, `file:`, relative paths, blank
 * strings, and anything non-parsable. Allows `mailto:` for explicit user
 * actions such as support contact links.
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
  return parsed.href
}

/** Return a safe external URL encoded as an unambiguous Markdown destination. */
export function safeExternalMarkdownDestination(value: string | null | undefined): string | null {
  const url = safeExternalUrl(value)
  return url === null ? null : `<${url}>`
}

/** Escape a provider-controlled label without allowing it to create Markdown syntax. */
export function safeExternalMarkdownText(value: string | null | undefined): string {
  if (typeof value !== 'string') return ''
  return value.replace(/[\x00-\x1f\x7f-\x9f]+/g, ' ').replace(/[\\`*_{}\[\]()#+.!|<>~-]/g, '\\$&')
}

/** True when `value` is a URL safe to render as a link or open externally. */
export function isSafeExternalUrl(value: string | null | undefined): boolean {
  return safeExternalUrl(value) !== null
}
