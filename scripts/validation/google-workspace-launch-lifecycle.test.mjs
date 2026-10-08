import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import vm from 'node:vm'
import ts from 'typescript'

const source = ts.transpileModule(readFileSync(new URL('../../src/hooks/useGoogleWorkspaceLauncher.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText

function harness() {
  const slots = [], effects = [], calls = []
  let cursor = 0
  const workspace = { vault: { id: 'vault-a' }, refreshVaultConfig: async () => true }
  const composition = { commands: [{ id: 'open-drive-collaboration', run: () => calls.push('drive') }] }
  const controls = { setSettingsOpen: value => calls.push(['settings', value]), setTasksOpen: value => calls.push(['tasks', value]),
    setGmailManagerOpen: value => calls.push(['gmail', value]), showToast: value => calls.push(['error', value]) }
  const module = { exports: {} }
  vm.runInNewContext(source, {
    module, exports: module.exports,
    require: id => id === 'react' ? { useRef: initial => slots[cursor++] ??= { current: initial }, useCallback: fn => fn, useEffect: fn => effects.push(fn) }
      : { useI18n: () => ({ t: key => key }) },
  })
  const render = () => { cursor = 0; const launch = module.exports.useGoogleWorkspaceLauncher(workspace, composition, controls); effects.splice(0).forEach(fn => fn()); return launch }
  return { workspace, render, calls }
}

test('Google workspace launch waits for persisted setup before closing Settings', async () => {
  const h = harness()
  let resolve
  h.workspace.refreshVaultConfig = () => new Promise(done => { resolve = done })
  h.render()('collaboration')
  assert.deepEqual(h.calls, [])
  resolve(true); await Promise.resolve()
  assert.deepEqual(h.calls, [['settings', false], 'drive'])
})

test('config refresh failure keeps Settings open and exposes recovery', async () => {
  const h = harness()
  h.workspace.refreshVaultConfig = async () => false
  h.render()('gmail'); await Promise.resolve()
  assert.deepEqual(h.calls, [['error', 'settingsPanel.configReadFailed']])
})

test('vault replacement prevents delayed Google workspace launch', async () => {
  const h = harness()
  let resolve
  h.workspace.refreshVaultConfig = () => new Promise(done => { resolve = done })
  h.render()('planner')
  h.workspace.vault = { id: 'vault-b' }; h.render()
  resolve(true); await Promise.resolve()
  assert.deepEqual(h.calls, [])
})
