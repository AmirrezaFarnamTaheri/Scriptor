import type { DiagramKind } from './diagram-export.ts'
import { findDiagramBlocks } from './diagram-export.ts'

export interface DiagramRenderResult {
  relativePath: string
  absoluteHint: string
}

/** Rasterize mermaid blocks to PNG data URLs (browser) for export preprocessing. */
export async function renderMermaidDiagramPng(source: string): Promise<string> {
  const { default: mermaid } = await import('mermaid')
  mermaid.initialize({ startOnLoad: false, theme: 'neutral', securityLevel: 'strict' })
  const id = `scriptor-mermaid-${crypto.randomUUID()}`
  const { svg } = await mermaid.render(id, source)
  const blob = new Blob([svg], { type: 'image/svg+xml' })
  const url = URL.createObjectURL(blob)
  try {
    const image = await loadImage(url)
    const canvas = document.createElement('canvas')
    canvas.width = image.naturalWidth || 800
    canvas.height = image.naturalHeight || 600
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas unavailable')
    ctx.drawImage(image, 0, 0)
    return canvas.toDataURL('image/png')
  } finally {
    URL.revokeObjectURL(url)
  }
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('Failed to load diagram image'))
    image.src = url
  })
}

export async function preprocessMarkdownDiagramsForExport(
  markdown: string,
  writeDiagram: (kind: DiagramKind, index: number, bytes: Uint8Array, extension: string) => Promise<string>,
  renderPlantUml?: (source: string) => Promise<Uint8Array>,
): Promise<string> {
  const blocks = findDiagramBlocks(markdown)
  if (blocks.length === 0) return markdown

  let output = ''
  let cursor = 0
  for (let index = 0; index < blocks.length; index += 1) {
    const block = blocks[index]!
    output += markdown.slice(cursor, block.start)
    try {
      if (block.kind === 'mermaid') {
        const dataUrl = await renderMermaidDiagramPng(block.source)
        const bytes = dataUrlToBytes(dataUrl)
        const relativePath = await writeDiagram('mermaid', index, bytes, 'png')
        output += `![Mermaid diagram](${relativePath})\n`
      } else if (renderPlantUml) {
        const bytes = await renderPlantUml(block.source)
        const relativePath = await writeDiagram('plantuml', index, bytes, 'svg')
        output += `![PlantUML diagram](${relativePath})\n`
      } else {
        output += markdown.slice(block.start, block.end)
      }
    } catch {
      output += markdown.slice(block.start, block.end)
    }
    cursor = block.end
  }
  output += markdown.slice(cursor)
  return output
}

function dataUrlToBytes(dataUrl: string): Uint8Array {
  const comma = dataUrl.indexOf(',')
  const base64 = dataUrl.slice(comma + 1)
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }
  return bytes
}
