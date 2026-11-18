/**
 * Readable, deterministic neighborhood projection for a dense knowledge graph.
 * The complete graph remains available through Show all links; this projection
 * renders only the focused note and its directly connected notes.
 */
export function projectFocusedGraph<T extends { id: string; x: number; y: number }>(
  nodes: readonly T[],
  edges: readonly { source: string; target: string }[],
  focusId: string | null,
  width: number,
  height: number,
): T[] {
  const focus = nodes.find((node) => node.id === focusId)
  if (!focus) return [...nodes]

  const connected = new Set<string>()
  for (const edge of edges) {
    if (edge.source === focus.id) connected.add(edge.target)
    if (edge.target === focus.id) connected.add(edge.source)
  }
  connected.delete(focus.id)
  const neighbors = nodes.filter((node) => connected.has(node.id))
    .sort((a, b) => a.id.localeCompare(b.id))
  const safeWidth = Math.max(width, 1)
  const safeHeight = Math.max(height, 1)
  const cx = safeWidth / 2
  const cy = safeHeight / 2
  const horizontalRadius = Math.max(0, Math.min(safeWidth * 0.35, safeWidth / 2 - 60, 360))
  const verticalRadius = Math.max(0, Math.min(safeHeight * 0.31, safeHeight / 2 - 60, 190))
  const ringSize = 14
  const rings = Math.ceil(neighbors.length / ringSize)

  return [
    { ...focus, x: cx, y: cy },
    ...neighbors.map((node, index) => {
      const ring = Math.floor(index / ringSize)
      const first = ring * ringSize
      const ringCount = Math.min(ringSize, neighbors.length - first)
      // Several concentric ellipses keep heavily connected hubs in bounds.
      const radiusFraction = rings <= 1 ? 1 : 0.55 + 0.45 * (ring + 1) / rings
      const angle = -Math.PI / 2 + (2 * Math.PI * (index - first)) / ringCount
      return {
        ...node,
        x: cx + Math.cos(angle) * horizontalRadius * radiusFraction,
        y: cy + Math.sin(angle) * verticalRadius * radiusFraction,
      }
    }),
  ]
}
