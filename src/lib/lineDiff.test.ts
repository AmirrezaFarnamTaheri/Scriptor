import assert from 'node:assert/strict'
import test from 'node:test'

import { countLineChanges, diffLines } from './lineDiff.ts'

test('identical texts report no change', () => {
  const text = '# Title\n\nBody line\n'
  const result = diffLines(text, text)
  assert.equal(result.added, 0)
  assert.equal(result.removed, 0)
  assert.equal(result.truncated, false)
  assert.ok(result.lines.every((line) => line.kind === 'context'))
})

test('an added line is reported as an addition and kept in place', () => {
  const revision = 'one\ntwo\nthree\n'
  const current = 'one\ntwo\ntwo and a half\nthree\n'
  const result = diffLines(current, revision)

  assert.equal(result.added, 1)
  assert.equal(result.removed, 0)
  const added = result.lines.filter((line) => line.kind === 'add')
  assert.equal(added.length, 1)
  assert.equal(added[0].text, 'two and a half')
  // An addition has a current-side line number and no revision-side number.
  assert.equal(typeof added[0].currentLine, 'number')
  assert.equal(added[0].revisionLine, undefined)
})

test('a removed line is reported as a removal', () => {
  const result = diffLines('one\nthree\n', 'one\ntwo\nthree\n')
  assert.equal(result.added, 0)
  assert.equal(result.removed, 1)
  const removed = result.lines.filter((line) => line.kind === 'remove')
  assert.equal(removed[0].text, 'two')
  assert.equal(removed[0].revisionLine, 2)
  assert.equal(removed[0].currentLine, undefined)
})

test('CRLF and CR line endings do not read as a change on every line', () => {
  const lf = 'alpha\nbeta\ngamma\n'
  const crlf = 'alpha\r\nbeta\r\ngamma\r\n'
  const result = diffLines(crlf, lf)
  assert.equal(result.added, 0)
  assert.equal(result.removed, 0)
  assert.equal(result.lines.length, 3)
})

test('a replaced line becomes one removal and one addition', () => {
  const result = diffLines('alpha\nBETA\ngamma\n', 'alpha\nbeta\ngamma\n')
  assert.equal(result.added, 1)
  assert.equal(result.removed, 1)
})

test('an empty revision counts every current line as added', () => {
  const result = diffLines('a\nb\n', '')
  assert.equal(result.added, 2)
  assert.equal(result.removed, 0)
})

test('an empty current note counts every revision line as removed', () => {
  const result = diffLines('', 'a\nb\n')
  assert.equal(result.added, 0)
  assert.equal(result.removed, 2)
})

test('two empty texts are identical', () => {
  const result = diffLines('', '')
  assert.equal(result.added, 0)
  assert.equal(result.removed, 0)
  assert.equal(result.lines.length, 0)
})

test('the counts and the marked-up view always agree', () => {
  const revision = '# Plan\n\n- [ ] one\n- [ ] two\n'
  const current = '# Plan\n\n- [x] one\n- [ ] two\n- [ ] three\n'
  const result = diffLines(current, revision)

  const fromLines = {
    added: result.lines.filter((l) => l.kind === 'add').length,
    removed: result.lines.filter((l) => l.kind === 'remove').length,
  }
  assert.deepEqual(fromLines, { added: result.added, removed: result.removed })
  assert.deepEqual(countLineChanges(current, revision), { added: result.added, removed: result.removed })
})

test('an oversized pair reports truncation instead of hanging', () => {
  const huge = Array.from({ length: 2500 }, (_, i) => `line ${i}`).join('\n')
  const result = diffLines(huge, `${huge}\nextra`)
  assert.equal(result.truncated, true)
  assert.equal(result.lines.length, 0)
})
