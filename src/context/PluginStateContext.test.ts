import assert from 'node:assert/strict'
import { test } from 'node:test'
import { DEFAULT_ENABLED_PLUGINS } from './plugin-defaults.ts'

test('DEFAULT_ENABLED_PLUGINS includes core decoupled plugins', () => {
  assert.ok(DEFAULT_ENABLED_PLUGINS.has('scriptor.canvas'))
  assert.ok(DEFAULT_ENABLED_PLUGINS.has('scriptor.citations'))
  assert.ok(DEFAULT_ENABLED_PLUGINS.has('scriptor.export'))
  assert.ok(DEFAULT_ENABLED_PLUGINS.has('scriptor.graph'))
  assert.ok(DEFAULT_ENABLED_PLUGINS.has('scriptor.mcp'))
})
