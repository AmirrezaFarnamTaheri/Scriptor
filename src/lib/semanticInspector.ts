import { expectArray, expectBoolean, expectNumber, expectRecord, expectString } from './runtimeSchema.ts'

export interface SemanticPoint { note_path: string; coordinates: [number, number, number]; stale: boolean }
export interface SemanticInspection {
  available: boolean; provider: string; model: string | null; dimension: number
  total_notes: number; indexed: number; current: number; stale: number; missing: number
  orphaned: number; invalid: number; sampled: number; truncated: boolean
  projection: string; explained_variance: [number, number, number]; points: SemanticPoint[]
}

function triple(value: unknown, context: string): [number, number, number] {
  const values = expectArray(value, context)
  if (values.length !== 3 || values.some(x => typeof x !== 'number' || !Number.isFinite(x))) throw new Error(`${context}: invalid coordinates`)
  return values as [number, number, number]
}

export function parseSemanticInspection(value: unknown): SemanticInspection {
  const row = expectRecord(value, 'semantic inspection')
  const count = (key: string) => {
    const n = expectNumber(row, key, 'semantic inspection')
    if (!Number.isSafeInteger(n) || n < 0) throw new Error(`semantic inspection.${key}: invalid count`)
    return n
  }
  const points = expectArray(row.points, 'points').map((value): SemanticPoint => {
    const point = expectRecord(value, 'point')
    return { note_path: expectString(point, 'note_path', 'point'), coordinates: triple(point.coordinates, 'point.coordinates'), stale: expectBoolean(point, 'stale', 'point') }
  })
  if (points.length > 256 || new Set(points.map(p => p.note_path)).size !== points.length) throw new Error('semantic inspection: invalid sample')
  if (row.model !== null && typeof row.model !== 'string') throw new Error('semantic inspection: invalid model')
  const result: SemanticInspection = {
    available: expectBoolean(row, 'available', 'semantic inspection'), provider: expectString(row, 'provider', 'semantic inspection'),
    model: row.model, dimension: count('dimension'), total_notes: count('total_notes'), indexed: count('indexed'), current: count('current'),
    stale: count('stale'), missing: count('missing'), orphaned: count('orphaned'), invalid: count('invalid'), sampled: count('sampled'),
    truncated: expectBoolean(row, 'truncated', 'semantic inspection'), projection: expectString(row, 'projection', 'semantic inspection'),
    explained_variance: triple(row.explained_variance, 'explained_variance'), points,
  }
  if (result.current + result.stale !== result.indexed || result.indexed + result.missing !== result.total_notes || result.sampled !== points.length) throw new Error('semantic inspection: inconsistent counts')
  if (result.explained_variance.some(v => v < 0 || v > 1.000001)) throw new Error('semantic inspection: invalid variance')
  return result
}

/** Orthographic rotation of the measured three PCA coordinates. */
export function projectSemanticPoints(points: SemanticPoint[], mode: '2d' | '3d', yaw: number, pitch: number) {
  const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch)
  const rotated = points.map(point => {
    const [x,y,z] = point.coordinates
    const rx = mode === '3d' ? cy*x + sy*z : x
    const rz = mode === '3d' ? -sy*x + cy*z : z
    return { ...point, x: rx, y: mode === '3d' ? cp*y - sp*rz : y, depth: mode === '3d' ? sp*y + cp*rz : 0 }
  })
  const scale = Math.max(1e-9, ...rotated.flatMap(p => [Math.abs(p.x),Math.abs(p.y)]))
  return rotated.map(point => ({ ...point, x: 300 + point.x/scale*265, y: 180 - point.y/scale*145 })).sort((a,b) => a.depth-b.depth)
}
