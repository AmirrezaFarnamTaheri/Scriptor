/**
 * Convert indexer/Markdown snippets into compact, human-readable search previews.
 *
 * FTS5 wraps matched terms in [[...]], which collides with Scriptor wikilink
 * syntax. Running the wikilink pass twice collapses both an ordinary wikilink
 * and a highlighted wikilink such as [[[[Methodology]]]] without mutating the
 * indexed source text.
 */
export function formatSearchSnippet(snippet: string): string {
  let value = snippet
  const wikilink = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g

  for (let pass = 0; pass < 2; pass += 1) {
    value = value.replace(wikilink, (_match, target: string, label?: string) => (label ?? target).trim())
  }

  return value
    .replace(/(^|\s)#{1,6}\s+/g, '$1')
    .replace(/(^|\s)[*-]\s+\[[ xX]\]\s+/g, '$1')
    .replace(/\s+/g, ' ')
    .trim()
}
