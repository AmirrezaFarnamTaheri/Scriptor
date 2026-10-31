import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

// MAT-004: a read initiated in vault A must never resolve against vault B's
// identical relative note path, including during an asynchronous vault open.
const bridge = readFileSync(new URL('../../src/bridge/commands/vault.ts', import.meta.url), 'utf8')
const native = readFileSync(new URL('../../apps/desktop/src-tauri/src/commands/vault.rs', import.meta.url), 'utf8')
const panel = readFileSync(new URL('../../src/components/NoteHistoryPanel.tsx', import.meta.url), 'utf8')

function commandBody(commandName) {
  const start = native.indexOf('pub fn ' + commandName + '(')
  assert.notEqual(start, -1, commandName + ' exists')
  const next = native.indexOf('\n#[tauri::command]', start + 1)
  return native.slice(start, next === -1 ? undefined : next)
}

test('native history listing refuses a stale expected vault before resolving its manifest', () => {
  const command = commandBody('vault_list_note_history')
  const identity = command.indexOf('validate_expected_vault(&session.descriptor.id, expected_vault_id.as_deref())?')
  const read = command.indexOf('list_note_history(&session.root, &path)')
  assert.match(command, /expected_vault_id: Option<String>/)
  assert.ok(identity !== -1 && read > identity, 'origin identity must be checked before the history read')
})

test('native current-note read refuses a stale expected vault before reading its bytes', () => {
  const command = commandBody('vault_read_note')
  const identity = command.indexOf('validate_expected_vault(&session.descriptor.id, expected_vault_id.as_deref())?')
  const read = command.indexOf('read_note(&session.descriptor.id, &session.root, &relative)')
  assert.match(command, /expected_vault_id: Option<String>/)
  assert.ok(identity !== -1 && read > identity, 'origin identity must be checked before current-note access')
})

test('TypeScript history and note bridges carry an optional initiating-vault identity', () => {
  assert.match(bridge, /vaultReadNote\(path: string, expectedVaultId\?: string \| null\)/)
  assert.match(bridge, /'vault_read_note', \{ path, expectedVaultId: expectedVaultId \?\? null \}/)
  assert.match(bridge, /vaultListNoteHistory\(path: string, expectedVaultId\?: string \| null\)/)
  assert.match(bridge, /'vault_list_note_history', \{ path, expectedVaultId: expectedVaultId \?\? null \}/)
})

test('Note History scopes initial comparison and final preflight reads to the same vault', () => {
  assert.match(panel, /vaultListNoteHistory\(requestedPath, requestedVaultId\)/)
  assert.match(panel, /vaultReadNote\(requestedPath, requestedVaultId\)/)
  assert.match(panel, /vaultReadNote\(path, vaultId\)/)
  assert.match(panel, /\}, \[path, vaultId\]\)/)
  assert.match(panel, /loadedHistoryVaultId !== vaultId/)
})
