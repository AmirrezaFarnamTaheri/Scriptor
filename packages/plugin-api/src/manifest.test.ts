import assert from 'node:assert/strict'
import { test } from 'node:test'
import { validateManifest } from './manifest.ts'

test('validateManifest accepts rustFeatureGate and capabilityId attributes', () => {
  const manifest = validateManifest({
    id: 'scriptor.canvas',
    name: 'Spatial Canvas',
    version: '0.1.0',
    description: 'Edgeless visual canvas',
    author: 'Scriptor Team',
    rustFeatureGate: 'scriptor-canvas-engine',
    capabilityId: 'canvas',
  })
  assert.equal(manifest.rustFeatureGate, 'scriptor-canvas-engine')
  assert.equal(manifest.capabilityId, 'canvas')
})
