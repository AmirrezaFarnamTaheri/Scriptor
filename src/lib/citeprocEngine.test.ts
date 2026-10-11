import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import { formatCslEntries } from './citeprocEngine.ts'

const style = fs.readFileSync(new URL('../assets/citeproc/apa-lite.csl', import.meta.url), 'utf8')
const locale = fs.readFileSync(new URL('../assets/citeproc/locales-en-US.xml', import.meta.url), 'utf8')
const entries = [{ key: 'smith2024', author: 'Smith, Jane', year: '2024', title: 'Research', source_path: 'references.bib', entry_type: 'article' }]

test('bibliography records retain their identity after CSL sorting', () => {
  const result = formatCslEntries(style, locale, [...entries,
    { ...entries[0], key: 'adams2025', author: 'Adams, Alice', title: 'Earlier alphabetically', year: '2025' },
  ])
  assert.match(result.bibliography.smith2024, /Research/)
  assert.match(result.bibliography.adams2025, /Earlier alphabetically/)
  assert.doesNotMatch(result.bibliography.adams2025, /Research/)
})

test('the installed CSL engine returns complete inline text, not a tuple character', () => {
  const result = formatCslEntries(style, locale, entries)
  assert.equal(result.inline.smith2024, '(Smith, 2024)')
  assert.match(result.bibliography.smith2024, /Research/)
})

test('CSL clusters support narrative authors, suppressed authors and grouped items', () => {
  const result = formatCslEntries(style, locale, entries, undefined, [
    { source: '@smith2024', items: [{ id: 'smith2024', 'author-only': true }] },
    { source: '[-@smith2024]', items: [{ id: 'smith2024', 'suppress-author': true }] },
    { source: '[@smith2024, pp. 2–3]', items: [{ id: 'smith2024', label: 'page', locator: '2–3' }] },
    { source: '@smith2024 narrative', narrative: true, items: [{ id: 'smith2024' }] },
  ])
  assert.equal(result.clusters['@smith2024'], 'Smith')
  assert.equal(result.clusters['[-@smith2024]'], '(2024)')
  assert.equal(result.clusters['[@smith2024, pp. 2–3]'], '(Smith, 2024, pp. 2–3)')
  assert.equal(result.clusters['@smith2024 narrative'], 'Smith (2024)')
})
