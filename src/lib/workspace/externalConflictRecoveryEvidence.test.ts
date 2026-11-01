import assert from 'node:assert/strict'
import { test } from 'node:test'
import { inspectActiveExternalConflict } from './externalConflictRecoveryEvidence.ts'

const mismatch = { path: 'Notes/Proof.md', loaded_hash: 'hash-loaded', disk_hash: 'hash-on-disk' }

test('MAT-003: current-note external conflict belongs only to its source vault and note', () => {
  assert.deepEqual(inspectActiveExternalConflict('vault-a', 'Notes/Proof.md', 'vault-a', mismatch), {
    vaultId: 'vault-a', state: 'ready', count: 1,
  })
  assert.equal(inspectActiveExternalConflict('vault-b', 'Notes/Proof.md', 'vault-a', mismatch), undefined)
  assert.equal(inspectActiveExternalConflict('vault-a', 'Notes/Proof.md', 'vault-b', mismatch), undefined)
  assert.equal(inspectActiveExternalConflict('vault-a', 'Other.md', 'vault-a', mismatch), undefined)
})

test('MAT-003: absent or unverifiable mismatch is never misreported as no external conflicts', () => {
  assert.equal(inspectActiveExternalConflict('vault-a', 'Notes/Proof.md', 'vault-a', null), undefined)
  assert.equal(inspectActiveExternalConflict('vault-a', 'Notes/Proof.md', 'vault-a', { ...mismatch, disk_hash: 'hash-loaded' }), undefined)
  assert.equal(inspectActiveExternalConflict('vault-a', 'Notes/Proof.md', 'vault-a', { ...mismatch, loaded_hash: '' }), undefined)
  assert.equal(inspectActiveExternalConflict('vault-a', 'Notes/Proof.md', 'vault-a', { ...mismatch, disk_hash: '' }), undefined)
  assert.equal(inspectActiveExternalConflict('', 'Notes/Proof.md', '', mismatch), undefined)
})
