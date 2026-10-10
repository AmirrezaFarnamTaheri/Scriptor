import assert from 'node:assert/strict'
import test from 'node:test'
import { diagramPan, diagramZoom } from './diagramViewport.ts'

test('diagram navigation clamps real scroll bounds and ignores nonfinite coordinates', () => {
  assert.deepEqual(diagramPan({ left: 100, top: 80 }, { x: -250, y: 400 }, { width: 500, height: 220 }), { left: 350, top: 0 })
  assert.deepEqual(diagramPan({ left: 100, top: 80 }, { x: -900, y: -900 }, { width: 500, height: 220 }), { left: 500, top: 220 })
  assert.throws(() => diagramPan({ left: 0, top: 0 }, { x: NaN, y: 0 }, { width: 1, height: 1 }), /finite/)
  assert.equal(diagramZoom(1, -2), 0.5)
  assert.equal(diagramZoom(1, 9), 3)
})
