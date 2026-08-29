import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  applyProfileToEnabledPlugins,
  DEFAULT_ENABLED_PLUGINS,
  INSTALLER_PROFILES,
  getProfilePluginIds,
  getMatchingInstallerProfile,
} from './plugin-defaults.ts'

describe('PluginStateContext', () => {
  it('DEFAULT_ENABLED_PLUGINS includes complete decoupled plugins set', () => {
    assert.equal(DEFAULT_ENABLED_PLUGINS.has('scriptor.canvas'), true)
    assert.equal(DEFAULT_ENABLED_PLUGINS.has('scriptor.citations'), true)
    assert.equal(DEFAULT_ENABLED_PLUGINS.has('scriptor.export'), true)
    assert.equal(DEFAULT_ENABLED_PLUGINS.has('scriptor.graph'), true)
    assert.equal(DEFAULT_ENABLED_PLUGINS.has('scriptor.mcp'), true)
  })

  it('installer profiles define correct plugin subsets', () => {
    const focused = getProfilePluginIds('focused')
    assert.equal(focused.size, 0)

    const minimal = getProfilePluginIds('minimal')
    assert.equal(minimal.size, 1)
    assert.equal(minimal.has('scriptor.export'), true)

    const writer = getProfilePluginIds('writer')
    assert.equal(writer.size, 2)
    assert.equal(writer.has('scriptor.export'), true)
    assert.equal(writer.has('scriptor.canvas'), true)

    const scientific = getProfilePluginIds('scientific')
    assert.equal(scientific.size, 3)
    assert.equal(scientific.has('scriptor.export'), true)
    assert.equal(scientific.has('scriptor.citations'), true)
    assert.equal(scientific.has('scriptor.graph'), true)

    const researcher = getProfilePluginIds('researcher')
    assert.equal(researcher.size, 3)
    assert.equal(researcher.has('scriptor.export'), true)
    assert.equal(researcher.has('scriptor.graph'), true)
    assert.equal(researcher.has('scriptor.mcp'), true)

    const developer = getProfilePluginIds('developer')
    assert.equal(developer.size, 4)
    assert.equal(developer.has('scriptor.export'), true)
    assert.equal(developer.has('scriptor.graph'), true)
    assert.equal(developer.has('scriptor.canvas'), true)
    assert.equal(developer.has('scriptor.mcp'), true)

    const complete = getProfilePluginIds('complete')
    assert.equal(complete.size, 5)
    assert.equal(complete.size, INSTALLER_PROFILES.complete.length)
  })

  it('applies a profile as one state transition while preserving unknown plugins', () => {
    const current = new Set(['scriptor.canvas', 'third-party.calm-writer'])
    const known = new Set(INSTALLER_PROFILES.complete)

    const next = applyProfileToEnabledPlugins(current, known, 'scientific')

    assert.deepEqual(
      [...next].sort(),
      [
        'scriptor.citations',
        'scriptor.export',
        'scriptor.graph',
        'third-party.calm-writer',
      ],
    )
  })

  it('reports the actual profile and treats mixed built-in states as custom', () => {
    const known = new Set(INSTALLER_PROFILES.complete)
    assert.equal(
      getMatchingInstallerProfile(new Set(['scriptor.export', 'third-party.notes']), known),
      'minimal',
    )
    assert.equal(
      getMatchingInstallerProfile(new Set(['scriptor.export', 'scriptor.citations']), known),
      'custom',
    )
  })
})
