import assert from 'node:assert/strict'
import test from 'node:test'
import { PROFILES } from './installer-profiles.mjs'

test('PROFILES contains all 7 preset profiles', () => {
  assert.ok(PROFILES.focused)
  assert.ok(PROFILES.minimal)
  assert.ok(PROFILES.writer)
  assert.ok(PROFILES.scientific)
  assert.ok(PROFILES.researcher)
  assert.ok(PROFILES.developer)
  assert.ok(PROFILES.complete)

  assert.deepEqual(PROFILES.focused.plugins, [])
  assert.deepEqual(PROFILES.minimal.plugins, ['scriptor.export'])
  assert.deepEqual(PROFILES.writer.plugins, ['scriptor.export', 'scriptor.canvas'])
  assert.deepEqual(PROFILES.scientific.plugins, ['scriptor.export', 'scriptor.citations', 'scriptor.graph'])
  assert.deepEqual(PROFILES.researcher.plugins, ['scriptor.export', 'scriptor.graph', 'scriptor.mcp'])
  assert.deepEqual(PROFILES.developer.plugins, ['scriptor.export', 'scriptor.graph', 'scriptor.canvas', 'scriptor.mcp'])
  assert.equal(PROFILES.complete.plugins.length, 5)
})
