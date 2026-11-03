import assert from 'node:assert/strict'
import { test } from 'node:test'
import { observeBackupDelete, isBackupDeleteHeld, backupDeleteKey, hasUnconfirmedBackupDeleteInDestination } from './backupDeleteOutcome.ts'

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

test('MAT-002: uncertain retention deletion pauses automatic pruning only in originating vault and folder', () => {
  const current = backupDeleteKey(scope)
  assert.equal(hasUnconfirmedBackupDeleteInDestination([current], { vaultId: 'vault-a', backupPath: '/trusted-backup' }), true)
  assert.equal(hasUnconfirmedBackupDeleteInDestination([current], { vaultId: 'vault-b', backupPath: '/trusted-backup' }), false)
  assert.equal(hasUnconfirmedBackupDeleteInDestination([current], { vaultId: 'vault-a', backupPath: '/other' }), false)
  assert.equal(hasUnconfirmedBackupDeleteInDestination([], { vaultId: 'vault-a', backupPath: '/trusted-backup' }), false)
  assert.equal(hasUnconfirmedBackupDeleteInDestination(['not-json'], { vaultId: 'vault-a', backupPath: '/trusted-backup' }), false)
})


test('MAT-002: Windows drive aliases cannot bypass an indeterminate backup delete hold', () => {
  const windows = { ...scope, backupPath: String.raw`C:\Research\Backups`, backupName: 'Snapshot-01' }
  const key = backupDeleteKey(windows)
  for (const backupPath of ['c:/research/backups/', 'C:/RESEARCH/./Backups', 'c:/research/other/../backups']) {
    const alias = { ...windows, backupPath, backupName: 'snapshot-01' }
    assert.equal(isBackupDeleteHeld([key], alias), true, `uncertain backup deletion must hold ${backupPath}`)
    assert.equal(hasUnconfirmedBackupDeleteInDestination([key], alias), true, `retention must remain paused in ${backupPath}`)
  }
  assert.equal(isBackupDeleteHeld([key], { ...windows, backupPath: 'D:/research/backups' }), false)
  assert.equal(isBackupDeleteHeld([key], { ...windows, vaultId: 'vault-b', backupPath: 'c:/research/backups/' }), false)
})

test('MAT-002: UNC and Unicode path aliases cannot bypass a destination-scoped hold', () => {
  const windows = { ...scope, backupPath: String.raw`\\Server\Share\Café` }
  const key = backupDeleteKey(windows)
  const alias = { ...windows, backupPath: '//server/share/Cafe\u0301/' }
  assert.equal(isBackupDeleteHeld([key], alias), true)
  assert.equal(hasUnconfirmedBackupDeleteInDestination([key], alias), true)
})

test('MAT-002: POSIX backup paths keep their case-sensitive owner and malformed keys are ignored', () => {
  const unix = { ...scope, backupPath: '/mnt/Archive' }
  const key = backupDeleteKey(unix)
  assert.equal(isBackupDeleteHeld([key], { ...unix, backupPath: '/mnt/archive' }), false)
  assert.equal(hasUnconfirmedBackupDeleteInDestination([key], { ...unix, backupPath: '/mnt/archive' }), false)
  assert.equal(isBackupDeleteHeld(['not-json', '{"bad": true}'], unix), false)
  assert.equal(hasUnconfirmedBackupDeleteInDestination(['not-json'], unix), false)
})
