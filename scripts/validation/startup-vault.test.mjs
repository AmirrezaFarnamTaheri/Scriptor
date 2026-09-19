import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import vm from 'node:vm'
import ts from 'typescript'

const source = ts.transpileModule(readFileSync(new URL('../../src/hooks/useStartupVault.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText

function harness() {
  const opened = []
  const forgotten = []
  const errors = []
  const module = { exports: {} }
  vm.runInNewContext(source, {
    module, exports: module.exports,
    require: (id) => id === 'react' ? { useEffect: (fn) => fn() }
      : { documentDir: async () => '/Documents', join: async (...parts) => parts.join('/') },
    console: { error: (...args) => errors.push(args) },
  })
  const options = {
    nativeReady: true,
    workspace: { vault: null, status: 'idle', openVaultAt: async (path) => { opened.push(path) } },
    recentVaults: { recent: [], forget: (path) => { forgotten.push(path) } },
  }
  const run = async () => { module.exports.useStartupVault(options); await new Promise(setImmediate) }
  return { options, opened, forgotten, errors, run }
}

test('native startup opens the most recent vault without opening the fallback', async () => {
  const h = harness()
  h.options.recentVaults.recent = ['/recent']
  await h.run()
  assert.deepEqual(h.opened, ['/recent'])
})

test('an unavailable recent vault is forgotten before default-vault fallback', async () => {
  const h = harness()
  h.options.recentVaults.recent = ['/missing']
  h.options.workspace.openVaultAt = async (path) => { h.opened.push(path); if (path === '/missing') throw new Error('missing') }
  await h.run()
  assert.deepEqual(h.forgotten, ['/missing'])
  assert.deepEqual(h.opened, ['/missing', '/Documents/ScriptorVault'])
})

test('startup does not replace an already open vault or run outside an idle native session', async () => {
  for (const setup of [
    (h) => { h.options.nativeReady = false },
    (h) => { h.options.workspace.vault = { id: 'open' } },
    (h) => { h.options.workspace.status = 'loading' },
  ]) {
    const h = harness()
    setup(h)
    await h.run()
    assert.equal(h.opened.length, 0)
  }
})

test('default-vault startup failure is handled rather than rejecting unattended', async () => {
  const h = harness()
  h.options.workspace.openVaultAt = async () => { throw new Error('permission denied') }
  await h.run()
  assert.equal(h.errors.length, 1)
})
