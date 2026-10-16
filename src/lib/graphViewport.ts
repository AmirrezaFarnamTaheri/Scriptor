/** Keep small graphs legible inside large stages without changing node coordinates. */
export function frameGraph(
  nodes: ReadonlyArray<{ x: number; y: number }>,
  width: number,
  height: number,
): { x: number; y: number; width: number; height: number } {
  const safeWidth = Number.isFinite(width) && width > 0 ? width : 1
  const safeHeight = Number.isFinite(height) && height > 0 ? height : 1
  const original = { x: 0, y: 0, width: safeWidth, height: safeHeight }
  if (nodes.length === 0 || nodes.length >= 25) return original
  if (nodes.some(node => !Number.isFinite(node.x) || !Number.isFinite(node.y))) return original

  const xValues = nodes.map(node => node.x)
  const yValues = nodes.map(node => node.y)
  const left = Math.min(...xValues)
  const right = Math.max(...xValues)
  const top = Math.min(...yValues)
  const bottom = Math.max(...yValues)
  // Reserve room for node labels, focus rings and arrowheads at any magnification.
  const contentWidth = right - left + 2 * 95
  const contentHeight = bottom - top + 2 * 70
  const zoom = Math.min(2.2, safeWidth / contentWidth, safeHeight / contentHeight)
  if (!Number.isFinite(zoom) || zoom <= 1.05) return original
  const frameWidth = safeWidth / zoom
  const frameHeight = safeHeight / zoom
  return {
    x: (left + right - frameWidth) / 2,
    y: (top + bottom - frameHeight) / 2,
    width: frameWidth,
    height: frameHeight,
  }
}
