import assert from 'node:assert/strict'
import { test } from 'node:test'
import { fitGraphLayoutToViewport } from './graphLayout.ts'

test('force layouts are fitted without collapsing distinct nodes onto viewport borders', () => {
  const fitted = fitGraphLayoutToViewport([
    { id: 'a', x: -1200, y: -400 },
    { id: 'b', x: -900, y: -250 },
    { id: 'c', x: 1100, y: 500 },
    { id: 'd', x: 1400, y: 650 },
  ], 720, 420, 44)

  for (const node of fitted) {
    assert.ok(node.x >= 44 && node.x <= 676)
    assert.ok(node.y >= 44 && node.y <= 376)
  }
  assert.notEqual(fitted[0]?.x, fitted[1]?.x)
  assert.notEqual(fitted[2]?.x, fitted[3]?.x)
  assert.notEqual(fitted[0]?.y, fitted[1]?.y)
})

test('degenerate and invalid coordinates remain finite and centered', () => {
  const fitted = fitGraphLayoutToViewport([
    { id: 'a', x: Number.NaN, y: Number.POSITIVE_INFINITY },
    { id: 'b', x: 10, y: 10 },
  ], 720, 420)

  assert.equal(fitted.length, 2)
  assert.ok(fitted.every((node) => Number.isFinite(node.x) && Number.isFinite(node.y)))
  assert.ok(fitted.every((node) => node.x >= 44 && node.x <= 676 && node.y >= 44 && node.y <= 376))
})
