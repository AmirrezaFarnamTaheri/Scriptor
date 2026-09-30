import assert from 'node:assert/strict'
import test from 'node:test'
import { diagramDocument, annotationDocument, referenceDocument, revisionActivity, assetLink } from './researchStudio.ts'

test('diagram documents bound input and cannot escape their code fence', () => {
  assert.match(diagramDocument('mermaid', 'flowchart LR\n A-->B'), /```mermaid/)
  assert.throws(() => diagramDocument('mermaid', '```\nunsafe'), /fence/)
  assert.throws(() => diagramDocument('mermaid', 'a'.repeat(65_537)), /64 KiB/)
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
