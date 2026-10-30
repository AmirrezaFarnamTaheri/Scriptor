import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import vm from 'node:vm'
import ts from 'typescript'

// Exercise the shipped TypeScript bridge without substituting a separate
// implementation. Only the platform-native invoke boundary is intercepted.
const source = ts.transpileModule(
  readFileSync(new URL('../../src/bridge/commands/git.ts', import.meta.url), 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } },
).outputText

function gitBridgeHarness() {
  const calls = []
  const module = { exports: {} }
  vm.runInNewContext(source, {
    Error,
    module,
    exports: module.exports,
    require: (id) => {
      if (id === '@tauri-apps/api/core') {
        return {
          invoke: async (command, args) => {
            calls.push({ command, args: JSON.parse(JSON.stringify(args)) })
            return { commit_hash: 'fixture-hash', files_committed: args.files ?? [] }
          },
        }
      }
      if (id.endsWith('/native.ts')) return { requireNative: () => {} }
      if (id.endsWith('/authorization.ts')) {
        return { authorizeSensitiveOperation: async () => 'fixture-auth' }
      }
      throw new Error(`Unexpected bridge dependency: ${id}`)
    },
  })
  return { api: module.exports, calls }
}

test('a Git commit carries its initiating vault identity across the native boundary', async () => {
  const { api, calls } = gitBridgeHarness()
  let selectedVault = 'vault-before-switch'
  const writing = api.gitCommit(['notes/first.md'], 'Reviewed change', selectedVault)
  selectedVault = 'vault-after-switch'
  await writing

  assert.equal(selectedVault, 'vault-after-switch')
  assert.deepEqual(calls, [{
    command: 'git_commit_cmd',
    args: {
      files: ['notes/first.md'],
      message: 'Reviewed change',
      expectedVaultId: 'vault-before-switch',
    },
  }], 'native must reject a queued old-vault commit rather than silently target the selected vault')
})

test('a Git commit without a vault identity is rejected before invoking native Git', async () => {
  const { api, calls } = gitBridgeHarness()
  await assert.rejects(
    () => api.gitCommit(['notes/first.md'], 'Missing ownership', ''),
    /vault|identity|expected/i,
  )
  assert.equal(calls.length, 0, 'ambiguous write must never reach native Git')
})
