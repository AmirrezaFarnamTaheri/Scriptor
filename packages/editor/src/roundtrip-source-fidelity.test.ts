import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

import { normalizeMarkdown, roundTripEqual } from './roundtrip.ts'

const richFixture = readFileSync(new URL('../../test-fixtures/markdown/roundtrip/semantic-rich.md', import.meta.url), 'utf8')

test('source round trip does not mistake a lost Markdown hard break for preservation', () => {
  assert.equal(roundTripEqual('First line  \nSecond line\n', 'First line\nSecond line\n'), false)
})

test('source round trip detects changed whitespace in opaque fenced code', () => {
  assert.equal(roundTripEqual('```unknown\nvalue  \n```\n', '```unknown\nvalue\n```\n'), false)
})

test('source round trip detects a changed line-ending convention and terminal newline', () => {
  assert.equal(roundTripEqual('# Title\r\n\r\nParagraph\r\n', '# Title\n\nParagraph\n'), false)
  assert.equal(roundTripEqual('# Title\n', '# Title'), false)
})

test('normalizing for semantic comparisons never deletes authored hardbreak spaces', () => {
  assert.equal(normalizeMarkdown('Alpha  \r\nBeta\n'), 'Alpha  \nBeta\n')
})

test('shared semantic Markdown corpus remains byte-for-byte equal when unchanged', () => {
  assert.match(richFixture, /^---\n[\s\S]+?\n---\n/)
  assert.match(richFixture, /\[\[Paper\|Alias\]\]/)
  assert.match(richFixture, /\[@smith2024\]/)
  assert.match(richFixture, /- \[ \] task/)
  assert.match(richFixture, /\$\$E=mc\^2\$\$/)
  assert.match(richFixture, /```mermaid\n/)
  assert.match(richFixture, /<span data-kind="literal">raw HTML<\/span>/)
  assert.equal(roundTripEqual(richFixture, richFixture), true)
  assert.equal(roundTripEqual(richFixture, richFixture.replace('A hard break:  \n', 'A hard break:\n')), false)
  assert.equal(roundTripEqual(richFixture, richFixture.replace('value  \n', 'value\n')), false)
})
