import test from 'node:test'
import assert from 'node:assert/strict'
import { parseDraft, parseNote, parseSearch, parsePdfExport } from './storage.ts'

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
test('PDF save results preserve cancellation and reject malformed native metadata', () => {
  const result = { saved: false, filename: 'paper.pdf', page_count: 1, warnings: [] }
  assert.equal(parsePdfExport(result).saved, false)
  for (const invalid of [{ ...result, saved: 'yes' }, { ...result, page_count: 0 }, { ...result, page_count: 257 }, { ...result, filename: '../secret.pdf' }, { ...result, warnings: [42] }, { ...result, warnings: ['x'.repeat(4097)] }]) assert.throws(() => parsePdfExport(invalid))
})
