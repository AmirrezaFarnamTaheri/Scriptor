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

const DIAGRAM_FENCE = /```(mermaid|plantuml)\r?\n([\s\S]*?)```/gi

/** Collect mermaid/plantuml fenced blocks from markdown. */
export function findDiagramBlocks(markdown: string): DiagramBlock[] {
  const blocks: DiagramBlock[] = []
  let match: RegExpExecArray | null
  const pattern = new RegExp(DIAGRAM_FENCE.source, DIAGRAM_FENCE.flags)
  while ((match = pattern.exec(markdown)) !== null) {
    const kind = match[1]?.toLowerCase() as DiagramKind
    const source = match[2]?.trim() ?? ''
    if (!source) continue
    blocks.push({
      kind,
      source,
      start: match.index,
      end: match.index + match[0].length,
    })
  }
  return blocks
}

function buildImageMarkdown(ref: DiagramImageRef): string {
  const alt = ref.kind === 'mermaid' ? 'Mermaid diagram' : 'PlantUML diagram'
  return `![${alt}](${ref.imagePath})`
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

    const imagePath = render
      ? await render(block.kind, block.source, index)
      : buildPlaceholderMarkdown(block.kind, index)

    const ref: DiagramImageRef = {
      kind: block.kind,
      source: block.source,
      imagePath,
    }
    diagrams.push(ref)
    next += buildImageMarkdown(ref)
    cursor = block.end
  }

  next += markdown.slice(cursor)
  return { markdown: next, diagrams }
}

/** Synchronous variant for dry-run / planning without rendering PNGs. */
export function replaceDiagramBlocksWithPlaceholders(markdown: string): string {
  return markdown.replace(DIAGRAM_FENCE, (_match, kind: string, source: string) => {
    const trimmed = source.trim()
    if (!trimmed) return _match
    const alt = kind.toLowerCase() === 'mermaid' ? 'Mermaid diagram' : 'PlantUML diagram'
    return `![${alt}](diagram-${kind.toLowerCase()}-pending.png)`
  })
}
