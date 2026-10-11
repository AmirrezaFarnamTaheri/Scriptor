import assert from 'node:assert/strict'
import test from 'node:test'
import { diagramDocument, annotationDocument, referenceDocument, revisionActivity, revisionHeatmap, vocabularyMetrics, assetLink } from './researchStudio.ts'

test('diagram documents bound input and cannot escape their code fence', () => {
  assert.match(diagramDocument('mermaid', 'flowchart LR\n A-->B'), /```mermaid/)
  assert.throws(() => diagramDocument('mermaid', '```\nunsafe'), /fence/)
  assert.throws(() => diagramDocument('mermaid', 'a'.repeat(65_537)), /64 KiB/)
})
test('saved diagrams retain validated note relationships outside the source fence', () => {
  const result = diagramDocument('mermaid', 'flowchart LR\n A-->B', ['research/a.md', 'research/a.md', 'research/b.md'])
  assert.match(result, /```\n\nRelated notes:\n- \[\[research\/a.md\]\]\n- \[\[research\/b.md\]\]/)
  for (const path of ['../private.md', 'a.md]]\n<script>', 'https://example.test/a.md']) assert.throws(() => diagramDocument('mermaid', 'A-->B', [path]), /relative/)
})
test('annotation capture retains source and anchor and quotes every line', () => {
  const result = annotationDocument('papers/a.pdf', { quote: 'first\nsecond', body: 'Comment', anchor: '{"page":2}', id: 'a' })
  assert.match(result, /\[Source\]\(<papers\/a.pdf>\)/)
  assert.match(result, /> first\n> second/)
  assert.match(result, /reader_anchor:/)
  assert.throws(() => assetLink('../outside.pdf'), /relative/)
  assert.throws(() => assetLink('https://remote.test/a'), /relative/)
})
test('reference note retains citation identity and bounded metadata', () => {
  const result = referenceDocument({ key: 'smith2024', title: 'A paper', author: 'Smith', year: '2024', source_path: 'refs.bib' })
  assert.match(result, /\[@smith2024\]/)
  assert.match(result, /citation_key: "smith2024"/)
})
test('activity is measured by UTC date and ignores invalid dates', () => {
  assert.deepEqual(revisionActivity([{ saved_at: '2026-10-01T04:00:00Z' }, { saved_at: '2026-10-01T10:00:00Z' }, { saved_at: 'bad' }]), [{ date: '2026-10-01', count: 2 }])
})

test('revision heatmap retains zero-save days, UTC alignment and bounded coverage', () => {
  const cells = revisionHeatmap([{ saved_at: '2026-09-28T23:00:00Z' }, { saved_at: '2026-09-30T04:00:00Z' }, { saved_at: 'bad' }], 7)
  assert.equal(cells[0].date, '2026-09-28')
  assert.equal(cells[0].count, 1)
  assert.equal(cells[1].count, 0)
  assert.equal(cells[2].count, 1)
  assert.equal(cells.at(-1)?.date, '2026-09-30')
  assert.deepEqual(revisionHeatmap([]), [])
  assert.throws(() => revisionHeatmap([], 10000))
})

test('vocabulary metrics measure authored words without claiming readability or quality', () => {
  assert.deepEqual(vocabularyMetrics('One one TWO'), { words: 3, uniqueWords: 2, diversity: 2 / 3 })
  assert.deepEqual(vocabularyMetrics(''), { words: 0, uniqueWords: 0, diversity: null })
  assert.equal(vocabularyMetrics('می‌روم می‌روم کتاب').words, 3)
})
