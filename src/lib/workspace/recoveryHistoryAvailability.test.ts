import assert from 'node:assert/strict'
import { test } from 'node:test'
import { recoveryHistoryAvailability } from './recoveryHistoryAvailability.ts'

test('offers existing note history only for a selected note in an interactive vault', () => {
  assert.deepEqual(recoveryHistoryAvailability({vaultId: 'vault-1', activePath: 'notes/research.md', recoveryRequired: false, settingsDirty: false}), {allowed:true, reason:null})
})

test('requires a selected note instead of showing a dead-end history action', () => {
  assert.equal(recoveryHistoryAvailability({vaultId:'vault-1', activePath:null, recoveryRequired:false, settingsDirty:false}).reason, 'select-note')
  assert.equal(recoveryHistoryAvailability({vaultId:'vault-1', activePath:'', recoveryRequired:false, settingsDirty:false}).allowed, false)
})

test('a frozen restore session never opens history against an unreconciled vault', () => {
  assert.deepEqual(recoveryHistoryAvailability({vaultId:'vault-1', activePath:'research.md', recoveryRequired:true, settingsDirty:false}), {allowed:false,reason:'restart-vault'})
})

test('blocks cross-panel navigation while Settings has unsaved edits', () => {
  assert.deepEqual(recoveryHistoryAvailability({vaultId:'vault-1', activePath:'research.md', recoveryRequired:false, settingsDirty:true}), {allowed:false,reason:'save-settings'})
})

test('without a vault, no note-history action is available', () => {
  assert.equal(recoveryHistoryAvailability({vaultId:null, activePath:'research.md', recoveryRequired:false, settingsDirty:false}).reason,'open-vault')
})

test('recovery hold outranks unsaved settings and missing note', () => {
  assert.equal(recoveryHistoryAvailability({vaultId:'vault-1', activePath:null, recoveryRequired:true, settingsDirty:true}).reason,'restart-vault')
})
