import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildRestoreOperationReceipt, visibleOperationReceipt } from './operationReceipt.ts'

const input = {
  operationId: 'client-operation-12',
  vaultId: 'vault-a',
  backupName: 'vault-backup-one',
  backupPath: '/backup/root',
} as const

test('native rolled-back outcome proves no replacement and permits reviewed retry', () => {
  const receipt = buildRestoreOperationReceipt({ ...input, outcome: { kind: 'native-result', status: 'rolled-back' } })
  assert.equal(receipt.effect, 'none')
  assert.equal(receipt.proof, 'native-status')
  assert.equal(receipt.retry, 'review-and-reauthorize')
  assert.equal(receipt.recovery, 'none')
  assert.equal(receipt.nativeStatus, 'rolled-back')
})

test('native committed-ready does not permit an automatic second restore', () => {
  const receipt = buildRestoreOperationReceipt({ ...input, outcome: { kind: 'native-result', status: 'committed-ready' } })
  assert.equal(receipt.effect, 'committed')
  assert.equal(receipt.proof, 'native-status')
  assert.equal(receipt.retry, 'do-not-retry')
  assert.equal(receipt.recovery, 'none')
})

test('a durable committed replacement still requires reopen when the session is stale', () => {
  const receipt = buildRestoreOperationReceipt({ ...input, outcome: { kind: 'native-result', status: 'committed-needs-reopen' } })
  assert.equal(receipt.effect, 'committed')
  assert.equal(receipt.retry, 'blocked-until-reopen')
  assert.equal(receipt.recovery, 'reopen-vault')
})

test('recovery-required is unreconciled and never claims a completed commit', () => {
  const receipt = buildRestoreOperationReceipt({ ...input, outcome: { kind: 'native-result', status: 'recovery-required' } })
  assert.equal(receipt.nativeStatus, 'recovery-required')
  assert.equal(receipt.proof, 'native-status')
  assert.equal(receipt.effect, 'unreconciled')
  assert.equal(receipt.retry, 'blocked-until-reopen')
  assert.equal(receipt.recovery, 'reopen-vault')
  assert.equal(receipt.affectedPaths, null)
})

test('post-commit refresh failures cannot manufacture a commit from an incomplete restore', () => {
  assert.throws(() => buildRestoreOperationReceipt({ ...input, outcome: { kind: 'post-commit-refresh-failed', status: 'recovery-required' } }), /committed-ready/)
})

test('a lost native reply has unknown effects, not a fabricated rollback or revision', () => {
  const receipt = buildRestoreOperationReceipt({ ...input, outcome: { kind: 'reply-missing' } })
  assert.equal(receipt.effect, 'unknown')
  assert.equal(receipt.proof, 'no-native-result')
  assert.equal(receipt.nativeStatus, null)
  assert.equal(receipt.retry, 'blocked-until-reopen')
  assert.equal(receipt.recovery, 'reopen-vault')
  assert.equal(receipt.affectedPaths, null)
  assert.equal(receipt.expectedRevision, null)
  assert.equal(receipt.actualRevision, null)
})

test('a pre-submission authorization failure is safe to reattempt with explicit approval', () => {
  const receipt = buildRestoreOperationReceipt({ ...input, outcome: { kind: 'not-submitted' } })
  assert.equal(receipt.effect, 'none')
  assert.equal(receipt.proof, 'before-native-submission')
  assert.equal(receipt.retry, 'review-and-reauthorize')
  assert.equal(receipt.recovery, 'none')
})

test('receipt remains bound to the originating vault and backup location', () => {
  const receipt = buildRestoreOperationReceipt({ ...input, outcome: { kind: 'reply-missing' } })
  assert.equal(receipt.operationId, input.operationId)
  assert.equal(receipt.vaultId, input.vaultId)
  assert.equal(receipt.target, input.backupName)
  assert.equal(visibleOperationReceipt(receipt, 'vault-a', '/backup/root'), receipt)
  assert.equal(visibleOperationReceipt(receipt, 'vault-b', '/backup/root'), null)
  assert.equal(visibleOperationReceipt(receipt, 'vault-a', '/backup/elsewhere'), null)
  assert.equal(visibleOperationReceipt(receipt, null, '/backup/root'), null)
})

test('post-commit workspace refresh failure retains committed proof but demands reconciliation', () => {
  const receipt = buildRestoreOperationReceipt({ ...input, outcome: { kind: 'post-commit-refresh-failed', status: 'committed-ready' } })
  assert.equal(receipt.nativeStatus, 'committed-ready')
  assert.equal(receipt.effect, 'committed')
  assert.equal(receipt.proof, 'native-status')
  assert.equal(receipt.retry, 'blocked-until-reopen')
  assert.equal(receipt.recovery, 'reopen-vault')
  assert.equal(receipt.affectedPaths, null)
})
