import type { CanvasBlock, CanvasRect, CanvasRelation } from '@scriptor/core/contracts/canvas'

export interface CanvasRelationEdge {
  id: string
  sourceNotePath: string
  targetNotePath: string
  label: string
  x1: number
  y1: number
  x2: number
  y2: number
}

function center(bounds: CanvasRect): { x: number; y: number } {
  return { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 }
}

/** Intersection of the centre ray with the rectangle border. */
function boundaryFactor(bounds: CanvasRect, dx: number, dy: number): number {
  return Math.min(
    dx === 0 ? Infinity : Math.abs(bounds.width / (2 * dx)),
    dy === 0 ? Infinity : Math.abs(bounds.height / (2 * dy)),
  )
}

/**
 * Draw only explicitly authored relations whose notes are actually present
 * on the same board. Do not synthesize links from proximity, matching names,
 * or connector-block geometry.
 *
 * Segment endpoints start beyond the note card boundary; marker arrowheads
 * stay outside of the card while retaining correct source -> target direction.
 */
export function visibleCanvasRelationEdges(
  blocks: readonly CanvasBlock[],
  relations: readonly CanvasRelation[],
): CanvasRelationEdge[] {
  const byPath = new Map<string, CanvasBlock>()
  for (const block of blocks) {
    if (block.sourceNoteId && block.kind !== 'connector' && !byPath.has(block.sourceNoteId)) {
      byPath.set(block.sourceNoteId, block)
    }
  }

  const edges: CanvasRelationEdge[] = []
  for (const relation of relations) {
    const source = byPath.get(relation.sourceNotePath)
    const target = byPath.get(relation.targetNotePath)
    if (!source || !target || source.id === target.id) continue
    if (![source.bounds.width, source.bounds.height, target.bounds.width, target.bounds.height]
      .every(value => Number.isFinite(value) && value > 0)) continue

    const start = center(source.bounds)
    const end = center(target.bounds)
    const dx = end.x - start.x
    const dy = end.y - start.y
    const distance = Math.hypot(dx, dy)
    if (!Number.isFinite(distance) || distance < 1) continue

    const firstBoundary = boundaryFactor(source.bounds, dx, dy)
    const finalBoundary = boundaryFactor(target.bounds, dx, dy)
    if (!Number.isFinite(firstBoundary) || !Number.isFinite(finalBoundary)) continue

    const unitX = dx / distance
    const unitY = dy / distance
    const gap = 4
    const firstDistance = firstBoundary * distance + gap
    const finalDistance = finalBoundary * distance + gap
    if (firstDistance + finalDistance + 12 >= distance) continue

    edges.push({
      id: relation.id,
      sourceNotePath: relation.sourceNotePath,
      targetNotePath: relation.targetNotePath,
      label: relation.label,
      x1: start.x + unitX * firstDistance,
      y1: start.y + unitY * firstDistance,
      x2: end.x - unitX * finalDistance,
      y2: end.y - unitY * finalDistance,
    })
  }
  return edges
}
