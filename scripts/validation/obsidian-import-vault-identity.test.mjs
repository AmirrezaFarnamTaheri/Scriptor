import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import vm from 'node:vm'
import ts from 'typescript'

// Exercise the actual authorized vault bridge. Only Tauri invoke, approval,
// and runtime detection are replaced, not the caller's command logic.
const compiled = ts.transpileModule(
  readFileSync(new URL('../../src/bridge/commands/vault.ts', import.meta.url), 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } },
).outputText

function deferred() {
  let resolve
  const promise = new Promise((accept) => { resolve = accept })
  return { promise, resolve }
}

function harness(authorization = async () => 'test-approval') {
  const commands = []
  const approvals = []
  const module = { exports: {} }
  vm.runInNewContext(compiled, {
    Error,
    module,
    exports: module.exports,
    require: (name) => {
      if (name === '@tauri-apps/api/core') return {
        invoke: async (command, args) => {
          commands.push({ command, args: JSON.parse(JSON.stringify(args)) })
          return {
            notesImported: 1, attachmentsImported: 0, skippedFiles: 0,
            errors: [], importedPaths: ['notes/example.md'],
          }
        },
      }
      if (name.endsWith('/native.ts')) return { requireNative: () => {} }
      if (name.endsWith('/authorization.ts')) return {
        authorizeSensitiveOperation: async (...args) => {
          approvals.push(args)
          return authorization(...args)
        },
      }
      if (name.endsWith('/vaultValidators')) return {
        parseVaultHealthDiagnostics: (v) => v,
        parseVaultHealthReport: (v) => v,
      }
      throw new Error(`Unexpected bridge import: ${name}`)
    },
  })
  return { bridge: module.exports, commands, approvals }
}

test('an Obsidian import preserves its initiating vault through delayed approval', async () => {
  const approval = deferred()
  const h = harness(() => approval.promise)
  let selectedVault = 'vault-A'
  const request = h.bridge.vaultImportObsidian('/source/obsidian', selectedVault, {
    convertWikilinks: false, importAttachments: true, preserveFrontmatter: false,
  })
  selectedVault = 'vault-B' // a vault switch while the native approval dialog is pending
  approval.resolve('approved-once')
  await request
  assert.equal(selectedVault, 'vault-B')
  assert.deepEqual(h.approvals, [['import_vault', '/source/obsidian']])
  assert.deepEqual(h.commands, [{
    command: 'vault_import_obsidian',
    args: {
      obsidianPath: '/source/obsidian',
      convertWikilinks: false,
      importAttachments: true,
      preserveFrontmatter: false,
      authorizationToken: 'approved-once',
      expectedVaultId: 'vault-A',
    },
  }], 'native import must receive original vault ID even if selection changes during approval')
})

test('missing Obsidian target vault is rejected before approval or native mutation', async () => {
  const h = harness()
  await assert.rejects(
    () => h.bridge.vaultImportObsidian('/source/obsidian', '', {
      convertWikilinks: true,
    }),
    /vault|identity|target/i,
  )
  assert.equal(h.approvals.length, 0, 'must not request authorization without an owner')
  assert.equal(h.commands.length, 0, 'must not send an ambiguous import')
})

test('native Obsidian import checks vault identity before authorization and file writes', () => {
  const native = readFileSync(
    new URL('../../apps/desktop/src-tauri/src/commands/vault.rs', import.meta.url),
    'utf8',
  )
  const start = native.indexOf('pub fn vault_import_obsidian(')
  assert.ok(start >= 0, 'native import handler exists')
  const body = native.slice(start, native.indexOf('\n#[tauri::command]', start + 1) > 0
    ? native.indexOf('\n#[tauri::command]', start + 1) : undefined)
  assert.match(body, /expected_vault_id:\s*String/, 'expected vault ID is required in the native command')
  const validate = body.indexOf('validate_expected_vault(')
  const authorization = body.indexOf('require_sensitive_operation(')
  const write = body.indexOf('scriptor_vault::import_obsidian_vault(')
  assert.ok(validate > 0 && authorization > validate && write > authorization,
    'native must reject wrong-vault requests before token consumption or importing files')
})
