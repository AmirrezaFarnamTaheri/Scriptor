import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const bridge = readFileSync(new URL('../../src/bridge/commands/vault.ts', import.meta.url), 'utf8')
const native = readFileSync(new URL('../../apps/desktop/src-tauri/src/commands/history.rs', import.meta.url), 'utf8')
const panel = readFileSync(new URL('../../src/components/NoteHistoryPanel.tsx', import.meta.url), 'utf8')

// A delayed A -> B vault switch must not redirect a pending restore to B.
// The initiating vault identity is independent of the relative note path.
test('MAT-004 bridge requires and forwards initiating vault identity on history restore', () => {
  const fn = bridge.match(/export async function vaultRestoreNoteHistoryRevision\([\s\S]*?\n\}/)?.[0]
  assert.ok(fn, 'restore bridge command remains exposed')
  assert.match(fn, /expectedVaultId:\s*string/, 'originating identity is required, not optional')
  assert.match(fn, /authorizationToken\s*,[\s\S]*expectedVaultId\s*,/, 'origin is delivered to native command alongside authorization')
})

test('MAT-004 native history restore denies stale vault before consuming approval or reading source', () => {
  const fn = native.match(/pub fn vault_restore_note_history_revision\([\s\S]*?\n\}/)?.[0]
  assert.ok(fn, 'native restore command remains exposed')
  assert.match(fn, /expected_vault_id:\s*String/, 'native restore requires an initiating identity')
  const check = fn.indexOf('validate_expected_vault(')
  const authorization = fn.indexOf('require_sensitive_operation(')
  const read = fn.indexOf('read_note(')
  assert.ok(check > -1 && authorization > check && read > authorization, 'native checks initiating vault before approval and filesystem reads')
  assert.match(fn, /Some\(&expected_vault_id\)/)
})

test('MAT-004 note history passes originating vault identity through approved restore', () => {
  assert.match(panel, /vaultRestoreNoteHistoryRevision\(path,\s*selectedId,\s*vaultId\)/)
  assert.match(panel, /const canRestore = Boolean\([\s\S]{0,150}vaultId/, 'restore is disabled without originating vault identity')
})

test('MAT-004 revision preview read remains bound to original vault on delayed responses', () => {
  assert.match(panel, /vaultReadNoteHistoryRevision\(requestedPath,\s*requestedRevision,\s*vaultId\)/)
})
