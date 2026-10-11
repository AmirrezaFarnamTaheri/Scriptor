import assert from 'node:assert/strict'
import { test } from 'node:test'

import { TASK_CHECKBOX_CHARS } from '@scriptor/core/task'

import { formatSearchSnippet, searchSnippetParts } from './searchSnippet.ts'

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

test('search preview strips every task marker the status registry can produce', () => {
  // The marker characters are interpolated from the registry; a pattern that
  // forgets to close that character class throws at call time, and one that
  // omits a marker leaks `[/]` into the preview.
  for (const char of TASK_CHECKBOX_CHARS) {
    assert.equal(
      formatSearchSnippet(`- [${char}] Draft methodology`),
      'Draft methodology',
      `the [${char}] task marker must be stripped from previews`,
    )
  }
})

test('search preview removes clipped FTS marker fragments at snippet boundaries', () => {
  assert.equal(
    formatSearchSnippet('tes]] - Methodology Outline [[star'),
    'tes - Methodology Outline star',
  )
})

test('search preview preserves semantic-only descriptions and collapses whitespace', () => {
  assert.equal(
    formatSearchSnippet('  semantic match · score 0.913  '),
    'semantic match · score 0.913',
  )
})
test('query matches are visibly separable while cleaned snippets retain context', () => {
  const parts=searchSnippetParts('## [[Research]] findings on [[Methods|methods]] and context.','research methods')
  assert.equal(parts.map(part=>part.text).join(''),'Research findings on methods and context.')
  assert.deepEqual(parts.filter(part=>part.matched).map(part=>part.text),['Research','methods'])
  assert.deepEqual(searchSnippetParts('An ordinary link [[Methodology]]','unrelated').filter(part=>part.matched),[])
})
test('query highlight preserves Unicode text and does not execute HTML or advanced query syntax', () => {
  assert.deepEqual(searchSnippetParts('کتاب و کتابخانه','کتاب').filter(part=>part.matched).map(part=>part.text),['کتاب'])
  const parts=searchSnippetParts('<img onerror=alert(1)> methods','methods OR path:private.md')
  assert.equal(parts.map(part=>part.text).join(''),'<img onerror=alert(1)> methods')
  assert.deepEqual(parts.filter(part=>part.matched).map(part=>part.text),['methods'])
})
