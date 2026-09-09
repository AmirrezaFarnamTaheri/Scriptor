import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  applyConflictChoices,
  areConflictChoicesComplete,
  parseConflictHunks,
} from './conflictMerge.ts'
import { bibliographyEntriesToCslItems } from './bibliographyToCsl.ts'
import { toPaletteCommands } from './appCommandRegistry.ts'
import type { BibliographyEntry } from '../types/vault.ts'

const CONFLICT = ['<<<<<<< HEAD', 'ours', '=======', 'theirs', '>>>>>>> feature'].join('\n')

test('applyConflictChoices resolves a balanced conflict only after an explicit choice', () => {
  const source = ['intro', CONFLICT, 'outro'].join('\n')
  assert.equal(applyConflictChoices(source, {}), source, 'unresolved hunks must stay unresolved')
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

test('a real conflict inside a Markdown fence is still resolvable', () => {
  const source = [
    '# Git notes',
    '',
    '```',
    '<<<<<<< HEAD',
    'our code sample',
    '=======',
    'their code sample',
    '>>>>>>> branch',
    '```',
    'tail',
  ].join('\n')
  const parsed = parseConflictHunks(source)
  assert.equal(parsed.hunks.length, 1)
  assert.equal(parsed.hunks[0].ours, 'our code sample')
  assert.equal(applyConflictChoices(source, { 0: 'theirs' }), [
    '# Git notes',
    '',
    '```',
    'their code sample',
    '```',
    'tail',
  ].join('\n'))
})

test('marker-looking prose without a complete block is preserved', () => {
  const source = ['<<<<<<< example', 'not a real block', 'ordinary prose'].join('\n')
  assert.deepEqual(parseConflictHunks(source).hunks, [])
  assert.equal(applyConflictChoices(source, {}), source)
})

test('diff3 ancestor content is captured and applied exactly', () => {
  const source = [
    'before',
    '<<<<<<< ours',
    'ours',
    '||||||| ancestor',
    'exact ancestor',
    '=======',
    'theirs',
    '>>>>>>> theirs',
    'after',
  ].join('\n')
  const parsed = parseConflictHunks(source)
  assert.equal(parsed.hunks.length, 1)
  assert.equal(parsed.hunks[0].base, 'exact ancestor')
  assert.equal(applyConflictChoices(source, { 0: 'base' }), ['before', 'exact ancestor', 'after'].join('\n'))
})

test('all conflict hunks must be explicitly resolved', () => {
  const source = [CONFLICT, 'middle', CONFLICT].join('\n')
  const parsed = parseConflictHunks(source)
  assert.equal(parsed.hunks.length, 2)
  assert.equal(areConflictChoicesComplete(parsed, {}), false)
  assert.equal(areConflictChoicesComplete(parsed, { 0: 'ours' }), false)
  assert.equal(areConflictChoicesComplete(parsed, { 0: 'ours', 1: 'theirs' }), true)
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
