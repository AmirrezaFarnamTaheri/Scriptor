import assert from 'node:assert/strict'
import { test } from 'node:test'
import { observeBackupDelete, isBackupDeleteHeld, backupDeleteKey } from './backupDeleteOutcome.ts'

const scope = {
  operationId: 'delete-1',
  vaultId: 'vault-a',
  backupPath: '/trusted-backup',
  backupName: 'snapshot-01',
}

test('MAT-002: denied backup deletion has confirmed no effect and never submits native', async () => {
  let submissions = 0
  const result = await observeBackupDelete(scope, async (_markSubmitted) => {
    submissions += 1
    throw new Error('permission denied before native submission')
  })
  assert.equal(submissions, 1, 'the one bridge call includes authorization')
  assert.equal(result.outcome.commit, 'confirmed-none')
  assert.equal(result.outcome.proof, 'before-native-submission')
  assert.equal(result.outcome.retry, 'review-and-reauthorize')
})

test('MAT-002: lost native backup-delete reply cannot assert rollback or retry safety', async () => {
  let attempts = 0
  const result = await observeBackupDelete(scope, async (markSubmitted) => {
    attempts += 1
    markSubmitted()
    throw new Error('transport closed after durable deletion')
  })
  assert.equal(attempts, 1, 'no implicit retry is permitted')
  assert.equal(result.outcome.commit, 'indeterminate')
  assert.equal(result.outcome.proof, 'no-native-result')
  assert.equal(result.outcome.retry, 'blocked-until-reconciliation')
  assert.equal(result.outcome.recovery, 'reopen-vault')
})

test('MAT-002: native acknowledged backup deletion is committed, not replayable', async () => {
  const result = await observeBackupDelete(scope, async markSubmitted => {
    markSubmitted()
  })
  assert.equal(result.outcome.commit, 'confirmed-committed')
  assert.equal(result.outcome.retry, 'do-not-retry')
  assert.equal(result.outcome.affectedPaths, null, 'native has not reported a deleted path inventory')
})

test('MAT-002: async scope changes cannot reattribute deletion to another vault or folder', async () => {
  const mutable = { ...scope }
  let submitted!: () => void
  const waiting = new Promise<void>(resolve => { submitted = resolve })
  const pending = observeBackupDelete(mutable, async markSubmitted => {
    markSubmitted()
    await waiting
    throw new Error('lost reply')
  })
  mutable.vaultId = 'vault-b'
  mutable.backupPath = '/other'
  mutable.backupName = 'different'
  submitted()
  const { outcome } = await pending
  assert.equal(outcome.vaultId, 'vault-a')
  assert.equal(outcome.target, JSON.stringify(['/trusted-backup', 'snapshot-01']))
})

test('MAT-002: unresolved deletion holds only its originating vault, destination and backup', () => {
  const key = backupDeleteKey(scope)
  assert.equal(isBackupDeleteHeld([key], scope), true)
  assert.equal(isBackupDeleteHeld([key], { ...scope, vaultId: 'vault-b' }), false)
  assert.equal(isBackupDeleteHeld([key], { ...scope, backupPath: '/other' }), false)
  assert.equal(isBackupDeleteHeld([key], { ...scope, backupName: 'other' }), false)
  assert.equal(isBackupDeleteHeld([], scope), false)
})
