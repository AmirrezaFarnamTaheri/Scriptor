import assert from 'node:assert/strict'
import { test } from 'node:test'
import { frameGraph } from './graphViewport.ts'

test('sparse graph is centered and enlarged without hiding notes', () => {
  const nodes = [{ x: 540, y: 190 }, { x: 660, y: 380 }, { x: 620, y: 440 }]
  const { x, y, width, height } = frameGraph(nodes, 1200, 700)
  assert.ok(width < 1200 && height < 700, 'sparse graph should fill more of the stage')
  assert.ok(width >= 1200 / 2.2, 'maximum magnification must remain comfortable')
  assert.ok(height >= 700 / 2.2)
  for (const node of nodes) {
    assert.ok(node.x > x + 50 && node.x < x + width - 50, 'label needs horizontal room')
    assert.ok(node.y > y + 35 && node.y < y + height - 35, 'label needs vertical room')
  }
})

test('large graph never magnifies a dense or sprawling layout', () => {
  const nodes = Array.from({ length: 40 }, (_, i) => ({ x: 60 + (i % 10) * 110, y: 60 + Math.floor(i / 10) * 175 }))
  const result = frameGraph(nodes, 1200, 700)
  assert.equal(result.width, 1200)
  assert.equal(result.height, 700)
  assert.equal(result.x, 0)
  assert.equal(result.y, 0)
})

test('invalid and empty graph dimensions keep a safe original view', () => {
  assert.deepEqual(frameGraph([], 1200, 700), { x: 0, y: 0, width: 1200, height: 700 })
  assert.deepEqual(frameGraph([{ x: NaN, y: 0 }], 1200, 700), { x: 0, y: 0, width: 1200, height: 700 })
  assert.deepEqual(frameGraph([{ x: 50, y: 50 }], 0, -1), { x: 0, y: 0, width: 1, height: 1 })
})
