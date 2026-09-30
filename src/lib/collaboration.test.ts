import assert from 'node:assert/strict'
import test from 'node:test'
import { mergeSharedRevision, parseSharedRevision } from './collaboration.ts'

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
