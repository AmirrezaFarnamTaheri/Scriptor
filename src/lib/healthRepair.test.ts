import assert from 'node:assert/strict'
import test from 'node:test'
import { missingNoteSuggestion, parseHealthRepairPlan, parseHealthRepairReceipt } from './healthRepair.ts'

test('missing note suggestions reject assets, traversal, fragments and external targets', () => {
  assert.equal(missingNoteSuggestion('unresolved link target: Research/New note'), 'Research/New note.md')
  for (const target of ['../outside', 'https://example.test', 'image.png', 'note#section', 'a|alias', '.scriptor/cache']) assert.equal(missingNoteSuggestion(`unresolved link target: ${target}`), null)
})
test('repair plans reject unbounded or invented mutations before review', () => {
  const plan = { vault_id: 'vault', request: { kind: 'create_note', path: 'New.md' }, fingerprint: 'a'.repeat(64), changes: [{ path: 'New.md', expected_hash: '<missing>', before: '', after: '# New\n', bytes: 6 }] }
  assert.equal(parseHealthRepairPlan(plan).changes.length, 1)
  assert.throws(() => parseHealthRepairPlan({ ...plan, changes: [{ ...plan.changes[0], path: '../outside.md' }] }))
  assert.throws(() => parseHealthRepairPlan({ ...plan, changes: Array(101).fill(plan.changes[0]) }))
  assert.throws(() => parseHealthRepairPlan({ ...plan, fingerprint: 'invalid' }))
})
test('recovery receipts bind a UUID, content hash and originating vault', () => {
  const receipt = { id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479', vault_id: 'v', path: 'assets/a.png', hash: 'b'.repeat(64), bytes: 12 }
  assert.equal(parseHealthRepairReceipt(receipt).path, 'assets/a.png')
  assert.throws(() => parseHealthRepairReceipt({ ...receipt, id: '../../outside' }))
  assert.throws(() => parseHealthRepairReceipt({ ...receipt, path: '.scriptor/keychain' }))
})

test('reviewed tag and asset plans validate their source and complete-scan proof', () => {
  const base = { vault_id: 'vault', fingerprint: 'a'.repeat(64), request: { kind: 'normalize_tags', path: 'Note.md' }, changes: [{ path: 'Note.md', expected_hash: 'b'.repeat(64), before: '#Research\n', after: '#research\n', bytes: 10 }] }
  assert.equal(parseHealthRepairPlan(base).request.kind, 'normalize_tags')
  assert.throws(() => parseHealthRepairPlan({ ...base, changes: [{ ...base.changes[0], expected_hash: '<missing>' }] }))
  const asset = { ...base, request: { kind: 'prune_asset', path: 'assets/image.png' }, changes: [{ path: 'assets/image.png', expected_hash: 'b'.repeat(64), before: '', after: '', bytes: 42 }], scan: { complete: true, notes: 7, fingerprint: 'c'.repeat(64) } }
  assert.equal(parseHealthRepairPlan(asset).changes[0].bytes, 42)
  assert.throws(() => parseHealthRepairPlan({ ...asset, scan: { ...asset.scan, complete: false } }))
  assert.throws(() => parseHealthRepairPlan({ ...asset, scan: undefined }))
  assert.throws(() => parseHealthRepairPlan({ ...asset, changes: [{ ...asset.changes[0], after: 'invented' }] }))
})

test('recovery source verification rejects reclassified or incomplete applied state', () => {
  const receipt = { id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479', vault_id: 'v', path: 'assets/a.png', hash: 'b'.repeat(64), bytes: 12, kind: 'prune_asset', after_hash: '<missing>' }
  assert.equal(parseHealthRepairReceipt(receipt).after_hash, '<missing>')
  assert.throws(() => parseHealthRepairReceipt({ ...receipt, kind: 'normalize_tags' }))
  assert.throws(() => parseHealthRepairReceipt({ ...receipt, after_hash: undefined }))
  assert.throws(() => parseHealthRepairReceipt({ ...receipt, kind: 'unknown' }))
})
