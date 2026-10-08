import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import vm from 'node:vm'
import ts from 'typescript'

const source = ts.transpileModule(readFileSync(new URL('../../src/hooks/useGoogleIntegrationAccounts.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText

function harness() {
  const slots = []
  const effects = []
  const calls = []
  const events = []
  let cursor = 0
  const react = {
    useState(initial) {
      const index = cursor++
      if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial
      return [slots[index], (next) => { slots[index] = typeof next === 'function' ? next(slots[index]) : next }]
    },
    useRef(initial) { return slots[cursor++] ??= { current: initial } },
    useCallback: (fn) => fn,
    useEffect: (fn) => effects.push(fn),
  }
  const bridge = {
    collaborationGetAccount: async () => null,
    collaborationConnect: async () => { calls.push('drive:connect'); return 'drive@example.invalid' },
    collaborationDisconnect: async () => { calls.push('drive:disconnect') },
    googleGmailGetAuthedEmail: async () => { throw 'GOOGLE_AUTH_REQUIRED: disconnected' },
    googleGmailStartAuth: async () => { calls.push('gmail:connect'); return 'gmail@example.invalid' },
    googleGmailDisconnect: async () => { calls.push('gmail:disconnect') },
  }
  let persisted = 0
  const options = { vaultId: 'vault-a', clientId: 'client', persistClientId: async () => { persisted++ } }
  const module = { exports: {} }
  vm.runInNewContext(source, {
    module, exports: module.exports,
    window: { addEventListener() {}, removeEventListener() {}, dispatchEvent(event) { events.push(event) } },
    CustomEvent: class { constructor(type, init) { this.type = type; this.detail = init.detail } },
    require: (id) => id === 'react' ? react : id.includes('/commands/') ? bridge
      : { googleAuthErrorMessage: String, isGoogleAuthRequiredError: (error) => String(error).startsWith('GOOGLE_AUTH_REQUIRED:') },
  })
  const render = () => { cursor = 0; return module.exports.useGoogleIntegrationAccounts(options) }
  return { render, bridge, calls, events, options, persisted: () => persisted, unmount: () => effects.map((effect) => effect()).filter(Boolean).forEach((cleanup) => cleanup()) }
}

test('Drive and Gmail connect and disconnect use independent credential lanes', async () => {
  const h = harness()
  await h.render().connect('drive')
  await h.render().connect('gmail')
  assert.equal(h.render().drive.email, 'drive@example.invalid')
  assert.equal(h.render().gmail.email, 'gmail@example.invalid')
  await h.render().disconnect('drive')
  assert.equal(h.render().drive.email, null)
  assert.equal(h.render().gmail.email, 'gmail@example.invalid')
  assert.deepEqual(h.calls, ['drive:connect', 'gmail:connect', 'drive:disconnect'])
  assert.equal(h.persisted(), 2)
})

test('cancelled OAuth does not persist configuration or disconnect another account', async () => {
  const h = harness()
  h.bridge.collaborationConnect = async () => { throw 'Cancelled by user' }
  await h.render().connect('drive')
  assert.equal(h.persisted(), 0)
  assert.equal(h.render().drive.status, 'error')
  assert.equal(h.render().gmail.email, null)
  assert.deepEqual(h.calls, [])
})

test('a disabled Gmail capability cannot read, connect or disconnect Gmail', async () => {
  const h = harness()
  h.options.gmailEnabled = false
  h.bridge.googleGmailGetAuthedEmail = async () => { h.calls.push('gmail:read'); return 'unexpected' }
  await h.render().check('gmail')
  await h.render().connect('gmail')
  await h.render().disconnect('gmail')
  assert.deepEqual(h.calls, [])
  assert.equal(h.persisted(), 0)
  assert.equal(h.render().gmail.status, 'disconnected')
  await h.render().connect('drive')
  assert.equal(h.render().drive.email, 'drive@example.invalid')
})

test('persistence failure remains visible without deleting a connected credential', async () => {
  const h = harness()
  h.options.persistClientId = async () => { throw 'Config write failed' }
  await h.render().connect('gmail')
  assert.equal(h.render().gmail.email, 'gmail@example.invalid')
  assert.equal(h.render().gmail.error, 'Config write failed')
  assert.deepEqual(h.calls, ['gmail:connect'])
})

test('unmount invalidates late OAuth before configuration persistence', async () => {
  const h = harness()
  let resolve
  h.bridge.collaborationConnect = () => new Promise((done) => { resolve = done })
  const pending = h.render().connect('drive')
  h.unmount()
  resolve('late@example.invalid')
  await pending
  assert.equal(h.persisted(), 0)
  assert.equal(h.render().drive.email, null)
  assert.equal(h.events.at(-1).detail.service, 'drive')
})

test('credential changes notify other panels before a delayed config write completes', async () => {
  const h = harness()
  let resolve
  h.options.persistClientId = () => new Promise(done => { resolve = done })
  const pending = h.render().connect('gmail')
  await Promise.resolve()
  assert.equal(h.events.length, 1)
  assert.equal(h.events[0].detail.service, 'gmail')
  resolve(); await pending
})

test('successful disconnect after settings unmount still invalidates other panels', async () => {
  const h = harness()
  let resolve
  h.bridge.collaborationDisconnect = () => new Promise(done => { resolve = done })
  const pending = h.render().disconnect('drive')
  h.unmount(); resolve(); await pending
  assert.equal(h.events.length, 1)
  assert.equal(h.events[0].detail.service, 'drive')
})
