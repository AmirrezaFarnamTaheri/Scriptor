import assert from 'node:assert/strict'
import test from 'node:test'
import { alignReviewedSource, sourceLineEndingStyle } from './reviewDiff.ts'

test('inserted lines align without marking subsequent matching lines as changed', () => {
  const result = alignReviewedSource('alpha\nbeta\ngamma', 'alpha\ninserted\nbeta\ngamma')
  assert.deepEqual(result.rows.map(row => row.kind), ['equal', 'added', 'equal', 'equal'])
  assert.deepEqual(result.rows[1], { local: null, remote: 'inserted', kind: 'added' })
  assert.deepEqual(result.summary, { added: 1, removed: 0, changed: 0 })
})
test('deletions align surviving lines', () => {
  const result = alignReviewedSource('first\nremoved\nlast', 'first\nlast')
  assert.deepEqual(result.rows.map(row => row.kind), ['equal', 'removed', 'equal'])
  assert.deepEqual(result.rows[1], { local: 'removed', remote: null, kind: 'removed' })
})
test('replacements retain identical neighboring lines', () => {
  const result = alignReviewedSource('a\nold\nz', 'a\nnew\nz')
  assert.deepEqual(result.rows, [
    { local: 'a', remote: 'a', kind: 'equal' },
    { local: 'old', remote: 'new', kind: 'changed' },
    { local: 'z', remote: 'z', kind: 'equal' },
  ])
})
test('alignment preserves text and unicode', () => {
  const left = '\uFEFF# عنوان\r\n\r\ne\u0301\r\n'
  const right = '\uFEFF# عنوان\r\nجدید\r\n\r\ne\u0301\r\n'
  const result = alignReviewedSource(left, right)
  assert.deepEqual(result.rows.find(row => row.kind === 'added'), { local: null, remote: 'جدید', kind: 'added' })
  assert.equal(result.rows.at(-1)?.kind, 'equal')
})
test('large comparisons are bounded and show every line', () => {
  const left = Array.from({ length: 520 }, (_, i) => `local-${i}`).join('\n')
  const right = Array.from({ length: 520 }, (_, i) => `remote-${i}`).join('\n')
  const result = alignReviewedSource(left, right)
  assert.equal(result.simplified, true)
  assert.equal(result.rows.length, 520)
  assert.equal(result.rows[0].local, 'local-0')
  assert.equal(result.rows.at(-1)?.remote, 'remote-519')
})
test('alignment is lossless for repeated source lines', () => {
  for (const [local, remote] of [
    ['a\nb\na\nc', 'a\na\nc'],
    ['\na\nb', 'x\n\na\nb'],
    ['a\n\nb', 'a\nB\n\nb'],
    ['one\ntwo', 'one\ntwo'],
  ]) {
    const rows = alignReviewedSource(local, remote).rows
    assert.equal(rows.filter(row => row.local !== null).map(row => row.local).join('\n'), local)
    assert.equal(rows.filter(row => row.remote !== null).map(row => row.remote).join('\n'), remote)
  }
})

test('line ending summaries distinguish CRLF, LF, CR and mixed source files', () => {
  assert.equal(sourceLineEndingStyle('a\r\nb\r\n'), 'CRLF')
  assert.equal(sourceLineEndingStyle('a\nb\n'), 'LF')
  assert.equal(sourceLineEndingStyle('a\rb\r'), 'CR')
  assert.equal(sourceLineEndingStyle('a\r\nb\n'), 'mixed')
  assert.equal(sourceLineEndingStyle('single line'), 'none')
})
