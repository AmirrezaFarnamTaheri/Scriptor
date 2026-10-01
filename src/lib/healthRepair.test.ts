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
