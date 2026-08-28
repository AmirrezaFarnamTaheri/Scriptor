import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
const read = (p) => readFile(new URL(`../../${p}`, import.meta.url), 'utf8')

test('desktop exposes one bounded redacted support bundle command', async () => {
  const system = await read('apps/desktop/src-tauri/src/commands/system.rs')
  const registry = await read('apps/desktop/src-tauri/src/lib.rs')
  const bridge = await read('src/bridge/commands/system.ts')
  assert.match(system, /pub fn diagnostics_export_support_bundle/)
  assert.match(system, /SUPPORT_BUNDLE_MAX_CLIENT_EVENTS/)
  assert.match(system, /redact_json_value/)
  assert.match(system, /issue_counts/)
  assert.doesNotMatch(system, /"vault_root"/)
  assert.match(registry, /diagnostics_export_support_bundle/)
  assert.match(bridge, /diagnosticsExportSupportBundle/)
})

test('client diagnostic journal is bounded at write time', async () => {
  const system = await read('apps/desktop/src-tauri/src/commands/system.rs')
  assert.match(system, /CLIENT_DIAGNOSTICS_MAX_BYTES/)
  assert.match(system, /truncate_chars/)
  assert.match(system, /rotate_client_diagnostics/)
})
