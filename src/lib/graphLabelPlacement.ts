/** Place focused graph labels without making overlapping opaque plates. */
export interface GraphLabelCandidate {
  id: string
  x: number
  y: number
  width: number
  height: number
  priority: number
}
export interface GraphPlacedLabel extends GraphLabelCandidate {
  left: number
  right: number
  top: number
  bottom: number
}
function intersects(a: GraphPlacedLabel, b: GraphPlacedLabel): boolean {
  return a.left < b.right + 4 && a.right + 4 > b.left && a.top < b.bottom + 4 && a.bottom + 4 > b.top
}
export function placeGraphLabels(candidates: readonly GraphLabelCandidate[], width: number, height: number): GraphPlacedLabel[] {
  const placed: GraphPlacedLabel[] = []
  const safeWidth = Math.max(width, 1)
  const safeHeight = Math.max(height, 1)
  const ordered = candidates.map((candidate, index) => ({ candidate, index }))
    .sort((a, b) => a.candidate.priority - b.candidate.priority || a.index - b.index)
  for (const { candidate } of ordered) {
    if (![candidate.x, candidate.y, candidate.width, candidate.height].every(Number.isFinite)) continue
    const itemWidth = Math.max(candidate.width, 1)
    const itemHeight = Math.max(candidate.height, 1)
    if (itemWidth + 8 > safeWidth || itemHeight + 8 > safeHeight) continue
    let selected: GraphPlacedLabel | null = null
    for (const offset of [24, 40, 60, 84, 108]) {
      const positions = [
        [candidate.x - itemWidth / 2, candidate.y + offset],
        [candidate.x - itemWidth / 2, candidate.y - offset - itemHeight],
        [candidate.x + offset, candidate.y - itemHeight / 2],
        [candidate.x - offset - itemWidth, candidate.y - itemHeight / 2],
        [candidate.x + offset, candidate.y + offset],
        [candidate.x - offset - itemWidth, candidate.y + offset],
        [candidate.x + offset, candidate.y - offset - itemHeight],
        [candidate.x - offset - itemWidth, candidate.y - offset - itemHeight],
      ] as const
      for (const [left, top] of positions) {
        const boundedLeft = Math.max(4, Math.min(safeWidth - itemWidth - 4, left))
        const boundedTop = Math.max(4, Math.min(safeHeight - itemHeight - 4, top))
        const rect = { ...candidate, left: boundedLeft, right: boundedLeft + itemWidth, top: boundedTop, bottom: boundedTop + itemHeight }
        if (!placed.some(existing => intersects(existing, rect))) { selected = rect; break }
      }
      if (selected) break
    }
    if (selected) placed.push(selected)
  }
  return placed
}
