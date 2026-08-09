import assert from 'node:assert/strict'
import test from 'node:test'
import { PROFILES } from './installer-profiles.mjs'

test('PROFILES contains minimal, scientific, and complete presets', () => {
  assert.ok(PROFILES.minimal)
  assert.ok(PROFILES.scientific)
  assert.ok(PROFILES.complete)

  assert.deepEqual(PROFILES.minimal.plugins, ['scriptor.export'])
  assert.deepEqual(PROFILES.scientific.plugins, ['scriptor.export', 'scriptor.citations', 'scriptor.graph'])
  assert.equal(PROFILES.complete.plugins.length, 5)
})
