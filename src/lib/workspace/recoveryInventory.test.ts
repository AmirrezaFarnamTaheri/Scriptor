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
  assert.equal(git?.route, 'git')
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
  assert.equal(entry?.route, 'external-conflict')
  assert.match(entry?.explanation ?? '', /selected note/i)
  assert.match(entry?.explanation ?? '', /not a vault-wide/i)
  const otherVault = buildRecoveryInventory({ ...input, vaultId: 'v-b', externalConflicts })
    .find(row => row.source === 'external-conflicts')
  assert.equal(otherVault?.status, 'unverified')
  assert.equal(otherVault?.count, null)
  assert.equal(otherVault?.route, null)
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


test('MAT-003: current-vault native Canvas checkpoint evidence links to owner workspace without restoration', () => {
  const entries = buildRecoveryInventory({
    ...input, canvas: { vaultId: 'v-a', state: 'ready', count: 2 },
  })
  const canvas = entries.find(row => row.source === 'canvas')
  assert.equal(canvas?.status, 'available')
  assert.equal(canvas?.count, 2)
  assert.equal(canvas?.route, 'canvas')
  assert.equal(canvas?.readOnly, true)
  assert.match(canvas?.explanation ?? '', /separate authorization/i)
  const empty = buildRecoveryInventory({ ...input, canvas: { vaultId: 'v-a', state: 'ready', count: 0 } })
    .find(row => row.source === 'canvas')
  assert.equal(empty?.status, 'empty')
  assert.equal(empty?.route, null)
  const needsReopen = buildRecoveryInventory({ ...input, recoveryRequired: true,
    canvas: { vaultId: 'v-a', state: 'ready', count: 2 },
  }).find(row => row.source === 'canvas')
  assert.equal(needsReopen?.status, 'needs-reopen')
  assert.equal(needsReopen?.count, null)
  assert.equal(needsReopen?.route, null)
})

test('MAT-003: dirty Settings cannot abandon unsaved edits via Canvas recovery navigation', () => {
  const canvas = buildRecoveryInventory({
    ...input,
    settingsDirty: true,
    canvas: { vaultId: 'v-a', state: 'ready', count: 2 },
  }).find(row => row.source === 'canvas')
  assert.equal(canvas?.status, 'available', 'valid inventory remains visible and read-only')
  assert.equal(canvas?.count, 2)
  assert.equal(canvas?.route, null, 'unsaved Settings must block navigation to Canvas')
  assert.match(canvas?.explanation ?? '', /save or discard settings changes/i)
})

test('MAT-003: unknown native source-state values cannot certify zero items or authorize a backup route', () => {
  const state = 'unrecognized-native-state' as never
  const rows = buildRecoveryInventory({
    ...input,
    backups: { ...input.backups, state },
    history: { vaultId: 'v-a', notePath: 'note.md', state, count: 3 },
    canvas: { vaultId: 'v-a', state, count: 0 },
    gitConflicts: { vaultId: 'v-a', state, count: 2 },
    externalConflicts: { vaultId: 'v-a', state, count: 1 },
  })
  for (const source of ['backups', 'note-history', 'canvas', 'git-conflicts', 'external-conflicts']) {
    const row = rows.find(item => item.source === source)
    assert.equal(row?.status, 'unverified', source)
    assert.equal(row?.count, null, source)
    assert.equal(row?.readOnly, true, source)
    assert.notEqual(row?.explanation, '0 items reported by the current-vault source.', source)
  }
  assert.equal(rows.find(item => item.source === 'backups')?.route, null,
    'unknown evidence must not send a user into a restore flow')
  assert.equal(rows.find(item => item.source === 'canvas')?.route, null)
})

test('MAT-003: missing state on otherwise plausible native inventory is not verified-empty', () => {
  const rows = buildRecoveryInventory({
    ...input,
    canvas: { vaultId: 'v-a', count: 0 } as never,
    gitConflicts: { vaultId: 'v-a', count: 0 } as never,
  })
  assert.equal(rows.find(item => item.source === 'canvas')?.status, 'unverified')
  assert.equal(rows.find(item => item.source === 'canvas')?.count, null)
  assert.equal(rows.find(item => item.source === 'git-conflicts')?.status, 'unverified')
  assert.equal(rows.find(item => item.source === 'git-conflicts')?.count, null)
})

test('MAT-003: inconsistent backup verified-count evidence cannot certify an empty inventory', () => {
  for (const verifiedCount of [1, -1, 0.5, Number.NaN, Number.POSITIVE_INFINITY]) {
    const entries = buildRecoveryInventory({
      ...input,
      backups: { ...input.backups, state: 'ready', count: 0, verifiedCount },
    })
    const backup = entries.find(row => row.source === 'backups')
    assert.equal(backup?.status, 'unverified', String(verifiedCount))
    assert.equal(backup?.count, null, String(verifiedCount))
    assert.equal(backup?.route, null, String(verifiedCount))
  }
})

test('MAT-003: contradictory positive backup verification counts fail closed without masking load/error states', () => {
  for (const verifiedCount of [3, -5, 1.5, Number.NaN]) {
    const inventory = buildRecoveryInventory({
      ...input,
      backups: { ...input.backups, state: 'ready', count: 2, verifiedCount },
    })
    const backup = inventory.find(row => row.source === 'backups')
    assert.equal(backup?.status, 'unverified')
    assert.equal(backup?.count, null)
    assert.equal(backup?.route, null)
  }
  for (const [state, status] of [['loading', 'loading'], ['error', 'unavailable']] as const) {
    const inventory = buildRecoveryInventory({
      ...input,
      backups: { ...input.backups, state, count: 0, verifiedCount: 2 },
    })
    const backup = inventory.find(row => row.source === 'backups')
    assert.equal(backup?.status, status)
    assert.equal(backup?.route, null)
  }
})
