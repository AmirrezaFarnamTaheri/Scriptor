import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const bridge = readFileSync(new URL('../../src/bridge/commands/vault.ts', import.meta.url), 'utf8')
const native = readFileSync(new URL('../../apps/desktop/src-tauri/src/commands/vault.rs', import.meta.url), 'utf8')
const daemon = readFileSync(new URL('../../crates/daemon/src/command_gateway.rs', import.meta.url), 'utf8')

// Revision previews can cross an asynchronous A -> B vault switch. A missing
// initiating identity must never silently turn into a read from vault B.
test('MAT-004 history preview bridge requires the originating vault identity', () => {
  const fn = bridge.match(/export async function vaultReadNoteHistoryRevision\([\s\S]*?\n\}/)?.[0]
  assert.ok(fn, 'history preview bridge must be exposed')
  assert.match(fn, /expectedVaultId:\s*string\b/, 'identity must be required by the bridge signature')
  assert.match(fn, /\{\s*path,\s*revisionId,\s*expectedVaultId\s*\}/, 'the identity must reach Tauri unchanged')
})

test('MAT-004 native revision preview rejects a missing or wrong vault before source reads', () => {
  const fn = native.match(/pub fn vault_read_note_history_revision\([\s\S]*?\n\}/)?.[0]
  assert.ok(fn, 'native history preview handler must exist')
  assert.match(fn, /expected_vault_id:\s*String\s*,/, 'a missing vault identity must not be accepted as an Option')
  assert.match(fn, /Some\(&expected_vault_id\)/, 'native validation must use the supplied vault identity')
  const check = fn.indexOf('validate_expected_vault(')
  const read = fn.indexOf('read_note_history_revision(&session.root')
  assert.ok(check > -1 && read > check, 'native must check the identity before opening revision bytes')
})

test('MAT-004 daemon revision preview requires current initiating vault identity before reading', () => {
  const start = daemon.indexOf('"vault_read_note_history_revision" => {')
  const end = daemon.indexOf('"vault_restore_note_history_revision" => {', start)
  assert.ok(start >= 0 && end > start, 'daemon read route remains addressable and bounded')
  const route = daemon.slice(start, end)
  assert.match(route, /expected_vault_id|expectedVaultId/, 'read route must validate an origin')
  assert.match(route, /session\.descriptor\.id/, 'the authoritative active session owns the comparison')
  const read = route.indexOf('read_note_history_revision(')
  assert.ok(read > -1 && route.indexOf('expected') < read, 'identity check precedes native revision read')
})
