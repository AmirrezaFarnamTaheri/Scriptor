import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import vm from 'node:vm'
import ts from 'typescript'

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
  const read = fn.indexOf('read_note_history_revision(')
  assert.ok(check > -1 && authorization > check && read > authorization, 'native checks initiating vault before approval and filesystem reads')
  assert.match(fn, /Some\(&expected_vault_id\)/)
})

test('MAT-004 note history passes originating vault identity through approved restore', () => {
  assert.match(panel, /vaultRestoreNoteHistoryRevision\(\s*path,\s*selectedId,\s*vaultId,\s*selectedRevision\.content_hash,\s*latest\.metadata\.content_hash,\s*isDraftSafe,\s*onNativeSubmission,\s*\)/, 'restore supplies the originating vault and exact reviewed revision hash')
  assert.match(panel, /const canRestore = Boolean\([\s\S]{0,150}vaultId/, 'restore is disabled without originating vault identity')
})

test('MAT-004 revision preview read remains bound to original vault on delayed responses', () => {
  assert.match(panel, /vaultReadNoteHistoryRevision\(requestedPath,\s*requestedRevision,\s*vaultId\)/)
})

test('MAT-004 restores only against the destination bytes reviewed before authorization', () => {
  const panelRestore = panel.match(/const restore = async \(\) => \{[\s\S]*?\n\s{2}\}/)?.[0]
  assert.ok(panelRestore, 'history restore UI remains present')
  assert.match(panelRestore, /latest\.metadata\.content_hash/, 'reviewed disk hash must be captured before requesting authorization')
  assert.match(panelRestore, /vaultRestoreNoteHistoryRevision\(\s*path,\s*selectedId,\s*vaultId,\s*selectedRevision\.content_hash,\s*latest\.metadata\.content_hash,\s*isDraftSafe,\s*onNativeSubmission,\s*\)/)

  const bridgeRestore = bridge.match(/export async function vaultRestoreNoteHistoryRevision\([\s\S]*?\n\}/)?.[0]
  assert.ok(bridgeRestore)
  assert.match(bridgeRestore, /expectedCurrentHash:\s*string/)
  assert.match(bridgeRestore, /expectedCurrentHash\s*,/, 'reviewed destination hash must cross asynchronous user authorization')

  const nativeRestore = native.match(/pub fn vault_restore_note_history_revision\([\s\S]*?\n\}/)?.[0]
  assert.ok(nativeRestore)
  assert.match(nativeRestore, /expected_current_hash:\s*String/)
  assert.match(nativeRestore, /Some\(&expected_current_hash\)/, 'atomic writer must check the reviewed hash, never the newly read hash')
  assert.doesNotMatch(nativeRestore, /Some\(&current\.metadata\.content_hash\)/, 'do not silently renew approval after an intervening edit')
  assert.match(panelRestore, /if \(!isDraftSafe\(\)\)/, 'draft is validated before the native call')
})

test('MAT-004 an edit during sensitive authorization aborts before the native restore', async () => {
  const transpiled = ts.transpileModule(bridge, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  const invocations = []
  let grant
  let draftUnchanged = true
  const module = { exports: {} }
  vm.runInNewContext(transpiled, {
    module,
    exports: module.exports,
    require: (id) => {
      if (id === '@tauri-apps/api/core') return { invoke: async (command, args) => {
        invocations.push({ command, args })
        return {}
      } }
      if (id.includes('authorization')) return {
        authorizeSensitiveOperation: () => new Promise(resolve => { grant = resolve }),
      }
      if (id.includes('native')) return { requireNative: () => {} }
      return {}
    },
  })
  const restoring = module.exports.vaultRestoreNoteHistoryRevision(
    'note.md', 'revision-1', 'vault-alpha', 'reviewed-revision-hash',
    'reviewed-destination-hash', () => draftUnchanged,
  )
  draftUnchanged = false
  grant('authorization-token')
  await assert.rejects(restoring, /editor changed|save.*before|review.*again|cancelled/i)
  assert.equal(invocations.length, 0, 'native command must not run after an editor change during authorization')
})

test('MAT-004 after native submission, a lost response must mark the operation unconfirmed', async () => {
  const transpiled = ts.transpileModule(bridge, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  const events = []
  let grant
  const module = { exports: {} }
  vm.runInNewContext(transpiled, {
    module, exports: module.exports,
    require: (id) => {
      if (id === '@tauri-apps/api/core') return { invoke: async () => {
        events.push('native-submission')
        throw Error('reply lost after native submission')
      } }
      if (id.includes('authorization')) return {
        authorizeSensitiveOperation: () => new Promise(resolve => { grant = resolve }),
      }
      if (id.includes('native')) return { requireNative: () => {} }
      return {}
    },
  })
  const pending = module.exports.vaultRestoreNoteHistoryRevision(
    'note.md', 'rev-1', 'vault-alpha', 'revision-hash', 'current-hash',
    () => true, () => events.push('onNativeSubmission'),
  )
  assert.deepEqual(events, [], 'authorization pending must not be mistaken for submission')
  grant('authorization-token')
  await assert.rejects(pending, /reply lost/)
  assert.deepEqual(events, ['onNativeSubmission', 'native-submission'],
    'the receipt phase must be emitted before the native invoke even when the reply is lost')
})

test('MAT-004 once native submission is unconfirmed, the note-history UI forbids blind retry', () => {
  assert.match(panel, /let nativeSubmitted = false/)
  assert.match(panel, /const \[uncertainRestore, setUncertainRestore\] = useState/)
  assert.match(panel, /!uncertainRestore[^\n]*canRestore|!uncertainRestore[^\n]*previewReady|!uncertainRestore[^\n]*selectedRevision|!uncertainRestore/,
    'a lost reply must disable restore until the originating view is reopened')
  assert.match(panel, /if \(nativeSubmitted\) \{[\s\S]*?setUncertainRestore\(/)
  assert.match(panel, /Restore outcome unconfirmed|Restore result unconfirmed/)
  assert.match(panel, /setConfirmRestore\(false\)/)
})
