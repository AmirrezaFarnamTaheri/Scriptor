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

test('history counts are displayed only for the originating vault and note', () => {
  const history = { vaultId: 'v-a', notePath: 'note.md', state: 'ready' as const, count: 3 }
  const entries = buildRecoveryInventory({ ...input, history })
  assert.equal(entries[1].status, 'available')
  assert.equal(entries[1].count, 3)
  assert.equal(entries[1].route, 'note-history')
  assert.equal(buildRecoveryInventory({ ...input, history, selectedNote: 'changed.md' })[1].count, null)
  assert.equal(buildRecoveryInventory({ ...input, history, vaultId: 'v-b' })[1].count, null)
})
test('history loading, error, empty, and reopen are distinct and non-destructive', () => {
  const history = { vaultId: 'v-a', notePath: 'note.md', state: 'ready' as const, count: 0 }
  assert.equal(buildRecoveryInventory({ ...input, history })[1].status, 'empty')
  assert.equal(buildRecoveryInventory({ ...input, history: { ...history, state: 'loading' } })[1].status, 'loading')
  assert.equal(buildRecoveryInventory({ ...input, history: { ...history, state: 'error' } })[1].status, 'unavailable')
  const blocked = buildRecoveryInventory({ ...input, history, recoveryRequired: true })[1]
  assert.equal(blocked.count, null)
  assert.equal(blocked.route, null)
  assert.equal(blocked.status, 'needs-reopen')
})

test('MAT-003: scoped Git merge conflicts are reported separately from unknown external file conflicts', () => {
  const gitConflicts = { vaultId: 'v-a', state: 'ready' as const, count: 2 }
  const entries = buildRecoveryInventory({ ...input, gitConflicts })
  const git = entries.find(entry => entry.source === 'git-conflicts')
  assert.equal(git?.status, 'available')
  assert.equal(git?.count, 2)
  assert.equal(git?.route, null)
  assert.match(git?.explanation ?? '', /Git-tracked/)
  assert.equal(entries.find(entry => entry.source === 'external-conflicts')?.status, 'unverified')
  const changed = buildRecoveryInventory({ ...input, vaultId: 'v-b', gitConflicts })
  assert.equal(changed.find(entry => entry.source === 'git-conflicts')?.count, null)
})

test('MAT-003: absent, loading, failed, and zero Git inspections have distinct statuses', () => {
  const entry = (gitConflicts?: { vaultId: string; state: 'ready' | 'loading' | 'error' | 'unverified'; count: number }) =>
    buildRecoveryInventory({ ...input, gitConflicts }).find(row => row.source === 'git-conflicts')
  assert.equal(entry()?.status, 'unverified')
  assert.equal(entry({ vaultId: 'v-a', state: 'loading', count: 0 })?.status, 'loading')
  assert.equal(entry({ vaultId: 'v-a', state: 'error', count: 0 })?.status, 'unavailable')
  assert.equal(entry({ vaultId: 'v-a', state: 'unverified', count: 0 })?.status, 'unverified')
  assert.equal(entry({ vaultId: 'v-a', state: 'ready', count: 0 })?.status, 'empty')
})

test('MAT-003: a selected-note external mismatch must be labelled as partial, read-only evidence', () => {
  const externalConflicts = { vaultId: 'v-a', state: 'ready' as const, count: 1 }
  const entry = buildRecoveryInventory({ ...input, externalConflicts }).find(row => row.source === 'external-conflicts')
  assert.equal(entry?.status, 'available')
  assert.equal(entry?.count, 1)
  assert.equal(entry?.route, null)
  assert.match(entry?.explanation ?? '', /selected note/i)
  assert.match(entry?.explanation ?? '', /not a vault-wide/i)
  const otherVault = buildRecoveryInventory({ ...input, vaultId: 'v-b', externalConflicts })
    .find(row => row.source === 'external-conflicts')
  assert.equal(otherVault?.status, 'unverified')
  assert.equal(otherVault?.count, null)
})

test('MAT-003: malformed matching restore receipt is never presented as a successful recovery', () => {
  const invalid = {
    operationId: 'op', operationIdOrigin: 'renderer' as const, vaultId: 'v-a',
    operation: 'restore-backup' as const, target: 'snapshot', backupPath: '/backup',
    affectedPaths: null, expectedRevision: null, actualRevision: null,
    nativeStatus: 'unknown-untrusted-status' as never, proof: 'native-status' as const,
    effect: 'committed' as const, retry: 'do-not-retry' as const, recovery: 'none' as const,
  }
  const entries = buildRecoveryInventory({ ...input, lastRestoreReceipt: invalid })
  const row = entries.find(item => item.source === 'last-restore')
  assert.equal(row?.status, 'needs-reopen')
  assert.equal(row?.count, null)
  assert.equal(row?.route, null)
  assert.equal(row?.readOnly, true)
  assert.match(row?.explanation ?? '', /unverified|invalid|unconfirmed/i)
  assert.match(row?.explanation ?? '', /reopen|restart/i)
  assert.doesNotMatch(row?.explanation ?? '', /confirmed-committed/i)
  const unrelated = buildRecoveryInventory({ ...input, lastRestoreReceipt: { ...invalid, vaultId: 'other' } })
  assert.equal(unrelated.some(row => row.source === 'last-restore'), false,
    'a foreign-vault corrupt receipt must never be shown under the current vault')
})

test('MAT-003: structurally corrupt restore evidence never crashes the read-only recovery overview', () => {
  const invalid = {
    vaultId: 'v-a', backupPath: '/backup', operationId: null,
    proof: 'unexpected-proof', nativeStatus: null,
  } as never
  const entries = buildRecoveryInventory({ ...input, lastRestoreReceipt: invalid })
  assert.equal(entries.length, 6)
  assert.equal(entries.find(item => item.source === 'last-restore')?.status, 'needs-reopen')
})
