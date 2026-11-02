import assert from 'node:assert/strict'
import { test } from 'node:test'
import { assertUnambiguousTaskTitles, assertNoAmbiguousTaskRebindings } from './taskMirrorIdentity.ts'

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



test('a moved task cannot create a new Google record and complete its old source ID without review', () => {
  assert.throws(() => assertNoAmbiguousTaskRebindings('vault-a', [
    { tasks: [{ id: 'new-task', text: 'Buy milk' }] },
  ], [{ title: 'Buy milk', notes: 'Scriptor source: vault:vault-a:old-task' }]), /review|ambiguous/i)
})

test('a remote current-vault source still matching a local ID is not a moved-task ambiguity', () => {
  assert.doesNotThrow(() => assertNoAmbiguousTaskRebindings('vault-a', [
    { tasks: [{ id: 'same-task', text: 'Buy milk' }] },
  ], [{ title: 'Buy milk', notes: 'Scriptor source: vault:vault-a:same-task' }]))
})

test('foreign-vault ownership is not used to guess moved-task identity', () => {
  assert.doesNotThrow(() => assertNoAmbiguousTaskRebindings('vault-a', [
    { tasks: [{ id: 'new-task', text: 'Buy milk' }] },
  ], [{ title: 'Buy milk', notes: 'Scriptor source: vault:vault-b:old-task' }]))
})

test('an orphan owned remote without a matching local title can be completed as deleted', () => {
  assert.doesNotThrow(() => assertNoAmbiguousTaskRebindings('vault-a', [
    { tasks: [{ id: 'new-task', text: 'Write report' }] },
  ], [{ title: 'Buy milk', notes: 'Scriptor source: vault:vault-a:old-task' }]))
})


test('MAT-016: a case-only task rename after moving notes cannot silently orphan and recreate a provider task', () => {
  assert.throws(() => assertNoAmbiguousTaskRebindings('vault-a', [
    { tasks: [{ id: 'moved-new-id', text: 'BUY MILK' }] },
  ], [{ title: 'Buy milk', notes: 'Scriptor source: vault:vault-a:old-id' }]), /review|ambiguous/i)
})

test('MAT-016: canonically equivalent Unicode task title after a note move requires review', () => {
  assert.throws(() => assertNoAmbiguousTaskRebindings('vault-a', [
    { tasks: [{ id: 'moved-new-id', text: 'Cafe\u0301' }] },
  ], [{ title: 'Caf\u00e9', notes: 'Scriptor source: vault:vault-a:old-id' }]), /review|ambiguous/i)
})
