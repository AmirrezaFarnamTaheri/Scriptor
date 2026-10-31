import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const bridge = readFileSync(new URL('../../src/bridge/commands/vault.ts', import.meta.url), 'utf8')
const native = readFileSync(new URL('../../apps/desktop/src-tauri/src/commands/history.rs', import.meta.url), 'utf8')
const history = readFileSync(new URL('../../src/components/NoteHistoryPanel.tsx', import.meta.url), 'utf8')

test('MAT-004 source revision hash travels from reviewed timeline to native restore', () => {
  const fn = bridge.match(/export async function vaultRestoreNoteHistoryRevision\([\s\S]*?\n\}/)?.[0]
  assert.ok(fn)
  assert.match(fn, /expectedRevisionHash:\s*string/)
  assert.match(fn, /expectedRevisionHash\s*,/)
  assert.match(history, /vaultRestoreNoteHistoryRevision\(\s*path,\s*selectedId,\s*vaultId,\s*selectedRevision\.content_hash,\s*latest\.metadata\.content_hash,\s*isDraftSafe,\s*\)/, 'reviewed revision, originating vault, and destination hash must all reach native restore')
  assert.match(fn, /expectedCurrentHash:\s*string/, 'destination CAS must be an explicit required argument')
})

test('MAT-004 native restore refuses changed retained bytes before any destination write', () => {
  const fn = native.match(/pub fn vault_restore_note_history_revision\([\s\S]*?\n\}/)?.[0]
  assert.ok(fn)
  assert.match(fn, /expected_revision_hash:\s*String/)
  const sourceRead = fn.indexOf('read_note_history_revision(')
  const validation = fn.indexOf('validate_reviewed_revision_hash(')
  const destinationWrite = fn.indexOf('save_note_with_options(')
  assert.ok(sourceRead > -1 && validation > sourceRead && destinationWrite > validation)
  assert.match(fn, /&historical_markdown,\s*&expected_revision_hash/)
})
