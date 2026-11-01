import assert from 'node:assert/strict'
import { test } from 'node:test'
import { outcomeFromRestoreReceipt as translate } from './operationOutcomeFromRestore.ts'
import type { OperationReceipt } from './operationReceipt.ts'
const receipt: OperationReceipt = {
  operationId: 'op-1', operationIdOrigin: 'renderer', vaultId: 'v-a',
  operation: 'restore-backup', target: 'backup-1', backupPath: '/backups',
  expectedRevision: null, actualRevision: null, affectedPaths: null,
  nativeStatus: 'rolled-back', proof: 'native-status', effect: 'none',
  retry: 'review-and-reauthorize', recovery: 'none',
}
test('native rolled-back restores are authoritative no-change', () => {
  const result = translate(receipt)
  assert.equal(result.commit, 'confirmed-none')
  assert.equal(result.proof, 'native-result')
})
test('committed-ready native status prevents retry', () => {
  const result = translate({ ...receipt, nativeStatus: 'committed-ready', effect: 'committed', retry: 'do-not-retry' })
  assert.equal(result.commit, 'confirmed-committed')
  assert.equal(result.retry, 'do-not-retry')
})
test('recovery-required remains indeterminate and blocked', () => {
  const result = translate({ ...receipt, nativeStatus: 'recovery-required', effect: 'unreconciled', recovery: 'reopen-vault' })
  assert.equal(result.commit, 'indeterminate')
  assert.equal(result.recovery, 'reopen-vault')
})
test('lost restore reply cannot imply a rollback', () => {
  const result = translate({ ...receipt, proof: 'no-native-result', nativeStatus: null, effect: 'unknown' })
  assert.equal(result.commit, 'indeterminate')
  assert.equal(result.proof, 'no-native-result')
})
test('fabricated pre-submission native status is rejected', () => {
  assert.throws(() => translate({ ...receipt, proof: 'before-native-submission' }), /Pre-submit/)
})
