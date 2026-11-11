import assert from 'node:assert/strict'
import { test } from 'node:test'
import { graphNodeAppearance } from './graphNodeAppearance.ts'

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
