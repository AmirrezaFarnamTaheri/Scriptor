import { visit } from 'unist-util-visit'

/** Foam-style wikilink embeds: `![[Note]]`, `![[Note#Section]]`. */

const WIKILINK_EMBED_PATTERN =
  /!\[\[([^[\]|#]*)(?:#([^\]|]+))?(?:\|[^\]]+)?\]\]/g

/** Preprocess embed syntax into HTML placeholders hydrated by {@link hydrateWikilinkEmbeds}. */
export function preprocessWikilinkEmbeds(markdown: string): string {
  return markdown.replace(WIKILINK_EMBED_PATTERN, (_match, target?: string, section?: string) => {
    const note = (target ?? '').trim()
    const sect = (section ?? '').trim()
    const sectionAttr = sect.length > 0 ? ` data-wikilink-section="${escapeAttr(sect)}"` : ''
    return `\n<section class="wikilink-embed" data-wikilink-embed="true" data-wikilink-target="${escapeAttr(note)}"${sectionAttr}></section>\n`
  })
}

/** Remark pass: split text nodes that contain embed syntax into html placeholders. */
export function remarkWikilinkEmbed() {
  return (tree: Parameters<typeof visit>[0]) => {
    visit(tree, 'text', (node: { value: string }, index, parent: { children: unknown[] } | undefined) => {
      if (!parent || index === undefined) return
      WIKILINK_EMBED_PATTERN.lastIndex = 0
      if (!WIKILINK_EMBED_PATTERN.test(node.value)) return
      WIKILINK_EMBED_PATTERN.lastIndex = 0

      const parts: unknown[] = []
      let last = 0
      let match: RegExpExecArray | null
      while ((match = WIKILINK_EMBED_PATTERN.exec(node.value)) !== null) {
        if (match.index > last) {
          parts.push({ type: 'text', value: node.value.slice(last, match.index) })
        }
        const note = (match[1] ?? '').trim()
        const sect = (match[2] ?? '').trim()
        const sectionAttr = sect.length > 0 ? ` data-wikilink-section="${escapeAttr(sect)}"` : ''
        parts.push({
          type: 'html',
          value: `<section class="wikilink-embed" data-wikilink-embed="true" data-wikilink-target="${escapeAttr(note)}"${sectionAttr}></section>`,
        })
        last = match.index + match[0].length
      }
      if (last < node.value.length) {
        parts.push({ type: 'text', value: node.value.slice(last) })
      }
      parent.children.splice(index, 1, ...parts)
    })
  }
}

function escapeAttr(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}
