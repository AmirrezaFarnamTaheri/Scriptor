import assert from 'node:assert/strict'
import { test } from 'node:test'
import { graphNodeAppearance, graphCanvasDensityMetrics } from './graphNodeAppearance.ts'

const unrelated = {
  focusMode: true,
  isFocus: false,
  isNeighbor: false,
  isHovered: false,
  isKeyboardFocus: false,
}

test('dense focus mode makes unrelated nodes secondary markers rather than full-size discs', () => {
  assert.deepEqual(graphNodeAppearance(unrelated), { radius: 6, alpha: 0.2 })
  assert.deepEqual(graphNodeAppearance({ ...unrelated, isNeighbor: true }), { radius: 14, alpha: 1 })
  assert.deepEqual(graphNodeAppearance({ ...unrelated, isFocus: true }), { radius: 18, alpha: 1 })
})

test('hover and keyboard focus reveal each node without making the entire background dominant', () => {
  assert.deepEqual(graphNodeAppearance({ ...unrelated, isHovered: true }), { radius: 18, alpha: 1 })
  assert.deepEqual(graphNodeAppearance({ ...unrelated, isKeyboardFocus: true }), { radius: 14, alpha: 1 })
  assert.deepEqual(graphNodeAppearance(unrelated), { radius: 6, alpha: 0.2 })
})

test('full-vault view restores equal visibility for unrelated nodes', () => {
  assert.deepEqual(graphNodeAppearance({ ...unrelated, focusMode: false }), { radius: 14, alpha: 1 })
})

test('120-node overview uses smaller distinct discs and reciprocal arrows on phones', () => {
  const compact = graphCanvasDensityMetrics(120, 366, false)
  assert.ok(compact.radiusScale < 0.6)
  assert.ok(compact.hitRadius < 20)
  assert.ok(compact.edgeOffsetScale < 1)
  assert.ok(compact.arrowScale < 1)
  assert.deepEqual(graphCanvasDensityMetrics(120, 366, false), compact, 'stable visual density')

  // Keep normal sized hit targets and legibility in focused, small and desktop
  // graphs: only the deliberate high-density mobile overview gets compact dots.
  const normal = graphCanvasDensityMetrics(120, 1200, false)
  assert.deepEqual(normal, graphCanvasDensityMetrics(20, 366, false))
  assert.deepEqual(normal, graphCanvasDensityMetrics(120, 366, true))
  assert.deepEqual(normal, { radiusScale: 1, hitRadius: 20, edgeOffsetScale: 1, arrowScale: 1 })
})

