import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  applyConflictChoices,
  estimateBaseHunkStart,
  extractBaseHunk,
  parseConflictHunks,
} from './conflictMerge.ts'
import { bibliographyEntriesToCslItems } from './bibliographyToCsl.ts'
import { toPaletteCommands } from './appCommandRegistry.ts'
import type { BibliographyEntry } from '../types/vault.ts'

const CONFLICT = ['<<<<<<< HEAD', 'ours', '=======', 'theirs', '>>>>>>> feature'].join('\n')

test('applyConflictChoices resolves a balanced conflict', () => {
  const source = ['intro', CONFLICT, 'outro'].join('\n')
  assert.equal(applyConflictChoices(source, { 0: 'ours' }), ['intro', 'ours', 'outro'].join('\n'))
  assert.equal(applyConflictChoices(source, { 0: 'theirs' }), ['intro', 'theirs', 'outro'].join('\n'))
})

test('applyConflictChoices never truncates on an unbalanced start marker', () => {
  const source = ['intro', '<<<<<<< HEAD', 'ours only', 'tail one', 'tail two'].join('\n')
  const result = applyConflictChoices(source, {})
  assert.equal(result, source, 'remaining lines must be preserved verbatim')
  assert.ok(result.includes('tail two'))
})

test('applyConflictChoices never truncates on a missing end marker', () => {
  const source = ['intro', '<<<<<<< HEAD', 'ours', '=======', 'theirs', 'tail'].join('\n')
  const result = applyConflictChoices(source, {})
  assert.equal(result, source)
})

test('conflict markers inside a ``` fence are not treated as markers', () => {
  const source = [
    '# Git notes',
    '',
    '```',
    '<<<<<<< HEAD',
    'documented example',
    '=======',
    'other side',
    '>>>>>>> branch',
    '```',
    '',
    'trailing prose',
  ].join('\n')
  assert.deepEqual(parseConflictHunks(source).hunks, [])
  assert.equal(applyConflictChoices(source, {}), source, 'fenced sample must survive round-trip')
})

test('conflict markers inside a ~~~ fence are not treated as markers', () => {
  const source = ['~~~md', '<<<<<<< HEAD', 'x', '=======', 'y', '>>>>>>> b', '~~~', 'after'].join('\n')
  assert.deepEqual(parseConflictHunks(source).hunks, [])
  assert.equal(applyConflictChoices(source, {}), source)
})

test('a real conflict after a fenced sample still resolves', () => {
  const source = ['```', '<<<<<<< HEAD', '```', 'text', CONFLICT, 'end'].join('\n')
  const parsed = parseConflictHunks(source)
  assert.equal(parsed.hunks.length, 1)
  assert.equal(parsed.hunks[0].ours, 'ours')
  assert.ok(applyConflictChoices(source, { 0: 'theirs' }).includes('theirs'))
})

test('estimateBaseHunkStart corrects the offset for preceding conflicts', () => {
  const source = [CONFLICT, 'middle', CONFLICT].join('\n')
  const parsed = parseConflictHunks(source)
  assert.equal(parsed.hunks.length, 2)
  // First hunk starts at conflicted line 0 and needs no correction.
  assert.equal(estimateBaseHunkStart(parsed.hunks, 0), 0)
  // Second starts at conflicted line 6; the first conflict spent 3 marker lines
  // plus a duplicated side (5 conflicted lines for 1 base line => drift 4).
  assert.equal(parsed.hunks[1].startLine, 6)
  assert.equal(estimateBaseHunkStart(parsed.hunks, 1), 2)
})

test('choosing base on a later hunk reads the right base lines', () => {
  const source = [CONFLICT, 'middle', CONFLICT].join('\n')
  const base = ['ancestor-one', 'middle', 'ancestor-two'].join('\n')
  const merged = applyConflictChoices(source, { 0: 'base', 1: 'base' }, base)
  assert.equal(merged, ['ancestor-one', 'middle', 'ancestor-two'].join('\n'))
})

test('extractBaseHunk clamps out-of-range offsets', () => {
  assert.equal(extractBaseHunk('a\nb', 99, 2), 'b')
  assert.equal(extractBaseHunk('a\nb', -5, 1), 'a')
})

// NOTE: generateTocFromMarkdown is not covered here — it imports the
// `@scriptor/editor` barrel, which `node --experimental-strip-types` cannot
// resolve (extensionless + .tsx re-exports). It is covered by tsc + build.

function bibEntry(key: string): BibliographyEntry {
  return {
    key,
    entry_type: 'article',
    title: key,
    author: null,
    year: '2020',
    source_path: 'refs.bib',
  } as BibliographyEntry
}

test('bibliography keys cannot reach the object prototype', () => {
  const items = bibliographyEntriesToCslItems([bibEntry('__proto__'), bibEntry('ok')])
  assert.equal(Object.getPrototypeOf(items), null)
  assert.equal((items['__proto__'] as { id?: string } | undefined)?.id, '__proto__')
  assert.equal(({} as Record<string, unknown>).id, undefined, 'Object.prototype must be untouched')
  assert.equal((items.ok as { id?: string }).id, 'ok')
})

test('palette command mapper preserves keywords', () => {
  const mapped = toPaletteCommands([
    { id: 'open-support', label: 'Support', keywords: ['donate', 'battery'], run: () => {} },
  ])
  assert.deepEqual(mapped[0].keywords, ['donate', 'battery'])
})
