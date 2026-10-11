import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import vm from 'node:vm'
import ts from 'typescript'

const source = ts.transpileModule(readFileSync(new URL('../../src/hooks/useStartupVault.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText

function harness({ noAutoOpen = false, documentDir = async () => '/Documents', join = async (...parts) => parts.join('/') } = {}) {
  const opened = []
  const forgotten = []
  const errors = []
  const module = { exports: {} }
  const refs = []
  let refIndex = 0
  const effects = []
  let effectIndex = 0
  vm.runInNewContext(source, {
    module, exports: module.exports,
    require: (id) => id === 'react' ? {
      useRef: (value) => refs[refIndex++] ??= { current: value },
      useLayoutEffect: (fn) => fn(),
      useEffect: (fn, dependencies) => {
        const index = effectIndex++
        const previous = effects[index]
        if (previous && dependencies.every((value, i) => Object.is(value, previous.dependencies[i]))) return
        previous?.cleanup?.()
        effects[index] = { dependencies, cleanup: fn() }
      },
    } : { documentDir, join },
    console: { error: (...args) => errors.push(args) },
    window: {
      sessionStorage: {
        getItem: (key) => key === 'e2e:no-auto-open' && noAutoOpen ? '1' : null,
      },
    },
  })
  const options = {
    nativeReady: true,
    workspace: { vault: null, status: 'idle', openVaultAt: async (path) => { opened.push(path); return { status: 'opened', isCurrent: () => true } } },
    recentVaults: { recent: [], forget: (path) => { forgotten.push(path) } },
  }
  const render = () => { refIndex = 0; effectIndex = 0; module.exports.useStartupVault(options) }
  const run = async () => { render(); await new Promise(setImmediate) }
  return { options, opened, forgotten, errors, run, render, unmount: () => effects.forEach(effect => effect.cleanup?.()) }
}

test('a delayed default path cannot replace a vault opened by another navigation owner', async () => {
  let finishPath
  const h = harness({ documentDir: () => new Promise(resolve => { finishPath = resolve }) })
  await h.run()
  h.options.workspace = { ...h.options.workspace, vault: { id: 'selected' }, status: 'ready' }
  await h.run()
  finishPath('/Documents')
  await new Promise(setImmediate)
  assert.deepEqual(h.opened, [])
})

test('default startup is cancelled when the owner unmounts during path resolution', async () => {
  let finishPath
  const h = harness({ join: () => new Promise(resolve => { finishPath = resolve }) })
  await h.run()
  h.unmount()
  finishPath('/Documents/ScriptorVault')
  await new Promise(setImmediate)
  assert.deepEqual(h.opened, [])
})

test('explicit E2E empty-startup mode suppresses automatic vault opening', async () => {
  const h = harness({ noAutoOpen: true })
  h.options.recentVaults.recent = ['/recent']
  await h.run()
  assert.deepEqual(h.opened, [])
  assert.deepEqual(h.forgotten, [])
})

test('native startup opens the most recent vault without opening the fallback', async () => {
  const h = harness()
  h.options.recentVaults.recent = ['/recent']
  await h.run()
  assert.deepEqual(h.opened, ['/recent'])
})

test('an unavailable recent vault is forgotten before default-vault fallback', async () => {
  const h = harness()
  h.options.recentVaults.recent = ['/missing']
  h.options.workspace.openVaultAt = async (path) => {
    h.opened.push(path)
    h.options.workspace = { ...h.options.workspace, status: 'opening' }
    h.render()
    await new Promise(setImmediate)
    h.options.workspace = { ...h.options.workspace, status: path === '/missing' ? 'error' : 'ready' }
    h.render()
    return { status: path === '/missing' ? 'failed' : 'opened', isCurrent: () => true }
  }
  await h.run()
  assert.deepEqual(h.forgotten, ['/missing'])
  assert.deepEqual(h.opened, ['/missing', '/Documents/ScriptorVault'])
})

test('a failed recent attempt cannot resume fallback after another open supersedes it', async () => {
  let finishPath
  let current = true
  const h = harness({ documentDir: () => new Promise(resolve => { finishPath = resolve }) })
  h.options.recentVaults.recent = ['/missing']
  h.options.workspace.openVaultAt = async (path) => {
    h.opened.push(path)
    h.options.workspace = { ...h.options.workspace, status: 'error' }
    h.render()
    return { status: 'failed', isCurrent: () => current }
  }
  await h.run()
  current = false
  finishPath('/Documents')
  await new Promise(setImmediate)
  assert.deepEqual(h.opened, ['/missing'])
})

test('an obsolete recent failure does not forget the recent vault or open the fallback', async () => {
  const h = harness()
  h.options.recentVaults.recent = ['/missing']
  h.options.workspace.openVaultAt = async (path) => {
    h.opened.push(path)
    return { status: 'failed', isCurrent: () => false }
  }
  await h.run()
  assert.deepEqual(h.forgotten, [])
  assert.deepEqual(h.opened, ['/missing'])
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
