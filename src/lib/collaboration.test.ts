import assert from 'node:assert/strict'
import test from 'node:test'
import { mergeSharedRevision, parseSharedRevision, sharedRevisionBase, parseCollaborationMapping, collaborationMappingKey, preparePendingSharedRevision, pendingSharedRevisionKey } from './collaboration.ts'

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

test('first shares treat authored whitespace as content rather than an empty side', () => {
  const whitespace = ' \t\r\n'
  for (const [local, remote] of [[whitespace, 'incoming'], ['existing', whitespace]]) {
    const result = mergeSharedRevision('', local, remote)
    assert.equal(result.conflict, true)
    assert.ok(result.markdown.includes(local))
    assert.ok(result.markdown.includes(remote))
  }
})

test('shared text preserves BOM, line endings, combining characters and media references exactly', () => {
  const original = '\uFEFF# فارسی\r\n\r\ne\u0301 \u{1F331}\r\n\t![image](assets/pixel.png)  \r\n'
  const updated = original + '[audio](assets/session.ogg)\r\n'
  assert.deepEqual(mergeSharedRevision('', original, original), { markdown: original, conflict: false })
  assert.deepEqual(mergeSharedRevision(original, original, updated), { markdown: updated, conflict: false })
  assert.deepEqual(mergeSharedRevision(original, updated, original), { markdown: updated, conflict: false })
})

test('independent insertions retain both additions and the authored line endings', () => {
  assert.deepEqual(mergeSharedRevision('a\r\nb\r\n', 'a\r\nX\r\nb\r\n', 'a\r\nb\r\nY\r\n'),
    { markdown: 'a\r\nX\r\nb\r\nY\r\n', conflict: false })
})

test('concurrent format-only edits remain conflicts rather than silently normalizing either side', () => {
  const base = '\uFEFFa\r\nb\r\n'
  const local = 'a\nb\n'
  const remote = '\uFEFFa\rb\r'
  const result = mergeSharedRevision(base, local, remote)
  assert.equal(result.conflict, true)
  assert.ok(result.markdown.includes(`<<<<<<< Local\n${local}\n`))
  assert.ok(result.markdown.includes(`||||||| Shared base\n${base}\n`))
  assert.ok(result.markdown.includes(`=======\n${remote}\n`))
})

test('ambiguous collaboration retry uses the original remote identity and refuses changed drafts', () => {
  const map = new Map<string, string>()
  const storage = {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => { map.set(key, value) },
  }
  const key = pendingSharedRevisionKey('writer@example.org', 'vault-1', 'folder-1', 'a.md', 'drive_json')
  const candidate = {
    schema: 'scriptor.collaboration.v1' as const,
    id: 'identity-one',
    document: 'a.md',
    peer_id: 'peer-one',
    base_markdown: '',
    markdown: 'first draft',
    created_at: '2026-10-10T00:00:00Z',
  }
  assert.deepEqual(preparePendingSharedRevision(storage, key, candidate), candidate)
  const again = { ...candidate, id: 'identity-two', peer_id: 'new-peer', created_at: '2026-10-10T00:01:00Z' }
  assert.equal(preparePendingSharedRevision(storage, key, again).id, 'identity-one')
  assert.throws(() => preparePendingSharedRevision(storage, key, { ...again, markdown: 'second draft' }), /previous share/i)
  assert.notEqual(key, pendingSharedRevisionKey('other@example.org', 'vault-1', 'folder-1', 'a.md', 'drive_json'))
})
