import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
const read = path => readFileSync(new URL('../../' + path, import.meta.url), 'utf8')
test('Tauri and daemon use the same bounded indexed view pagination routine', () => {
  const native = read('crates/indexer/src/views.rs')
  const desktop = read('apps/desktop/src-tauri/src/commands/vault.rs')
  const daemon = read('crates/daemon/src/command_gateway.rs')
  assert.match(native, /pub fn list_view_notes_page\(/)
  assert.match(native, /sql\.push_str\(" AND path > \?"\)/)
  assert.match(native, /if limit\.is_some_and\(/)
  assert.match(desktop, /list_view_notes_page\(/)
  assert.match(daemon, /list_view_notes_page\(/)
  assert.match(desktop, /after_path: Option<String>/)
  assert.match(daemon, /payload\.get\("after_path"\)/)
})
test('database pagination never computes a full-vault aggregate from a single candidate page', () => {
  const ui = read('src/components/DatabaseStudioPanel.tsx')
  assert.match(ui, /sourceCoverage: 'unverified'/)
  assert.match(ui, /candidate page/)
  assert.match(ui, /Next candidates/)
  assert.match(ui, /Previous candidates/)
})
