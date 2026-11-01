import assert from 'node:assert/strict'
import test from 'node:test'
import { noteHistoryReadStatus } from './noteHistoryReadStatus.ts'
const scope = { vaultId: 'vault-A', path: 'notes/a.md' }
test('MAT-003 pending native history inspection is loading rather than empty', () => {
  assert.equal(noteHistoryReadStatus(scope, null), 'loading')
})
test('MAT-003 failed native read cannot be advertised as zero previous versions', () => {
  const evidence = { ...scope, count: 0, error: 'Cannot parse history manifest' }
  assert.equal(noteHistoryReadStatus(scope, evidence), 'error')
})
test('MAT-003 genuinely empty history is available only after a scoped successful read', () => {
  assert.equal(noteHistoryReadStatus(scope, { ...scope, count: 0, error: null }), 'empty')
  assert.equal(noteHistoryReadStatus(scope, { ...scope, count: 3, error: null }), 'available')
})
test('MAT-003 stale history from a prior vault or note is never shown', () => {
  assert.equal(noteHistoryReadStatus(scope, { vaultId: 'vault-B', path: scope.path, count: 0, error: null }), 'loading')
  assert.equal(noteHistoryReadStatus(scope, { vaultId: scope.vaultId, path: 'notes/b.md', count: 4, error: null }), 'loading')
})
test('MAT-003 unopened vault is blocked rather than empty or loading', () => {
  assert.equal(noteHistoryReadStatus({ ...scope, vaultId: null }, null), 'blocked')
  assert.equal(noteHistoryReadStatus({ ...scope, path: null }, null), 'select-note')
})
