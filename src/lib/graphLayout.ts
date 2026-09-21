export interface GraphLayoutPoint {
  x?: number
  y?: number
}

function finite(value: number | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

/**
 * Fit a completed force layout into the viewport without clamping independent
 * nodes onto the same border coordinates. Relative geometry is preserved.
 */
export function fitGraphLayoutToViewport<T extends GraphLayoutPoint>(
  nodes: readonly T[],
  width: number,
  height: number,
  padding = 44,
  maxScale = 1.25,
): Array<T & { x: number; y: number }> {
  if (nodes.length === 0) return []

  const safeWidth = Math.max(width, 1)
  const safeHeight = Math.max(height, 1)
  const safePadding = Math.max(0, Math.min(padding, safeWidth / 2, safeHeight / 2))
  const points = nodes.map((node) => ({
    node,
    x: finite(node.x, safeWidth / 2),
    y: finite(node.y, safeHeight / 2),
  }))

  const xs = points.map(({ x }) => x)
  const ys = points.map(({ y }) => y)
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)
  const spanX = Math.max(maxX - minX, 1)
  const spanY = Math.max(maxY - minY, 1)
  const availableWidth = Math.max(safeWidth - safePadding * 2, 1)
  const availableHeight = Math.max(safeHeight - safePadding * 2, 1)
  const safeMaxScale = Number.isFinite(maxScale) ? Math.max(0.1, maxScale) : 1.25
  const scale = Math.min(safeMaxScale, availableWidth / spanX, availableHeight / spanY)
  const centerX = (minX + maxX) / 2
  const centerY = (minY + maxY) / 2

  return points.map(({ node, x, y }) => ({
    ...node,
    x: Math.max(safePadding, Math.min(safeWidth - safePadding, safeWidth / 2 + (x - centerX) * scale)),
    y: Math.max(safePadding, Math.min(safeHeight - safePadding, safeHeight / 2 + (y - centerY) * scale)),
  }))
}
