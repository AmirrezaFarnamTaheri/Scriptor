import assert from 'node:assert/strict'
import test from 'node:test'
import { captureMarkdown } from './captureReviewer.ts'
const sourceId = '550e8400-e29b-41d4-a716-446655440000'
const capture = { url: 'https://example.org/article', title: 'Paper', author: 'A', published: '', tags: 'research', markdown: '# Reviewed body' }

test('MAT-011 new reviewed capture persists stable source ID in portable Markdown frontmatter', () => {
  const saved = captureMarkdown({ ...capture, sourceId })
  assert.match(saved, /source_id: "550e8400-e29b-41d4-a716-446655440000"/)
  assert.equal(captureMarkdown({ ...capture, sourceId }), saved)
  assert.match(saved, /source_url: "https:\/\/example.org\/article"/)
})
test('MAT-011 rejects forged or malformed source IDs before a write', () => {
  for (const invalid of ['../outside', 'not-a-uuid', '550e8400-e29b-11d4-a716-446655440000', '550e8400-e29b-41d4-a716-446655440000"\nadmin: true']) {
    assert.throws(() => captureMarkdown({ ...capture, sourceId: invalid }), /source identity/i)
  }
})
