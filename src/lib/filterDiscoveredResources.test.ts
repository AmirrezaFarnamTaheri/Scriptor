import assert from 'node:assert/strict'
import test from 'node:test'
import { filterDiscoveredResources } from './filterDiscoveredResources.ts'

const targets = [
  { id: 'codex', label: 'Codex CLI' },
  { id: 'cursor', label: 'Cursor' },
]
const resources = [
  { id: 'a', name: 'research-assistant', logicalId: 'skill:research', targetId: 'codex', scope: 'user', path: '/home/me/.codex/skills/research', issues: [] },
  { id: 'b', name: 'readme-helper', logicalId: 'skill:readme', targetId: 'cursor', scope: 'workspace', path: '/work/my-project/.cursor/skills/readme', issues: ['Invalid manifest'] },
]

test('resource lookup matches name, app, path, scope, and problems without case sensitivity', () => {
  assert.deepEqual(filterDiscoveredResources(resources, targets, 'RESEARCH').map(x => x.id), ['a'])
  assert.deepEqual(filterDiscoveredResources(resources, targets, 'CoDeX ClI').map(x => x.id), ['a'])
  assert.deepEqual(filterDiscoveredResources(resources, targets, 'my-project').map(x => x.id), ['b'])
  assert.deepEqual(filterDiscoveredResources(resources, targets, 'WORKSPACE').map(x => x.id), ['b'])
  assert.deepEqual(filterDiscoveredResources(resources, targets, 'INVALID MANIFEST').map(x => x.id), ['b'])
})

test('empty terms preserve all entries in order; unmatched terms give an honest empty state', () => {
  assert.deepEqual(filterDiscoveredResources(resources, targets, '  ').map(x => x.id), ['a', 'b'])
  assert.deepEqual(filterDiscoveredResources(resources, targets, 'never-there'), [])
  assert.deepEqual(resources.map(x => x.id), ['a', 'b'])
})
