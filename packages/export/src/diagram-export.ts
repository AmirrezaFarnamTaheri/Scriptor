import remarkParse from 'remark-parse'
import { unified } from 'unified'

export type DiagramKind = 'mermaid' | 'plantuml'

export interface DiagramBlock {
  kind: DiagramKind
  source: string
  start: number
  end: number
}

export interface DiagramImageRef {
  kind: DiagramKind
  source: string
  imagePath: string
}

export type DiagramRenderCallback = (
  kind: DiagramKind,
  source: string,
  index: number,
) => string | Promise<string>

interface MarkdownNode {
  type: string
  lang?: string | null
  value?: string
  position?: { start: { offset?: number }; end: { offset?: number } }
  children?: MarkdownNode[]
}

const markdownParser = unified().use(remarkParse)

/** Collect actual CommonMark diagram fences, preserving authored list/quote prefixes. */
export function findDiagramBlocks(markdown: string): DiagramBlock[] {
  if (!markdown.includes('```') && !markdown.includes('~~~')) return []
  const blocks: DiagramBlock[] = []
  const pending: MarkdownNode[] = [markdownParser.parse(markdown)]
  while (pending.length) {
    const node = pending.pop()!
    if (node.type === 'code') {
      const kind = node.lang?.toLowerCase()
      if (kind !== 'mermaid' && kind !== 'plantuml') continue
      const source = node.value?.trim() ?? ''
      if (!source) continue
      const start = node.position?.start.offset
      const end = node.position?.end.offset
      if (typeof start !== 'number' || typeof end !== 'number' || start < 0 || end > markdown.length || end <= start) {
        throw new Error('The Markdown parser did not provide a valid diagram source range')
      }
      const openingLine = markdown.slice(start, end).split(/\r\n|\r|\n/, 1)[0] ?? ''
      const opening = /`{3,}|~{3,}/.exec(openingLine)
      if (!opening) throw new Error('The Markdown parser did not provide a diagram opening fence')
      // The AST recognizes container-relative indentation. Keep any original
      // list marker, indentation or quote prefix before the opening delimiter
      // outside the replaced range, while node.value supplies de-indented code.
      blocks.push({ kind, source, start: start + opening.index, end })
      continue
    }
    const children = node.children ?? []
    for (let index = children.length - 1; index >= 0; index -= 1) {
      pending.push(children[index]!)
    }
  }
  return blocks
}

function buildImageMarkdown(ref: DiagramImageRef): string {
  const alt = ref.kind === 'mermaid' ? 'Mermaid diagram' : 'PlantUML diagram'
  return `![${alt}](${formatDiagramImageDestination(ref.imagePath)})`
}

/** Represent a raw file path as a Markdown image destination, preserving separators. */
export function formatDiagramImageDestination(imagePath: string): string {
  if (!imagePath || /[\u0000-\u001f\u007f]/.test(imagePath)) {
    throw new Error('A diagram asset path is required and must not contain control characters')
  }
  return imagePath.split('/').map(segment => encodeURIComponent(segment)
    .replace(/[!'()*]/g, character => `%${character.charCodeAt(0).toString(16).toUpperCase()}`)).join('/')
}

function buildPlaceholderMarkdown(kind: DiagramKind, index: number): string {
  return `<!-- scriptor:diagram:${kind}:${index} -->`
}

/**
 * Replace diagram fences with image references using an async render callback.
 * When no callback is supplied, inserts Pandoc-friendly placeholder comments.
 */
export async function replaceDiagramBlocksWithImages(
  markdown: string,
  render?: DiagramRenderCallback,
): Promise<{ markdown: string; diagrams: DiagramImageRef[] }> {
  const blocks = findDiagramBlocks(markdown)
  if (blocks.length === 0) {
    return { markdown, diagrams: [] }
  }

  const diagrams: DiagramImageRef[] = []
  let cursor = 0
  let next = ''

  for (let index = 0; index < blocks.length; index += 1) {
    const block = blocks[index]!
    next += markdown.slice(cursor, block.start)

    if (render) {
      const ref: DiagramImageRef = {
        kind: block.kind,
        source: block.source,
        imagePath: await render(block.kind, block.source, index),
      }
      next += buildImageMarkdown(ref)
      diagrams.push(ref)
    } else {
      next += buildPlaceholderMarkdown(block.kind, index)
    }
    cursor = block.end
  }

  next += markdown.slice(cursor)
  return { markdown: next, diagrams }
}

/** Synchronous variant for dry-run / planning without rendering PNGs. */
export function replaceDiagramBlocksWithPlaceholders(markdown: string): string {
  let output = ''
  let cursor = 0
  for (const block of findDiagramBlocks(markdown)) {
    const alt = block.kind === 'mermaid' ? 'Mermaid diagram' : 'PlantUML diagram'
    output += markdown.slice(cursor, block.start) + `![${alt}](diagram-${block.kind}-pending.png)`
    cursor = block.end
  }
  return output + markdown.slice(cursor)
}
