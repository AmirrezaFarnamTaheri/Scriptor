import test from 'node:test'
import assert from 'node:assert/strict'
import { parseDraft, parseNote, parseSearch } from './storage.ts'

test('recovery drafts retain their compare-and-swap base and reject corrupt storage', () => {
  assert.deepEqual(parseDraft('{"markdown":"draft","baseHash":"disk"}'), { markdown: 'draft', baseHash: 'disk' })
  for (const input of ['bad', '{}', '{"markdown":42,"baseHash":"disk"}']) assert.equal(parseDraft(input), null)
})
test('native payloads are checked at the mobile boundary', () => {
  const note = { markdown: '# A', metadata: { path: 'a.md', title: 'A', content_hash: 'h' } }
  assert.equal(parseNote(note).metadata.path, 'a.md')
  assert.throws(() => parseNote({ ...note, markdown: 42 }))
  assert.throws(() => parseSearch({ notes: [{}], truncated: false }))
  assert.throws(() => parseSearch({ notes: [], truncated: 'no' }))
})
