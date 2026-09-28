import assert from 'node:assert/strict'
import { test } from 'node:test'

import { TASK_CHECKBOX_CHARS } from '@scriptor/core/task'

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
