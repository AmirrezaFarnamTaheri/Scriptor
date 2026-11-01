import assert from 'node:assert/strict'
import test from 'node:test'
import { pageResearchViewHits } from './researchPagination.ts'

const rows = [
  { path: 'Research Plan.md', title: 'Research Plan' },
  { path: 'Field Notes.md', title: 'Field Notes' },
  { path: 'Appendix.md', title: 'Appendix' },
]

test('fixture returns indexed candidates in strict UTF-8 BINARY path order', () => {
  assert.deepEqual(pageResearchViewHits(rows, null, 201).map(row => row.path), [
    'Appendix.md', 'Field Notes.md', 'Research Plan.md',
  ])
})

test('fixture keyset pagination is exclusive, bounded and does not mutate source order', () => {
  const first = pageResearchViewHits(rows, null, 2)
  const next = pageResearchViewHits(rows, first[1].path, 2)
  assert.deepEqual(first.map(row => row.path), ['Appendix.md', 'Field Notes.md'])
  assert.deepEqual(next.map(row => row.path), ['Research Plan.md'])
  assert.equal(rows[0].path, 'Research Plan.md')
})

test('fixture compares UTF-8 bytes, not JavaScript UTF-16 order, for non-BMP paths', () => {
  const names = [{ path: '\u{10000}.md' }, { path: '\uE000.md' }]
  assert.deepEqual(pageResearchViewHits(names, null, 201).map(row => row.path), ['\uE000.md', '\u{10000}.md'])
})

test('fixture rejects non-native page sizes and empty cursor', () => {
  assert.throws(() => pageResearchViewHits(rows, null, 202), /page size/i)
  assert.throws(() => pageResearchViewHits(rows, '', 2), /cursor/i)
})
