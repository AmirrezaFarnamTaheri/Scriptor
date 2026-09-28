/**
 * Convert indexer/Markdown snippets into compact, human-readable search previews.
 *
 * FTS5 wraps matched terms in [[...]], which collides with Scriptor wikilink
 * syntax. Running the wikilink pass twice collapses both an ordinary wikilink
 * and a highlighted wikilink such as [[[[Methodology]]]] without mutating the
 * indexed source text.
 */
import { TASK_CHECKBOX_CLASS_SOURCE } from '@scriptor/core/task'

export function formatSearchSnippet(snippet: string): string {
  let value = snippet
  const wikilink = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g

  for (let pass = 0; pass < 2; pass += 1) {
    value = value.replace(wikilink, (_match, target: string, label?: string) => (label ?? target).trim())
  }

  return value
    // FTS snippets may be clipped at either edge, leaving only one half of the
    // [[...]] marker pair. Search previews are plain text, so any residual
    // double brackets are marker debris rather than useful presentation.
    .replace(/\[\[|\]\]/g, '')
    .replace(/(^|\s)#{1,6}\s+/g, '$1')
    // Strip the task marker with the same character set the editor parses, so
    // a snippet of `- [/] Draft methodology` does not show the raw `[/]`.
    .replace(new RegExp(`(^|\\s)[*-]\\s+\\[[${TASK_CHECKBOX_CLASS_SOURCE}]\\]\\s+`, 'g'), '$1')
    .replace(/\s+/g, ' ')
    .trim()
}
