import assert from 'node:assert/strict'
import test from 'node:test'

import { countWords, countCharacters } from './adapter.ts'

// Reference implementation: the original split-based counter. The streaming
// rewrite must agree with it exactly — it feeds the live per-keystroke draft
// stats.
function referenceCountWords(markdown) {
  const trimmed = markdown.trim()
  return trimmed.length === 0 ? 0 : trimmed.split(/\s+/).length
}

test('countWords matches the split reference across whitespace mixes', () => {
  const samples = [
    '',
    '   ',
    '\t\n\r ',
    'one',
    'one two three',
    '  leading and trailing  ',
    'multiple   internal     spaces',
    'tabs\tand\nnewlines\rmixed',
    'punctuation,tight;clusters:here',
    'unicode\u00a0nbsp\u2003em-space\u3000ideographic\u3000space',
    'zero\uFEFFwidth\uFEFFjoiner',
    'line\u2028separator\u2029and\u2028paragraph',
    '-markdown- -list- items',
    '#heading\n\nparagraph after blank line',
  ]
  for (const sample of samples) {
    assert.equal(
      countWords(sample),
      referenceCountWords(sample),
      `mismatch for ${JSON.stringify(sample)}`,
    )
  }
})

test('countWords agrees with the reference on a large generated document', () => {
  const words = []
  for (let index = 0; index < 50_000; index++) {
    words.push(`word${index}`)
  }
  const document = words.join(' \t\n') + '   '
  assert.equal(countWords(document), referenceCountWords(document))
  assert.equal(countWords(document), 50_000)
})

test('countCharacters counts code units', () => {
  assert.equal(countCharacters(''), 0)
  assert.equal(countCharacters('abc'), 3)
  assert.equal(countCharacters('a\u00e9'), 2)
})
