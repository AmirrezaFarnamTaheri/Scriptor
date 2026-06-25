import { syntaxTree } from '@codemirror/language'
import { EditorState, StateField } from '@codemirror/state'

export interface TocEntry {
  line: number
  pos: number
  text: string
  level: number
  renderedLevel: string
  id: string
}

const HEADING_NODES = new Set([
  'ATXHeading1',
  'ATXHeading2',
  'ATXHeading3',
  'ATXHeading4',
  'ATXHeading5',
  'ATXHeading6',
  'SetextHeading1',
  'SetextHeading2',
])

function headingLevel(nodeName: string): number {
  if (nodeName === 'SetextHeading1') return 1
  if (nodeName === 'SetextHeading2') return 2
  const match = nodeName.match(/ATXHeading(\d)/)
  return match ? Number(match[1]) : 1
}

export function headingToId(heading: string): string {
  const pandoc = heading.match(/\{#([^}]+)\}\s*$/)
  if (pandoc) return pandoc[1]
  const anchor = heading.match(/<a\s+name="([^"]+)"/i)
  if (anchor) return anchor[1]
  const stripped = heading
    .replace(/<[^>]+>/g, '')
    .replace(/\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/[*_`~]/g, '')
    .replace(/\{#([^}]+)\}/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/^-+|-+$/g, '')
  return stripped || 'section'
}

export function generateToc(state: EditorState): TocEntry[] {
  const tree = syntaxTree(state)
  const counters = [0, 0, 0, 0, 0, 0]
  const entries: TocEntry[] = []

  tree.iterate({
    enter(node) {
      if (!HEADING_NODES.has(node.name)) return
      const level = headingLevel(node.name)
      counters[level - 1] += 1
      for (let index = level; index < counters.length; index += 1) {
        counters[index] = 0
      }
      const renderedLevel = counters
        .slice(0, level)
        .filter((value) => value > 0)
        .join('.')
      const text = state.sliceDoc(node.from, node.to).replace(/^#+\s*/, '').trim()
      const line = state.doc.lineAt(node.from).number
      entries.push({
        line,
        pos: node.from,
        text,
        level,
        renderedLevel,
        id: headingToId(text),
      })
    },
  })

  return entries
}

export const tocField = StateField.define<TocEntry[]>({
  create(state) {
    return generateToc(state)
  },
  update(value, transaction) {
    if (!transaction.docChanged) return value
    return generateToc(transaction.state)
  },
})

export function findTocEntryById(entries: TocEntry[], anchor: string): TocEntry | undefined {
  const normalized = anchor.replace(/^#/, '').toLowerCase()
  return entries.find((entry) => entry.id.toLowerCase() === normalized)
}
