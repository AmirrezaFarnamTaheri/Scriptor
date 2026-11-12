import test from 'node:test'
import assert from 'node:assert/strict'
import { placeGraphLabels } from '../../src/lib/graphLabelPlacement.ts'

const overlap = (a, b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top

test('crowded focused note and neighbors have nonoverlapping readable label plates', () => {
  const candidates = [
    { id: 'focus', x: 140, y: 125, width: 90, height: 18, priority: 0 },
    { id: 'n1', x: 132, y: 140, width: 80, height: 18, priority: 1 },
    { id: 'n2', x: 153, y: 137, width: 84, height: 18, priority: 1 },
    { id: 'n3', x: 160, y: 128, width: 74, height: 18, priority: 1 },
  ]
  const labels = placeGraphLabels(candidates, 320, 260)
  assert.equal(labels.length, 4)
  for (const label of labels) {
    assert.ok(label.left >= 0 && label.right <= 320 && label.top >= 0 && label.bottom <= 260)
    for (const other of labels) if (label.id !== other.id) assert.equal(overlap(label, other), false)
  }
})
test('keyboard-selected note has priority over ambient labels in a constrained canvas', () => {
  const candidates = Array.from({ length: 25 }, (_, index) => ({
    id: String(index), x: 30, y: 30, width: 80, height: 20, priority: index === 24 ? 0 : 2,
  }))
  const placed = placeGraphLabels(candidates, 120, 80)
  assert.ok(placed.some(label => label.id === '24'))
  assert.ok(placed.length < candidates.length)
})
