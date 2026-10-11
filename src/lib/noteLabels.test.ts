import assert from 'node:assert/strict'
import test from 'node:test'
import { buildNoteLabels } from './noteLabels.ts'

test('long shared prefixes retain the part identifying each note', () => {
  const first = 'Generated research note 0001 with an intentionally long filename.md'
  const second = 'Generated research note 0002 with an intentionally long filename.md'
  const labels = buildNoteLabels([first, second])
  assert.match(labels.get(first)!.identity, /1/)
  assert.match(labels.get(second)!.identity, /2/)
  assert.notEqual(labels.get(first)!.identity, labels.get(second)!.identity)
})

test('duplicate basenames expose their distinct folder paths', () => {
  const labels = buildNoteLabels(['archive/Research.md', 'active/Research.md'])
  assert.equal(labels.get('archive/Research.md')!.folder, 'archive')
  assert.equal(labels.get('active/Research.md')!.folder, 'active')
})

test('unique long names keep their suffix and short names remain whole', () => {
  const path = 'A very long research document title covering many subjects final-2026.md'
  const labels = buildNoteLabels([path, 'Notes.md'])
  assert.match(labels.get(path)!.identity, /final-2026.md$/)
  assert.equal(labels.get('Notes.md')!.prefix, 'Notes.md')
  assert.equal(labels.get('Notes.md')!.identity, '')
})
