import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '../..')
const source = path => readFileSync(resolve(root, path), 'utf8')

test('MAT-003: Canvas recovery is a scoped native read, not a renderer write or restore command', () => {
  const command = source('apps/desktop/src-tauri/src/commands/canvas.rs')
  const registration = source('apps/desktop/src-tauri/src/lib.rs')
  const bridge = source('src/bridge/canvas.ts')
  assert.match(command, /pub fn canvas_list_template_checkpoints\(/)
  const body = command.slice(command.indexOf('pub fn canvas_list_template_checkpoints('))
  const throughNextCommand = body.split('#[tauri::command]')[0]
  assert.match(throughNextCommand, /require_canvas_capability\(&state\)/)
  assert.match(throughNextCommand, /validate_expected_vault\(/)
  assert.match(throughNextCommand, /list_template_checkpoints\(session\.root\.root\(\)/)
  assert.doesNotMatch(throughNextCommand, /(?:restore_template_checkpoint|save_document|atomic_write|create_dir_all)\(/)
  assert.match(registration, /canvas_list_template_checkpoints,/)
  assert.match(bridge, /nativeInvoke<CanvasTemplateCheckpointInventory>\('canvas_list_template_checkpoints', \{ expectedVaultId \}\)/)
})

test('MAT-003: corrupt Canvas checkpoints never become a verified-zero recovery row', () => {
  const engine = source('crates/canvas-engine/src/apply.rs')
  const validator = source('src/lib/workspace/canvasRecoveryEvidence.ts')
  const ui = source('src/components/VaultBackupSettings.tsx')
  assert.match(engine, /MAX_CHECKPOINT_ENTRIES/)
  assert.match(engine, /MAX_CHECKPOINT_BYTES/)
  assert.match(engine, /fs::symlink_metadata/)
  assert.match(engine, /canonical_directory\.starts_with\(canonical_root\)/)
  assert.match(engine, /inventory\.invalid_count \+= 1/)
  assert.match(validator, /result\.complete !== true/)
  assert.match(validator, /\(invalidCount as number\) > 0/)
  assert.match(ui, /inspectCanvasRecoveryEvidence\(originVault, reported\)/)
  assert.match(ui, /entry\.route === 'canvas'/)
  assert.doesNotMatch(ui, /canvasRestoreTemplate\(/)
})
