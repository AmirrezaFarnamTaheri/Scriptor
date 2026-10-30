import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildRestoreOperationReceipt, type RestoreReceiptEvidence } from './operationReceipt.ts'
import { describeRestoreReceipt } from './restoreReceiptPresentation.ts'

function message(outcome: RestoreReceiptEvidence) {
  return describeRestoreReceipt(buildRestoreOperationReceipt({
    vaultId: 'vault-one', backupName: 'vault-backup-123',
    backupPath: '', operationId: 'client-attempt-123', outcome,
  }))
}

test('authorization denial is not described as a completed restore', () => {
  const view = message({ kind: 'not-submitted' })
  assert.equal(view.heading, 'Restore not started')
  assert.match(view.explanation, /before.*sent/i)
  assert.doesNotMatch(view.explanation, /reopen/i)
  assert.equal(view.tone, 'neutral')
})

test('a confirmed native rollback never claims files were restored', () => {
  const view = message({ kind: 'native-result', status: 'rolled-back' })
  assert.equal(view.heading, 'Restore rolled back')
  assert.match(view.explanation, /unchanged/i)
  assert.equal(view.tone, 'warning')
})

test('a durable complete restore reports success without a false restart requirement', () => {
  const view = message({ kind: 'native-result', status: 'committed-ready' })
  assert.equal(view.heading, 'Files restored')
  assert.match(view.explanation, /confirmed/i)
  assert.doesNotMatch(view.explanation, /restart/i)
  assert.equal(view.tone, 'success')
})

test('a confirmed replacement with a stale session requires reopening', () => {
  const view = message({ kind: 'native-result', status: 'committed-needs-reopen' })
  assert.match(view.heading, /reopen required/i)
  assert.match(view.explanation, /Restart Scriptor/i)
  assert.equal(view.tone, 'warning')
})

test('an incomplete recovery never claims a committed transaction', () => {
  const view = message({ kind: 'native-result', status: 'recovery-required' })
  assert.equal(view.heading, 'Restore needs recovery')
  assert.match(view.explanation, /not confirmed complete/i)
  assert.match(view.explanation, /Restart Scriptor/i)
  assert.doesNotMatch(view.explanation, /successfully restored/i)
  assert.equal(view.tone, 'warning')
})

test('a missing native reply never assumes rollback or completion', () => {
  const view = message({ kind: 'reply-missing' })
  assert.equal(view.heading, 'Restore outcome unknown')
  assert.match(view.explanation, /may have changed/i)
  assert.match(view.explanation, /Restart Scriptor/i)
  assert.equal(view.tone, 'warning')
})

test('failed workspace refresh preserves native committed proof but requires reconciliation', () => {
  const view = message({ kind: 'post-commit-refresh-failed', status: 'committed-ready' })
  assert.equal(view.heading, 'Files restored; workspace needs recovery')
  assert.match(view.explanation, /Restart Scriptor/i)
  assert.equal(view.tone, 'warning')
})
