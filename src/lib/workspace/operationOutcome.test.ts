import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildOperationOutcome, observeMutation, visibleOperationOutcome } from './operationOutcome.ts'
const scope = { operationId: 'op-1', vaultId: 'vault-a', operation: 'save-note', target: 'draft.md', expectedRevision: 'before' }

test('not submitted is known no-change and may be manually reviewed again', () => {
  const r = buildOperationOutcome(scope, { kind: 'not-submitted' })
  assert.equal(r.commit, 'confirmed-none')
  assert.equal(r.proof, 'before-native-submission')
  assert.deepEqual(r.affectedPaths, [])
  assert.equal(r.retry, 'review-and-reauthorize')
})
test('confirmed native commit does not permit automatic retry', () => {
  const r = buildOperationOutcome(scope, { kind: 'committed', affectedPaths: ['draft.md'], actualRevision: 'after' })
  assert.equal(r.commit, 'confirmed-committed')
  assert.equal(r.retry, 'do-not-retry')
  assert.equal(r.actualRevision, 'after')
  assert.deepEqual(r.affectedPaths, ['draft.md'])
})
test('missing native path inventory remains unknown instead of empty', () => {
  assert.equal(buildOperationOutcome(scope, { kind: 'committed' }).affectedPaths, null)
})
test('unknown native result is never represented as rollback', () => {
  const r = buildOperationOutcome(scope, { kind: 'reply-missing' })
  assert.equal(r.commit, 'indeterminate')
  assert.equal(r.proof, 'no-native-result')
  assert.equal(r.retry, 'blocked-until-reconciliation')
  assert.equal(r.recovery, 'reopen-vault')
})
test('native recovery-required does not claim a completed commit', () => {
  const r = buildOperationOutcome(scope, { kind: 'recovery-required' })
  assert.equal(r.commit, 'indeterminate')
  assert.equal(r.proof, 'native-result')
})
test('receipts only appear in their originating vault and target', () => {
  const r = buildOperationOutcome(scope, { kind: 'reply-missing' })
  assert.equal(visibleOperationOutcome(r, scope), r)
  assert.equal(visibleOperationOutcome(r, { ...scope, vaultId: 'vault-b' }), null)
  assert.equal(visibleOperationOutcome(r, { ...scope, target: 'different.md' }), null)
})
test('approval rejection never calls native and is safe to review again', async () => {
  let calls = 0
  const r = await observeMutation({
    scope, authorize: async () => { throw Error('denied') },
    submit: async () => { calls++; return 'ok' },
    interpret: () => ({ kind: 'committed' }),
  })
  assert.equal(calls, 0)
  assert.equal(r.outcome.commit, 'confirmed-none')
})
test('native rejection after submission has unknown effects and cannot auto-retry', async () => {
  let calls = 0
  const r = await observeMutation({
    scope, authorize: async () => true,
    submit: async () => { calls++; throw Error('lost after commit') },
    interpret: () => ({ kind: 'committed' }),
  })
  assert.equal(calls, 1)
  assert.equal(r.outcome.commit, 'indeterminate')
})
test('invalid native payload cannot be classified as committed', async () => {
  const r = await observeMutation({
    scope, authorize: async () => true,
    submit: async () => ({ changed: 'unverified' }),
    interpret: () => { throw Error('invalid native response') },
  })
  assert.equal(r.outcome.commit, 'indeterminate')
  assert.equal(r.outcome.proof, 'invalid-native-result')
})
test('invalid origin rejected before authorization', async () => {
  let calls = 0
  await assert.rejects(observeMutation({
    scope: { ...scope, vaultId: '' }, authorize: async () => { calls++; return true },
    submit: async () => true, interpret: () => ({ kind: 'committed' }),
  }), /vaultId/)
  assert.equal(calls, 0)
})

test('post-commit refresh failure needs a valid native committed status', () => {
  assert.throws(
    () => buildOperationOutcome(scope, { kind: 'post-commit-refresh-failed', nativeStatus: 'recovery-required' }),
    /confirmed native commit/,
  )
  const committed = buildOperationOutcome(scope, { kind: 'post-commit-refresh-failed', nativeStatus: 'committed-ready' })
  assert.equal(committed.commit, 'confirmed-committed')
  assert.equal(committed.retry, 'blocked-until-reconciliation')
})
