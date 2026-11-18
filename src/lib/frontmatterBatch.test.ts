import assert from 'node:assert/strict'
import test from 'node:test'
import { applyFrontmatterChanges } from './frontmatterBatch.ts'

test('updates two simple metadata cells in one Markdown document and keeps its body', () => {
  const body = '---\ntitle: Draft\nstatus: todo\n---\n# Body\nhello\n'
  assert.equal(applyFrontmatterChanges(body, { title: 'Ready to publish', status: 'done' }), '---\ntitle: "Ready to publish"\nstatus: done\n---\n# Body\nhello\n')
})
test('keeps Windows line endings and keeps unchanged YAML lines', () => {
  const old = '---\r\ntitle: Hello\r\nstatus: draft\r\n---\r\nBody\r\n'
  assert.equal(applyFrontmatterChanges(old, { status: 'reviewed' }), '---\r\ntitle: Hello\r\nstatus: reviewed\r\n---\r\nBody\r\n')
})
test('fails closed on absent, complex, duplicate or oddly spaced metadata keys', () => {
  for (const markdown of ['# Body', '---\nstatus: draft\nBody', '---\nstatus: one\nstatus: two\n---\n', '---\nstatus: |\n  draft\n---\n', '---\nstatus : draft\n---\n', '---\nstatus:\n  draft\n---\n']) {
    assert.throws(() => applyFrontmatterChanges(markdown, { status: 'new' }))
  }
})
test('rejects control characters and dangerous newlines in metadata values', () => {
  const md = '---\nstatus: old\n---\n'
  assert.throws(() => applyFrontmatterChanges(md, { status: 'broken\nmalicious: yes' }))
  assert.throws(() => applyFrontmatterChanges(md, { 'unsafe:key': 'a' }))
})
test('does not modify source if no changes', () => {
  const md = '# no metadata needed\n'
  assert.equal(applyFrontmatterChanges(md, {}), md)
})
