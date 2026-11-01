import assert from 'node:assert/strict'
import { test } from 'node:test'
import { inspectGitConflictEvidence } from './gitConflictRecoveryEvidence.ts'

const repoStatus = {
  is_repo: true,
  branch: 'main',
  has_conflicts: true,
  conflicted_files: [
    { path: 'Notes/Draft.md', status: 'U', conflict: true },
    { path: 'Research/Source.md', status: 'U', conflict: true },
  ],
}

test('MAT-003: a scoped native Git read counts unique unresolved conflicts', () => {
  assert.deepEqual(inspectGitConflictEvidence('vault-a', repoStatus), {
    vaultId: 'vault-a', state: 'ready', count: 2,
  })
  assert.deepEqual(inspectGitConflictEvidence('vault-b', { ...repoStatus, has_conflicts: false, conflicted_files: [] }), {
    vaultId: 'vault-b', state: 'ready', count: 0,
  })
})

test('MAT-003: absence of a Git repository is unverified, not a proof of zero external conflicts', () => {
  assert.equal(inspectGitConflictEvidence('vault-a', { ...repoStatus, is_repo: false, has_conflicts: false, conflicted_files: [] }), undefined)
})

test('MAT-003: contradictory and duplicate native conflict inventories are unavailable', () => {
  assert.equal(inspectGitConflictEvidence('vault-a', { ...repoStatus, has_conflicts: false }).state, 'error')
  assert.equal(inspectGitConflictEvidence('vault-a', { ...repoStatus, conflicted_files: [] }).state, 'error')
  assert.equal(inspectGitConflictEvidence('vault-a', { ...repoStatus, conflicted_files: [repoStatus.conflicted_files[0], repoStatus.conflicted_files[0]] }).state, 'error')
})

test('MAT-003: malformed or excessive native responses never become zero or restore authority', () => {
  assert.equal(inspectGitConflictEvidence('vault-a', null).state, 'error')
  assert.equal(inspectGitConflictEvidence('vault-a', { ...repoStatus, conflicted_files: [{ path: '', status: 'U' }] }).state, 'error')
  assert.equal(inspectGitConflictEvidence('vault-a', { ...repoStatus, conflicted_files: Array.from({length: 50_001}, (_, i) => ({path: String(i)})) }).state, 'error')
})

test('MAT-003: contradictory native per-file conflict flags cannot become verified recovery counts', () => {
  for (const file of [
    { path: 'Note.md', status: 'modified', conflict: false },
    { path: 'Note.md', status: 'conflict', conflict: 'true' },
    { path: 'Note.md', status: '', conflict: true },
  ]) {
    assert.equal(inspectGitConflictEvidence('vault-a', {
      is_repo: true, has_conflicts: true, conflicted_files: [file],
    })?.state, 'error')
  }
})
