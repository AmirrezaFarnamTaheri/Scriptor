import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildRecoveryInventory } from './recoveryInventory.ts'
const input = {
  vaultId: 'v-a', backupPath: '/backup', recoveryRequired: false,
  backups: { vaultId: 'v-a', backupPath: '/backup', state: 'ready' as const, count: 2, verifiedCount: 1 },
  selectedNote: 'note.md', settingsDirty: false,
}
test('no vault means no previously selected recovery sources', () => {
  assert.deepEqual(buildRecoveryInventory({ ...input, vaultId: null }), [])
})
test('backup availability requires native verification in the matching vault and folder', () => {
  const r = buildRecoveryInventory(input)
  assert.equal(r[0].status, 'available')
  assert.equal(r[0].route, 'backup-settings')
  assert.equal(buildRecoveryInventory({ ...input, vaultId: 'v-b' })[0].status, 'loading')
  assert.equal(buildRecoveryInventory({ ...input, backupPath: '/different' })[0].count, null)
})
test('unverified backup cannot be advertised as available to restore', () => {
  const r = buildRecoveryInventory({ ...input, backups: { ...input.backups, verifiedCount: 0 } })
  assert.equal(r[0].status, 'unverified')
  assert.equal(r[0].route, null)
})
test('loading and error are distinct from an empty native inventory', () => {
  assert.equal(buildRecoveryInventory({ ...input, backups: { ...input.backups, state: 'loading' } })[0].status, 'loading')
  assert.equal(buildRecoveryInventory({ ...input, backups: { ...input.backups, state: 'error' } })[0].status, 'unavailable')
  assert.equal(buildRecoveryInventory({ ...input, backups: { ...input.backups, count: 0, verifiedCount: 0 } })[0].status, 'empty')
})
test('history route does not imply saved revisions exist', () => {
  const r = buildRecoveryInventory(input)[1]
  assert.equal(r.status, 'unverified')
  assert.equal(r.route, 'note-history')
  assert.equal(buildRecoveryInventory({ ...input, settingsDirty: true })[1].route, null)
})
test('unknown Canvas and conflict sources remain unverified, never zero', () => {
  const r = buildRecoveryInventory(input)
  assert.equal(r.find(x => x.source === 'canvas')?.count, null)
  assert.equal(r.find(x => x.source === 'external-conflicts')?.status, 'unverified')
})
test('lost native reply disables recovery writes until vault reopen', () => {
  const receipt = {
    operationId: 'op', operationIdOrigin: 'renderer' as const, vaultId: 'v-a',
    operation: 'restore-backup' as const, target: 'snapshot', backupPath: '/backup',
    affectedPaths: null, expectedRevision: null, actualRevision: null,
    nativeStatus: null, proof: 'no-native-result' as const,
    effect: 'unknown' as const, retry: 'blocked-until-reopen' as const, recovery: 'reopen-vault' as const,
  }
  const entries = buildRecoveryInventory({ ...input, recoveryRequired: true, lastRestoreReceipt: receipt })
  assert.equal(entries[0].route, null)
  assert.equal(entries[1].route, null)
  assert.equal(entries.find(x => x.source === 'last-restore')?.status, 'needs-reopen')
  assert.match(entries.find(x => x.source === 'last-restore')!.explanation, /indeterminate/)
  assert.equal(buildRecoveryInventory({ ...input, lastRestoreReceipt: { ...receipt, vaultId: 'v-b' } }).some(x => x.source === 'last-restore'), false)
})
