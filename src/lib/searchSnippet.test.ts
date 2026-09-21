import assert from 'node:assert/strict'
import { test } from 'node:test'

import { formatSearchSnippet } from './searchSnippet.ts'

test('search preview removes FTS marker brackets and Markdown wikilink syntax', () => {
  assert.equal(
    formatSearchSnippet('... - [[[[Methodology]]]] and [[Field Notes]]'),
    '... - Methodology and Field Notes',
  )
})

test('search preview uses wikilink aliases and removes structural heading/task syntax', () => {
  assert.equal(
    formatSearchSnippet('## Outline\n- [ ] [[Methodology|Draft methodology]]'),
    'Outline Draft methodology',
  )
})

test('search preview preserves semantic-only descriptions and collapses whitespace', () => {
  assert.equal(
    formatSearchSnippet('  semantic match · score 0.913  '),
    'semantic match · score 0.913',
  )
})
