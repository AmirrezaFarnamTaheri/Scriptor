import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  DEFAULT_ENABLED_PLUGINS,
  INSTALLER_PROFILES,
  getProfilePluginIds,
} from './plugin-defaults.ts'

test('DEFAULT_ENABLED_PLUGINS includes complete decoupled plugins set', () => {
  assert.ok(DEFAULT_ENABLED_PLUGINS.has('scriptor.canvas'))
  assert.ok(DEFAULT_ENABLED_PLUGINS.has('scriptor.citations'))
  assert.ok(DEFAULT_ENABLED_PLUGINS.has('scriptor.export'))
  assert.ok(DEFAULT_ENABLED_PLUGINS.has('scriptor.graph'))
  assert.ok(DEFAULT_ENABLED_PLUGINS.has('scriptor.mcp'))
})

test('installer profiles define correct plugin subsets', () => {
  const focused = getProfilePluginIds('focused')
  assert.equal(focused.size, 0)

  const minimal = getProfilePluginIds('minimal')
  assert.equal(minimal.size, 1)
  assert.ok(minimal.has('scriptor.export'))

  const writer = getProfilePluginIds('writer')
  assert.equal(writer.size, 2)
  assert.ok(writer.has('scriptor.export'))
  assert.ok(writer.has('scriptor.canvas'))

  const scientific = getProfilePluginIds('scientific')
  assert.equal(scientific.size, 3)
  assert.ok(scientific.has('scriptor.export'))
  assert.ok(scientific.has('scriptor.citations'))
  assert.ok(scientific.has('scriptor.graph'))

  const researcher = getProfilePluginIds('researcher')
  assert.equal(researcher.size, 3)
  assert.ok(researcher.has('scriptor.export'))
  assert.ok(researcher.has('scriptor.graph'))
  assert.ok(researcher.has('scriptor.mcp'))

  const developer = getProfilePluginIds('developer')
  assert.equal(developer.size, 4)
  assert.ok(developer.has('scriptor.export'))
  assert.ok(developer.has('scriptor.graph'))
  assert.ok(developer.has('scriptor.canvas'))
  assert.ok(developer.has('scriptor.mcp'))

  const complete = getProfilePluginIds('complete')
  assert.equal(complete.size, 5)
  assert.equal(complete.size, INSTALLER_PROFILES.complete.length)
})
