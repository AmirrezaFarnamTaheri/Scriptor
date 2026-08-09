import { describe, expect, it } from 'vitest'
import {
  DEFAULT_ENABLED_PLUGINS,
  INSTALLER_PROFILES,
  getProfilePluginIds,
} from './plugin-defaults'

describe('PluginStateContext', () => {
  it('DEFAULT_ENABLED_PLUGINS includes complete decoupled plugins set', () => {
    expect(DEFAULT_ENABLED_PLUGINS.has('scriptor.canvas')).toBe(true)
    expect(DEFAULT_ENABLED_PLUGINS.has('scriptor.citations')).toBe(true)
    expect(DEFAULT_ENABLED_PLUGINS.has('scriptor.export')).toBe(true)
    expect(DEFAULT_ENABLED_PLUGINS.has('scriptor.graph')).toBe(true)
    expect(DEFAULT_ENABLED_PLUGINS.has('scriptor.mcp')).toBe(true)
  })

  it('installer profiles define correct plugin subsets', () => {
    const focused = getProfilePluginIds('focused')
    expect(focused.size).toBe(0)

    const minimal = getProfilePluginIds('minimal')
    expect(minimal.size).toBe(1)
    expect(minimal.has('scriptor.export')).toBe(true)

    const writer = getProfilePluginIds('writer')
    expect(writer.size).toBe(2)
    expect(writer.has('scriptor.export')).toBe(true)
    expect(writer.has('scriptor.canvas')).toBe(true)

    const scientific = getProfilePluginIds('scientific')
    expect(scientific.size).toBe(3)
    expect(scientific.has('scriptor.export')).toBe(true)
    expect(scientific.has('scriptor.citations')).toBe(true)
    expect(scientific.has('scriptor.graph')).toBe(true)

    const researcher = getProfilePluginIds('researcher')
    expect(researcher.size).toBe(3)
    expect(researcher.has('scriptor.export')).toBe(true)
    expect(researcher.has('scriptor.graph')).toBe(true)
    expect(researcher.has('scriptor.mcp')).toBe(true)

    const developer = getProfilePluginIds('developer')
    expect(developer.size).toBe(4)
    expect(developer.has('scriptor.export')).toBe(true)
    expect(developer.has('scriptor.graph')).toBe(true)
    expect(developer.has('scriptor.canvas')).toBe(true)
    expect(developer.has('scriptor.mcp')).toBe(true)

    const complete = getProfilePluginIds('complete')
    expect(complete.size).toBe(5)
    expect(complete.size).toBe(INSTALLER_PROFILES.complete.length)
  })
})
