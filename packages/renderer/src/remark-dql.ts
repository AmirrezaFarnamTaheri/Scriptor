import { visit } from 'unist-util-visit'

/** Foam-style DQL embed: ` ```dql\npath has #tag\n``` ` */
export function remarkDqlBlocks() {
  return (tree: Parameters<typeof visit>[0]) => {
    visit(tree, 'code', (node: { lang?: string | null; value: string; data?: Record<string, unknown> }) => {
      if (node.lang?.toLowerCase() !== 'dql') return
      const query = node.value.trim()
      node.data = {
        ...(node.data ?? {}),
        hName: 'section',
        hProperties: {
          className: ['dql-block'],
          'data-dql-query': query,
        },
      }
    })
  }
}
