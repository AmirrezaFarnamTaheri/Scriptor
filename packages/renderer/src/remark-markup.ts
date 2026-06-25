import { visit } from 'unist-util-visit'

/** doocs/md style inline markup: `==highlight==`, `++underline++`. */
export function remarkMarkup() {
  return (tree: Parameters<typeof visit>[0]) => {
    visit(tree, 'text', (node: { value: string }, index, parent: { children: unknown[] } | undefined) => {
      if (!parent || index === undefined) return
      const pattern = /==((?:[^=]|=(?!=))+)==|\+\+((?:[^+]|\+(?!\+))+)\+\+/g
      if (!pattern.test(node.value)) return
      pattern.lastIndex = 0

      const parts: unknown[] = []
      let last = 0
      let match: RegExpExecArray | null
      while ((match = pattern.exec(node.value)) !== null) {
        if (match.index > last) {
          parts.push({ type: 'text', value: node.value.slice(last, match.index) })
        }
        if (match[1] != null) {
          parts.push({
            type: 'html',
            value: `<mark class="markup-highlight">${escapeHtml(match[1])}</mark>`,
          })
        } else if (match[2] != null) {
          parts.push({
            type: 'html',
            value: `<span class="markup-underline">${escapeHtml(match[2])}</span>`,
          })
        }
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
