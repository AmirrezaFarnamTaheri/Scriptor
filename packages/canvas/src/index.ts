import type {
  CanvasBlock,
  CanvasDocument,
  CanvasPoint,
  CanvasRect,
} from '@scriptor/core/contracts/canvas'

import { blocksForTemplate, type CanvasTemplateId } from './templates.ts'

export const CANVAS_TEMPLATE_IDS = ['research-board', 'weekly-plan'] as const satisfies readonly CanvasTemplateId[]

export const canvasTemplateCatalog: Array<{
  id: CanvasTemplateId
  name: string
  category: string
  description: string
}> = [
  {
    id: 'research-board',
    name: 'Research Board',
    category: 'research',
    description: 'Question, evidence, and synthesis columns.',
  },
  {
    id: 'weekly-plan',
    name: 'Weekly Plan',
    category: 'planning',
    description: 'Five day lanes with a weekly focus block.',
  },
]

export function createEmptyDocument(vaultId: string, title: string): CanvasDocument {
  return {
    id: `canvas-${crypto.randomUUID()}`,
    vaultId,
    title,
    mode: 'edgeless',
    layers: [
      {
        id: 'layer-main',
        name: 'Main',
        visible: true,
        locked: false,
        order: 0,
      },
    ],
    blocks: [],
    updatedAt: new Date().toISOString(),
  }
}

export function hitTest(document: CanvasDocument, point: CanvasPoint): CanvasBlock | null {
  const layerMap = new Map(document.layers.map((layer) => [layer.id, layer]))
  const candidates = document.blocks
    .filter((block) => {
      const layer = layerMap.get(block.layerId)
      if (!layer?.visible || layer.locked || block.locked) return false
      return rectContains(block.bounds, point)
    })
    .sort((left, right) => right.zIndex - left.zIndex)

  return candidates[0] ?? null
}

export function renderSvg(document: CanvasDocument, bounds?: CanvasRect): string {
  const viewport = bounds ?? sceneBounds(document)
  const blocks = [...document.blocks].sort((left, right) => left.zIndex - right.zIndex)
  const elements = blocks
    .map((block) => {
      const fill = block.style?.fill ?? '#ffffff'
      const stroke = block.style?.stroke ?? '#64748b'
      const label = block.contentRef ?? block.id
      const rx = block.kind === 'sticky-note' ? 8 : 2
      return `<g data-block-id="${block.id}"><rect x="${block.bounds.x}" y="${block.bounds.y}" width="${block.bounds.width}" height="${block.bounds.height}" rx="${rx}" fill="${fill}" stroke="${stroke}" /><text x="${block.bounds.x + 12}" y="${block.bounds.y + 24}" font-family="Segoe UI, sans-serif" font-size="14" fill="#0f172a">${escapeXml(label)}</text></g>`
    })
    .join('')

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewport.x} ${viewport.y} ${viewport.width} ${viewport.height}" width="${viewport.width}" height="${viewport.height}"><rect x="${viewport.x}" y="${viewport.y}" width="${viewport.width}" height="${viewport.height}" fill="#f8fafc" />${elements}</svg>`
}

export function sceneBounds(document: CanvasDocument): CanvasRect {
  if (document.blocks.length === 0) {
    return { x: 0, y: 0, width: 640, height: 480 }
  }

  let minX = Number.POSITIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY

  for (const block of document.blocks) {
    minX = Math.min(minX, block.bounds.x)
    minY = Math.min(minY, block.bounds.y)
    maxX = Math.max(maxX, block.bounds.x + block.bounds.width)
    maxY = Math.max(maxY, block.bounds.y + block.bounds.height)
  }

  return {
    x: Math.floor(minX),
    y: Math.floor(minY),
    width: Math.max(320, Math.ceil(maxX - minX)),
    height: Math.max(240, Math.ceil(maxY - minY)),
  }
}

function rectContains(rect: CanvasRect, point: CanvasPoint): boolean {
  return (
    point.x >= rect.x &&
    point.y >= rect.y &&
    point.x <= rect.x + rect.width &&
    point.y <= rect.y + rect.height
  )
}

function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

export function runCanvasValidationTests(documentFromFixture?: (name: string) => CanvasDocument): string[] {
  const failures: string[] = []
  const document = createEmptyDocument('vault', 'Board')
  document.blocks.push({
    id: 'sticky-1',
    kind: 'sticky-note',
    layerId: 'layer-main',
    bounds: { x: 10, y: 10, width: 120, height: 80 },
    zIndex: 2,
    contentRef: 'Idea',
  })
  document.blocks.push({
    id: 'shape-1',
    kind: 'shape',
    layerId: 'layer-main',
    bounds: { x: 0, y: 0, width: 200, height: 200 },
    zIndex: 1,
  })

  const hit = hitTest(document, { x: 50, y: 50 })
  if (hit?.id !== 'sticky-1') {
    failures.push('hitTest should prefer highest z-index block')
  }

  const svg = renderSvg(document)
  if (!svg.includes('Idea')) {
    failures.push('renderSvg should include block labels')
  }

  if (canvasTemplateCatalog.length !== CANVAS_TEMPLATE_IDS.length) {
    failures.push('template catalog length mismatch')
  }

  if (documentFromFixture) {
    const overlap = documentFromFixture('overlap-blocks.json')
    const overlapHit = hitTest(overlap, { x: 100, y: 100 })
    if (overlapHit?.id !== 'block-high') {
      failures.push('overlap fixture should hit block-high at (100,100)')
    }

    const locked = documentFromFixture('locked-layer.json')
    const lockedHit = hitTest(locked, { x: 100, y: 100 })
    if (lockedHit?.id !== 'block-low') {
      failures.push('locked-layer fixture should fall through to block-low')
    }
  }

  const researchBlocks = blocksForTemplate('research-board')
  if (researchBlocks.length !== 4) {
    failures.push('research-board template should add four blocks')
  }

  return failures
}

export { CanvasCrdtSync, type CanvasCrdtSyncState } from './crdt-sync.ts'
export { blocksForTemplate, type CanvasTemplateId } from './templates.ts'
