import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createPendingBackupAction, matchesBackupActionScope } from './backupActionScope.ts'

const vault = { vaultId: 'vault-a', backupPath: '/external/a' }

test('a reviewed confirmation is bound to the originating vault, destination and backup name', () => {
  const pending = createPendingBackupAction(vault, 'snapshot-1', 'restore')
  assert.deepEqual(pending, { name: 'snapshot-1', action: 'restore', vaultId: 'vault-a', backupPath: '/external/a' })
  assert.equal(matchesBackupActionScope(pending, vault, 'snapshot-1'), true)
})

test('same-named backups in a different vault cannot reuse a prior confirmation', () => {
  const pending = createPendingBackupAction(vault, 'snapshot-1', 'restore')
  assert.equal(matchesBackupActionScope(pending, { ...vault, vaultId: 'vault-b' }, 'snapshot-1'), false)
})

test('changing the backup destination invalidates the prior approval', () => {
  const pending = createPendingBackupAction(vault, 'snapshot-1', 'delete')
  assert.equal(matchesBackupActionScope(pending, { ...vault, backupPath: '/external/b' }, 'snapshot-1'), false)
})

test('a different snapshot name is never covered by the existing confirmation', () => {
  const pending = createPendingBackupAction(vault, 'snapshot-1', 'delete')
  assert.equal(matchesBackupActionScope(pending, vault, 'snapshot-2'), false)
})

test('no open vault means no valid restore or delete confirmation', () => {
  assert.equal(createPendingBackupAction({ ...vault, vaultId: null }, 'snapshot-1', 'restore'), null)
  const pending = createPendingBackupAction(vault, 'snapshot-1', 'delete')
  assert.equal(matchesBackupActionScope(pending, { ...vault, vaultId: null }, 'snapshot-1'), false)
})

test('blank names and dismissed confirmations are not actionable', () => {
  assert.equal(createPendingBackupAction(vault, ' ', 'restore'), null)
  assert.equal(matchesBackupActionScope(null, vault, 'snapshot-1'), false)
})
