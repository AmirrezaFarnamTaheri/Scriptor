import assert from 'node:assert/strict'
import { test } from 'node:test'

import { buildLineDiff, summarizeDiff } from './diff.ts'

test('buildLineDiff identifies line changes and unchanged context', () => {
  const before = '# Heading\nold line\nfooter'
  const after = '# Heading\nnew line\nfooter'
  const diff = buildLineDiff(before, after)

  assert.equal(diff.length, 4)
  assert.deepEqual(diff[0], { kind: 'same', text: '# Heading', oldLine: 1, newLine: 1 })
  assert.deepEqual(diff[1], { kind: 'remove', text: 'old line', oldLine: 2 })
  assert.deepEqual(diff[2], { kind: 'add', text: 'new line', newLine: 2 })
  assert.deepEqual(diff[3], { kind: 'same', text: 'footer', oldLine: 3, newLine: 3 })
})

test('buildLineDiff normalizes CRLF and LF lines cleanly', () => {
  const before = 'line 1\r\nline 2\r\n'
  const after = 'line 1\nline 2\nline 3\n'
  const diff = buildLineDiff(before, after)

  assert.ok(diff.some((line) => line.kind === 'add' && line.text === 'line 3'))
  const summary = summarizeDiff(diff)
  assert.equal(summary.added, 1)
  assert.equal(summary.removed, 0)
})

test('summarizeDiff counts additions and deletions accurately', () => {
  const diff = buildLineDiff('a\nb\nc', 'a\nx\ny\nc')
  const summary = summarizeDiff(diff)
  assert.equal(summary.added, 2)
  assert.equal(summary.removed, 1)
  assert.equal(summary.changed, 1)
})

test('buildLineDiff keeps duplicate-line edits minimal', () => {
  const diff = buildLineDiff('A\nB', 'B\nB\nA\nB')
  assert.deepEqual(diff.filter((line) => line.kind === 'remove'), [])
  assert.equal(diff.filter((line) => line.kind === 'add').length, 2)
})
