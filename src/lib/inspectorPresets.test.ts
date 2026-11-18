import assert from 'node:assert/strict'
import test from 'node:test'
import { INSPECTOR_PRESETS } from './inspectorPresets.ts'

test('inspector presets select distinct useful information', () => {
  const visibility = INSPECTOR_PRESETS.map(({ id: _id, label: _label, description: _description, ...flags }) => JSON.stringify(flags))
  assert.equal(new Set(visibility).size, INSPECTOR_PRESETS.length, 'each named preset must change the visible inspector information')
})
