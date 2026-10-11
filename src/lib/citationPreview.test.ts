import assert from 'node:assert/strict'
import test from 'node:test'
import { formatPreviewCitation } from './citationPreview.ts'

const bibliography = [{ key: 'smith2024', author: 'Smith', year: '2024', title: 'Research', source_path: 'references.bib', entry_type: 'article' }]

test('resolved citations format inline while retaining source keys', () => {
  assert.deepEqual(formatPreviewCitation('[@smith2024]', bibliography), {
    source: '[@smith2024]', text: '(Smith, 2024)', keys: ['smith2024'], resolved: true,
  })
})

test('citation prefixes, locators, groups, braced keys and suppression survive', () => {
  assert.equal(formatPreviewCitation('[see @smith2024, pp. 2–3; -@{smith2024}]', bibliography)?.text, '(see Smith, 2024, pp. 2–3; 2024)')
})

test('missing keys retain the complete source and report an unresolved group', () => {
  const result = formatPreviewCitation('[@smith2024; @missing, p. 7]', bibliography)
  assert.equal(result?.resolved, false)
  assert.equal(result?.text, '[@smith2024; @missing, p. 7]')
})

test('email addresses and ordinary brackets are not citations', () => {
  assert.equal(formatPreviewCitation('[name@example.com]', bibliography), null)
  assert.equal(formatPreviewCitation('[ordinary]', bibliography), null)
})
