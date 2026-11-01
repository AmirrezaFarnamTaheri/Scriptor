import assert from 'node:assert/strict'
import { test } from 'node:test'
import { assertUnambiguousTaskTitles } from './taskMirrorIdentity.ts'

test('reordered indistinguishable titles in the same note require review', () => {
  const notes = [{ path: 'todo.md', tasks: [{ text: 'Submit report' }, { text: 'Submit report' }] }]
  assert.throws(() => assertUnambiguousTaskTitles(notes), /indistinguishable|duplicate|review/i)
})

test('indexer whitespace-normalized duplicate titles are ambiguous', () => {
  assert.throws(() => assertUnambiguousTaskTitles([
    { path: 'todo.md', tasks: [{ text: ' Submit  report\t' }, { text: 'Submit report' }] },
  ]), /review/i)
})

test('identical titles in separate note paths have distinct source owners', () => {
  assert.doesNotThrow(() => assertUnambiguousTaskTitles([
    { path: 'one.md', tasks: [{ text: 'Submit report' }] },
    { path: 'two.md', tasks: [{ text: 'Submit report' }] },
  ]))
})

test('repeated current-note entries cannot bypass same-note duplicate detection', () => {
  assert.throws(() => assertUnambiguousTaskTitles([
    { path: 'todo.md', tasks: [{ text: '  Item ' }] },
    { path: 'todo.md', tasks: [{ text: 'Item' }] },
  ]), /review/i)
})
