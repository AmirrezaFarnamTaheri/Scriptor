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
