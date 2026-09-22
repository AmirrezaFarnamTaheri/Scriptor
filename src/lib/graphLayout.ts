export interface GraphLayoutPoint {
  x?: number
  y?: number
}

function finite(value: number | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5))

/**
 * Seed graph nodes deterministically before the force simulation starts.
 * Small graphs keep the familiar circular arrangement, while dense graphs use
 * a sunflower disk so the solver does not inherit a crowded single-ring shape.
 */
export function seedGraphLayout<T extends object>(
  nodes: readonly T[],
  width: number,
  height: number,
): Array<T & { x: number; y: number }> {
  if (nodes.length === 0) return []

  const safeWidth = Math.max(width, 1)
  const safeHeight = Math.max(height, 1)
  const centerX = safeWidth / 2
  const centerY = safeHeight / 2
  const dense = nodes.length >= 80

  if (!dense) {
    const radius = Math.min(safeWidth, safeHeight) * 0.28
    return nodes.map((node, index) => {
      const angle = (Math.PI * 2 * index) / Math.max(nodes.length, 1)
      return {
        ...node,
        x: centerX + Math.cos(angle) * radius,
        y: centerY + Math.sin(angle) * radius,
      }
    })
  }

  const radius = Math.min(safeWidth, safeHeight) * 0.34
  return nodes.map((node, index) => {
    const angle = index * GOLDEN_ANGLE
    const distance = radius * Math.sqrt((index + 0.5) / nodes.length)
    return {
      ...node,
      x: centerX + Math.cos(angle) * distance,
      y: centerY + Math.sin(angle) * distance,
    }
  })
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


/**
 * Restore a minimum visual gap after viewport fitting.
 *
 * Force-collision runs before the final fit. When a large simulation is scaled
 * down to fit the viewport, node centers move closer together while the canvas
 * node radius remains measured in screen pixels. This deterministic relaxation
 * runs in fitted coordinates so dense graphs do not re-introduce overlap.
 */
export function separateGraphLayout<T extends GraphLayoutPoint>(
  nodes: readonly T[],
  width: number,
  height: number,
  padding = 44,
  minimumDistance = 32,
  iterations = 12,
): Array<T & { x: number; y: number }> {
  if (nodes.length < 2 || minimumDistance <= 0 || iterations <= 0) {
    return nodes.map((node) => ({
      ...node,
      x: finite(node.x, Math.max(width, 1) / 2),
      y: finite(node.y, Math.max(height, 1) / 2),
    }))
  }

  const safeWidth = Math.max(width, 1)
  const safeHeight = Math.max(height, 1)
  const safePadding = Math.max(0, Math.min(padding, safeWidth / 2, safeHeight / 2))
  const minimum = Math.max(1, minimumDistance)
  const points = nodes.map((node) => ({
    node,
    x: finite(node.x, safeWidth / 2),
    y: finite(node.y, safeHeight / 2),
  }))

  const clampPoint = (point: { x: number; y: number }) => {
    point.x = Math.max(safePadding, Math.min(safeWidth - safePadding, point.x))
    point.y = Math.max(safePadding, Math.min(safeHeight - safePadding, point.y))
  }

  for (let pass = 0; pass < iterations; pass += 1) {
    let moved = false
    for (let left = 0; left < points.length; left += 1) {
      for (let right = left + 1; right < points.length; right += 1) {
        const a = points[left]!
        const b = points[right]!
        let dx = b.x - a.x
        let dy = b.y - a.y
        let distance = Math.hypot(dx, dy)
        if (distance >= minimum) continue

        if (distance < 0.001) {
          // Stable pair-specific direction: no random jitter in screenshots.
          const angle = ((left + 1) * 0.754877666 + (right + 1) * 0.569840296) * Math.PI * 2
          dx = Math.cos(angle)
          dy = Math.sin(angle)
          distance = 1
        }

        const push = (minimum - distance) / 2
        const ux = dx / distance
        const uy = dy / distance
        a.x -= ux * push
        a.y -= uy * push
        b.x += ux * push
        b.y += uy * push
        clampPoint(a)
        clampPoint(b)
        moved = true
      }
    }
    if (!moved) break
  }

  return points.map(({ node, x, y }) => ({ ...node, x, y }))
}
