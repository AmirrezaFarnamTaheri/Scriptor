import assert from 'node:assert/strict'
import test from 'node:test'
import { mergeSharedRevision, parseSharedRevision, sharedRevisionBase, parseCollaborationMapping, collaborationMappingKey } from './collaboration.ts'

test('first share preserves incoming content when no common ancestor is known', () => {
  const base = sharedRevisionBase(null, 'notes/a.md')
  assert.equal(base, '')
  assert.deepEqual(mergeSharedRevision(base, '', 'shared content'), { markdown: 'shared content', conflict: false })
  const conflict = mergeSharedRevision(base, 'existing local', 'shared content')
  assert.equal(conflict.conflict, true)
  assert.match(conflict.markdown, /existing local/)
  assert.match(conflict.markdown, /shared content/)
  assert.equal(sharedRevisionBase({ path: 'other.md', markdown: 'wrong ancestor' }, 'notes/a.md'), '')
  assert.equal(sharedRevisionBase({ path: 'notes/a.md', markdown: 'known ancestor' }, 'notes/a.md'), 'known ancestor')
})

test('independent local and remote edits merge without losing either side', () => {
  assert.deepEqual(mergeSharedRevision('one\ntwo\nthree\n', 'ONE\ntwo\nthree\n', 'one\ntwo\nTHREE\n'),
    { markdown: 'ONE\ntwo\nTHREE\n', conflict: false })
})
test('overlapping edits preserve both texts for explicit resolution', () => {
  const result = mergeSharedRevision('base', 'local', 'remote')
  assert.equal(result.conflict, true)
  assert.match(result.markdown, /local/)
  assert.match(result.markdown, /remote/)
  assert.match(result.markdown, /base/)
})
test('identical changes and unmodified local content apply exactly', () => {
  assert.deepEqual(mergeSharedRevision('base', 'same', 'same'), { markdown: 'same', conflict: false })
  assert.deepEqual(mergeSharedRevision('base', 'base', 'remote\r\n'), { markdown: 'remote\r\n', conflict: false })
})
test('remote records reject traversal, extra fields and oversized text', () => {
  const record = { schema: 'scriptor.collaboration.v1', id: 'event-1', document: 'notes/a.md', peer_id: 'peer-1', base_markdown: '', markdown: 'a', created_at: '2026-10-01T00:00:00Z' }
  assert.equal(parseSharedRevision(record).document, 'notes/a.md')
  for (const value of [{ ...record, document: '../a.md' }, { ...record, secret: 'x' }, { ...record, markdown: 'x'.repeat(3 * 1024 * 1024 + 1) }]) {
    assert.throws(() => parseSharedRevision(value))
  }
})

test('durable collaboration mappings validate scope and retain the exact shared ancestor', () => {
  const mapping = { schema: 'scriptor.collaboration.mapping.v1', vaultId: 'vault-a', folderId: 'folder-1', path: 'notes/a.md', peerId: 'peer-1', markdown: 'base\r\n' }
  assert.equal(parseCollaborationMapping(JSON.stringify(mapping), 'vault-a', 'folder-1', 'notes/a.md').markdown, 'base\r\n')
  for (const value of [{ ...mapping, vaultId: 'vault-b' }, { ...mapping, path: '../outside.md' }, { ...mapping, peerId: '<script>' }, { ...mapping, markdown: 'x'.repeat(1_572_865) }]) {
    assert.throws(() => parseCollaborationMapping(JSON.stringify(value), 'vault-a', 'folder-1', 'notes/a.md'))
  }
  assert.notEqual(collaborationMappingKey('vault-a', 'folder-1', 'notes/a.md'), collaborationMappingKey('vault-b', 'folder-1', 'notes/a.md'))
})
