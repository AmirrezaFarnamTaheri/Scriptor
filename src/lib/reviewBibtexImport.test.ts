import assert from 'node:assert/strict'
import test from 'node:test'
import { reviewBibtexImport } from './reviewBibtexImport.ts'

test('MAT-013: previews new citation keys and existing source-path collisions without rewriting keys', () => {
  const result = reviewBibtexImport(`
% @article{not-a-key, title={Ignore this comment}}
@string{journal = "A journal"}
@article{new2026, title={The {New} Result}, url={https://example.org/@sample}}
@book(existing:2024, title="A comparison (with details)")
`, [
    { key: 'existing:2024', source_path: 'References/current.bib' },
    { key: 'existing:2024', source_path: 'References/legacy.bib' },
    { key: 'different2023', source_path: 'References/current.bib' },
  ])
  assert.deepEqual(result.keys, ['new2026', 'existing:2024'])
  assert.deepEqual(result.added, ['new2026'])
  assert.deepEqual(result.collisions, [
    { key: 'existing:2024', sourcePaths: ['References/current.bib', 'References/legacy.bib'] },
  ])
})

test('MAT-013: ignores @ in nested fields and supports escaped quotes and BibTeX directive bodies', () => {
  const result = reviewBibtexImport(String.raw`
@preamble{"Some \"label\""}
@comment{Ignore @book{fake, title={Do not import}}}
@misc{real_key, title="A \"quoted\" title", note={Nested {braces} and @references}}
`, [])
  assert.deepEqual(result.keys, ['real_key'])
  assert.deepEqual(result.collisions, [])
})

test('MAT-013: rejects duplicate keys in one import, rather than silently changing them', () => {
  assert.throws(() => reviewBibtexImport('@article{same, title={One}}\n@book{same, title={Two}}', []), /Duplicate citation key.*same/i)
})

test('MAT-013: fails closed on truncated, malformed and empty bibliography previews', () => {
  assert.throws(() => reviewBibtexImport('@article{broken, title={Unclosed}', []), /Unclosed|malformed/i)
  assert.throws(() => reviewBibtexImport('@article{, title={No key}}', []), /citation key/i)
  assert.throws(() => reviewBibtexImport('@article{unsafe key, title={Bad}}', []), /citation key/i)
  assert.throws(() => reviewBibtexImport('not BibTeX', []), /BibTeX/i)
  assert.throws(() => reviewBibtexImport('@comment{No references}', []), /No reference/i)
})

test('MAT-013: rejects malformed UTF-16 input and prevents excessive import previews', () => {
  assert.throws(() => reviewBibtexImport('@article{broken, title={bad \u0000 source}}', []), /invalid|NUL/i)
  assert.throws(() => reviewBibtexImport('@article{bad, title={unpaired \uD800}}', []), /invalid|surrogate/i)
})

test('MAT-013: percent comments inside entries do not terminate a valid entry or hide later keys', () => {
  const content = `@article{first2026,
  title={First result},
  % Comment describing old syntax } and an unmatched " quote
  year={2026}
}
@book{second2026, title={Second result}}`
  assert.deepEqual(reviewBibtexImport(content, []).keys, ['first2026', 'second2026'])
})

test('MAT-013: percent escapes inside braced URLs remain literal bibliography content', () => {
  assert.deepEqual(reviewBibtexImport(
    '@misc{example, url={https://example.test/encoded%20path}, title={Example}}', [],
  ).keys, ['example'])
})
