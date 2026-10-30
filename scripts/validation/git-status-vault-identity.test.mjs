import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import vm from 'node:vm'
import ts from 'typescript'

// Test the actual desktop Git bridge with only Tauri invocation mocked.
const source = ts.transpileModule(
  readFileSync(new URL('../../src/bridge/commands/git.ts', import.meta.url), 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } },
).outputText

function bridge() {
  const calls = []
  const module = { exports: {} }
  vm.runInNewContext(source, {
    Error,
    module,
    exports: module.exports,
    require: (id) => {
      if (id === '@tauri-apps/api/core') {
        return { invoke: async (name, payload) => {
          calls.push({ name, payload: JSON.parse(JSON.stringify(payload ?? null)) })
          return { is_repo: true, branch: 'main' }
        } }
      }
      if (id.endsWith('/native.ts')) return { requireNative: () => {} }
      if (id.endsWith('/authorization.ts')) {
        return { authorizeSensitiveOperation: async () => 'stub-auth' }
      }
      throw new Error(`Unexpected dependency: ${id}`)
    },
  })
  return { api: module.exports, calls }
}

test('Git status passes initiating vault to the native read', async () => {
  const { api, calls } = bridge()
  await api.gitStatus('vault-at-request')
  assert.deepEqual(calls, [{
    name: 'git_status_cmd',
    payload: { expectedVaultId: 'vault-at-request' },
  }])
})

test('Git status refuses a blank origin without a native read', async () => {
  const { api, calls } = bridge()
  await assert.rejects(() => api.gitStatus(''), /vault|identity|expected/i)
  assert.equal(calls.length, 0)
})
