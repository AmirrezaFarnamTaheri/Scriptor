import { visit } from 'unist-util-visit'

/** PlantUML fenced blocks rendered as preformatted diagram placeholders. */
export function remarkPlantUml() {
  return (tree: Parameters<typeof visit>[0]) => {
    visit(tree, 'code', (node: { lang?: string | null; value: string; data?: Record<string, unknown> }) => {
      const lang = node.lang?.toLowerCase()
      if (lang !== 'plantuml' && lang !== 'puml') return
      node.data = {
        ...(node.data ?? {}),
        hName: 'pre',
        hProperties: {
          className: ['plantuml-block'],
          dataPlantuml: node.value,
        },
      }
    })
  }
}
