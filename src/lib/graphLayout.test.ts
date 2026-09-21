import assert from 'node:assert/strict'
import { test } from 'node:test'
import { fitGraphLayoutToViewport, seedGraphLayout } from './graphLayout.ts'

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


test('dense layouts can reserve breathing room instead of expanding to viewport edges', () => {
  const fitted = fitGraphLayoutToViewport([
    { id: 'a', x: -100, y: -50 },
    { id: 'b', x: 100, y: 50 },
  ], 720, 420, 64, 0.8)

  const xs = fitted.map((node) => node.x)
  const ys = fitted.map((node) => node.y)
  assert.ok(Math.min(...xs) > 64)
  assert.ok(Math.max(...xs) < 656)
  assert.ok(Math.min(...ys) > 64)
  assert.ok(Math.max(...ys) < 356)
  assert.ok(Math.max(...xs) - Math.min(...xs) <= 160.001)
  assert.ok(Math.max(...ys) - Math.min(...ys) <= 80.001)
})


test('dense graph seeds fill a disk instead of collapsing onto one ring', () => {
  const nodes = Array.from({ length: 120 }, (_, index) => ({ id: `node-${index}` }))
  const seeded = seedGraphLayout(nodes, 1200, 600)
  const centerX = 600
  const centerY = 300
  const radii = seeded.map((node) => Math.hypot(node.x - centerX, node.y - centerY))

  assert.equal(seeded.length, 120)
  assert.ok(Math.min(...radii) < 40)
  assert.ok(Math.max(...radii) > 180)
  assert.ok(new Set(radii.map((radius) => Math.floor(radius / 40))).size >= 5)

  const xs = seeded.map((node) => node.x)
  const ys = seeded.map((node) => node.y)
  assert.ok(Math.max(...xs) - Math.min(...xs) > 350)
  assert.ok(Math.max(...ys) - Math.min(...ys) > 350)
})

test('dense graph seeds are deterministic for stable visual review evidence', () => {
  const nodes = Array.from({ length: 100 }, (_, index) => ({ id: index }))
  assert.deepEqual(seedGraphLayout(nodes, 900, 600), seedGraphLayout(nodes, 900, 600))
})
