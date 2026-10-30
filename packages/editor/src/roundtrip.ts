/** Normalize only transport-level newline spelling for semantic comparisons.
 * Trailing spaces are Markdown hard breaks and may be meaningful in opaque code.
 */
export function normalizeMarkdown(markdown: string): string {
  return markdown.replace(/\r\n/g, '\n')
}

/** A source round trip must preserve exact author-controlled bytes.
 * Do not hide changes to hard breaks, fenced code, CRLF or the final newline.
 */
export function roundTripEqual(before: string, after: string): boolean {
  return before === after
}
