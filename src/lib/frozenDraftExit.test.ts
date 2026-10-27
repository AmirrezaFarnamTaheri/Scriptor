import assert from 'node:assert/strict'
import { test } from 'node:test'
import { evaluateFrozenDraftExit } from './frozenDraftExit.ts'

const base = { hasUnsavedChanges: true, revisionAtPrompt: 7, currentRevision: () => 7, confirmDiscard: async () => true }
test('a frozen clean draft needs no discard prompt and may leave', async () => {
  let prompts = 0
  const allowed = await evaluateFrozenDraftExit({ ...base, hasUnsavedChanges: false, confirmDiscard: async () => { prompts++; return true } })
  assert.equal(allowed, true)
  assert.equal(prompts, 0)
})
test('refusing to discard a frozen dirty draft keeps the session open', async () => {
  assert.equal(await evaluateFrozenDraftExit({ ...base, confirmDiscard: async () => false }), false)
})
test('explicit approval permits discarding only the unchanged draft revision', async () => {
  assert.equal(await evaluateFrozenDraftExit(base), true)
  let revision = 7
  assert.equal(await evaluateFrozenDraftExit({ ...base, currentRevision: () => revision, confirmDiscard: async () => { revision++; return true } }), false)
})
test('a changed revision fails closed even with no edits at the initial snapshot', async () => {
  assert.equal(await evaluateFrozenDraftExit({ ...base, hasUnsavedChanges: false, currentRevision: () => 8 }), false)
})
test('failed dialogs fail closed without an implicit discard', async () => {
  assert.equal(await evaluateFrozenDraftExit({ ...base, confirmDiscard: async () => { throw new Error('dialog denied') } }), false)
})
