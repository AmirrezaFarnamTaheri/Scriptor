export function diagramZoom(current: number, delta: number): number {
  if (![current, delta].every(Number.isFinite)) throw new Error('Diagram coordinates must be finite')
  return Math.max(0.5, Math.min(3, current + delta))
}

export function diagramPan(start: { left: number; top: number }, delta: { x: number; y: number }, bounds: { width: number; height: number }) {
  if (![start.left, start.top, delta.x, delta.y, bounds.width, bounds.height].every(Number.isFinite)) throw new Error('Diagram coordinates must be finite')
  return {
    left: Math.max(0, Math.min(Math.max(0, bounds.width), start.left - delta.x)),
    top: Math.max(0, Math.min(Math.max(0, bounds.height), start.top - delta.y)),
  }
}
