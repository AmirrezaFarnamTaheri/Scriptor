import { visit } from 'unist-util-visit'

/** GitHub-style ruby annotation: `word{ruby text}` */
export function remarkRuby() {
  return (tree: Parameters<typeof visit>[0]) => {
    visit(tree, 'text', (node: { value: string }, index, parent: { children: unknown[] } | undefined) => {
      if (!parent || index === undefined) return
      const pattern = /([^\s{]+)\{([^}]+)\}/g
      if (!pattern.test(node.value)) return
      pattern.lastIndex = 0
      const parts: unknown[] = []
      let last = 0
      let match: RegExpExecArray | null
      while ((match = pattern.exec(node.value)) !== null) {
        if (match.index > last) {
          parts.push({ type: 'text', value: node.value.slice(last, match.index) })
        }
        const base = match[1] ?? ''
        const ruby = match[2] ?? ''
        parts.push({
          type: 'html',
          value: `<ruby>${escapeHtml(base)}<rt>${escapeHtml(ruby)}</rt></ruby>`,
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

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
}
