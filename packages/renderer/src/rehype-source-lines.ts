import type { Root } from 'hast'
import { visit } from 'unist-util-visit'

/** Annotate rendered elements with `data-source-line` for editor↔preview scroll sync. */
export function rehypeSourceLines() {
  return (tree: Root) => {
    visit(tree, (node) => {
      if (node.type !== 'element') return
      const line = node.position?.start?.line
      if (!line) return
      node.properties = { ...node.properties, dataSourceLine: line }
    })
  }
}
