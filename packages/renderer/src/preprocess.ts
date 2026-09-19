/**
 * Remove a leading Markdown frontmatter block without changing line numbers.
 *
 * Preview/source-sync depends on mdast positions matching the source document,
 * so consumed metadata lines become blank lines rather than being deleted.
 * Unterminated frontmatter is left untouched to avoid hiding malformed notes.
 */
export function stripFrontmatterPreservingLines(markdown: string): string {
  const lines = markdown.split('\n')
  const first = lines[0]?.replace(/^\uFEFF/, '')
  if (first?.trim() !== '---') return markdown

  let closing = -1
  for (let index = 1; index < lines.length; index += 1) {
    if (/^(---|\.\.\.)\s*$/.test(lines[index] ?? '')) {
      closing = index
      break
    }
  }
  if (closing < 0) return markdown

  for (let index = 0; index <= closing; index += 1) lines[index] = ''
  return lines.join('\n')
}

/** Convert Obsidian-style wikilinks to markdown links the remark pipeline can parse. */
export function preprocessWikilinks(markdown: string): string {
  return markdown.replace(
    /\[\[([^\]|#]+)(?:#[^\]|]+)?(?:\|([^\]]+))?\]\]/g,
    (_match, target: string, label?: string) => {
      const display = (label?.trim() || target.trim()).replace(/\\/g, '\\\\').replace(/\[/g, '\\[')
      const encoded = encodeURIComponent(target.trim())
      return `[${display}](#wikilink:${encoded})`
    },
  )
}
