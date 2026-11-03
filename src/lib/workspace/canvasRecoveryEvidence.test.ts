import assert from 'node:assert/strict'
import { test } from 'node:test'
import { inspectCanvasRecoveryEvidence } from './canvasRecoveryEvidence.ts'
import { buildRecoveryInventory } from './recoveryInventory.ts'

const owner = 'vault-A'
const report = (checkpointCount = 3, invalidCount = 0) => ({
  vaultId: owner,
  checkpointCount,
  invalidCount,
  complete: true,
})

const inventory = (canvas?: ReturnType<typeof inspectCanvasRecoveryEvidence>) => buildRecoveryInventory({
  vaultId: owner, backupPath: '/backups', recoveryRequired: false,
  selectedNote: null, settingsDirty: false, canvas,
}).find(row => row.source === 'canvas')

test('MAT-003: native Canvas template checkpoints produce a current-vault read-only recovery count', () => {
  const verified = inspectCanvasRecoveryEvidence(owner, report(3))
  assert.deepEqual(verified, { vaultId: owner, state: 'ready', count: 3 })
  const entry = inventory(verified)
  assert.equal(entry?.status, 'available')
  assert.equal(entry?.count, 3)
  assert.equal(entry?.route, 'canvas')
  assert.equal(entry?.readOnly, true)
  assert.equal(inventory(inspectCanvasRecoveryEvidence(owner, report(0)))?.status, 'empty')
})

test('MAT-003: a corrupt checkpoint or truncated source cannot certify zero recoverable items', () => {
  for (const value of [report(0, 1), report(3, 1), { ...report(0), complete: false }]) {
    const evidence = inspectCanvasRecoveryEvidence(owner, value)
    assert.equal(evidence?.state, 'unverified')
    const entry = inventory(evidence)
    assert.equal(entry?.status, 'unverified')
    assert.equal(entry?.count, null)
    assert.equal(entry?.route, null)
  }
})

test('MAT-003: invalid native checkpoint data cannot certify a current-vault inventory', () => {
  for (const value of [null, [], 'three', report(-1), report(1.5), report(2, -1),
    { ...report(2), checkpointCount: '2' },
    { ...report(2), invalidCount: Infinity },
    { ...report(2), complete: 'true' },
    { ...report(0), vaultId: 'vault-B' },
    { ...report(0), checkpointCount: 10001 },
  ]) {
    const evidence = inspectCanvasRecoveryEvidence(owner, value)
    assert.equal(evidence?.state, 'unverified', JSON.stringify(value))
    assert.equal(inventory(evidence)?.count, null, 'invalid evidence is not confirmed empty')
  }
})

test('MAT-003: Canvas checkpoint evidence is tied to its source vault, not the active UI selection', () => {
  const evidence = inspectCanvasRecoveryEvidence(owner, report(1))
  assert.equal(evidence?.state, 'ready')
  const unrelated = buildRecoveryInventory({
    vaultId: 'vault-B', backupPath: '/backups', recoveryRequired: false,
    selectedNote: null, settingsDirty: false, canvas: evidence,
  }).find(row => row.source === 'canvas')
  assert.equal(unrelated?.count, null)
  assert.equal(unrelated?.status, 'unverified')
  assert.equal(inspectCanvasRecoveryEvidence('', report(1)), undefined)
})

test('MAT-003: unchecked or failed Canvas recovery source remains unavailable, not an empty inventory', () => {
  assert.equal(inventory()?.status, 'unverified')
  const failed = { vaultId: owner, state: 'error' as const, count: 0 }
  assert.equal(inventory(failed)?.status, 'unavailable')
  assert.equal(inventory(failed)?.count, null)
})
