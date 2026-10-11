import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import vm from 'node:vm'
import ts from 'typescript'

const source = ts.transpileModule(readFileSync(new URL('../../src/hooks/usePluginCommandRuntime.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText

function deferred() {
  let resolve
  const promise = new Promise(done => { resolve = done })
  return { promise, resolve }
}

function harness() {
  const slots = [], effects = [], calls = [], listeners = new Map()
  let cursor = 0
  const equal = (a, b) => a && b && a.length === b.length && a.every((value, index) => Object.is(value, b[index]))
  const react = {
    useRef: initial => slots[cursor++] ??= { current: initial },
    useMemo: fn => fn(),
    useEffect: (fn, dependencies) => {
      const index = cursor++
      if (!equal(slots[index]?.dependencies, dependencies)) effects.push(() => {
        slots[index]?.cleanup?.()
        slots[index] = { dependencies, cleanup: fn() }
      })
    },
  }
  const message = { id: 'msg-a', subject: 'Research', threadId: 'thread-a', from: 'sender@example.invalid', date: '', plainText: 'Text', snippet: '' }
  const bridge = {
    googleGmailGetMessage: async () => message,
    googleGmailStartAuth: async () => 'other@example.invalid',
    vaultSaveNote: async (...args) => { calls.push(['save', ...args]) },
    indexerUpdateNote: async path => { calls.push(['index', path]) },
  }
  const options = { vaultId: 'vault-a', showToast: text => calls.push(['toast', text]) }
  const window = {
    addEventListener(type, listener) { if (!listeners.has(type)) listeners.set(type, new Set()); listeners.get(type).add(listener) },
    removeEventListener(type, listener) { listeners.get(type)?.delete(listener) },
    dispatchEvent(event) { for (const listener of listeners.get(event.type) ?? []) listener(event) },
  }
  const module = { exports: {} }
  vm.runInNewContext(source, {
    module, exports: module.exports, window,
    CustomEvent: class { constructor(type, options) { this.type = type; this.detail = options.detail } },
    require: id => id === 'react' ? react : id.includes('/bridge/') ? bridge
      : id.includes('gmailRfc5322') ? { gmailImportedNoteTitle: () => 'Research', buildGmailMarkdown: () => '# Research' }
        : { defaultNotePath: title => `${title}.md` },
  })
  const render = () => { cursor = 0; const result = module.exports.usePluginCommandRuntime(options); effects.splice(0).forEach(fn => fn()); return result }
  return { render, options, bridge, calls, message,
    accountChanged: (service = 'gmail') => window.dispatchEvent({ type: 'scriptor:google-account-changed', detail: { service } }),
    dispose: () => { for (const slot of slots) slot?.cleanup?.() },
  }
}

test('Gmail plugin imports bind missing-destination saves to the originating vault', async () => {
  const h = harness()
  assert.equal((await h.render().gmailImport({ messageId: 'msg-a' })).status, 'imported')
  assert.deepEqual(h.calls[0], ['save', 'Email/Research.md', '# Research', '<missing>', false, 'vault-a'])
  assert.equal(h.calls[1][0], 'index')
})

test('vault switch while reading Gmail prevents every local write', async () => {
  const h = harness(), read = deferred()
  h.bridge.googleGmailGetMessage = () => read.promise
  const result = h.render().gmailImport({ messageId: 'msg-a' })
  h.options.vaultId = 'vault-b'; h.render(); read.resolve(h.message)
  await assert.rejects(result, /Vault changed/)
  assert.deepEqual(h.calls, [])
})

test('vault switch during save prevents indexing and notification in the new vault', async () => {
  const h = harness(), save = deferred(), entered = deferred()
  h.bridge.vaultSaveNote = async (...args) => { h.calls.push(['save', ...args]); entered.resolve(); await save.promise }
  const result = h.render().gmailImport({ messageId: 'msg-a' })
  await entered.promise
  h.options.vaultId = 'vault-b'; h.render(); save.resolve()
  assert.equal((await result).status, 'saved-in-originating-vault')
  assert.deepEqual(h.calls.map(call => call[0]), ['save'])
})

test('duplicate import failure propagates without indexing or success notification', async () => {
  const h = harness()
  h.bridge.vaultSaveNote = async () => { throw new Error('Destination already exists') }
  await assert.rejects(h.render().gmailImport({ messageId: 'msg-a' }), /already exists/)
  assert.deepEqual(h.calls, [])
})

test('external Gmail account change during message detail prevents every local write', async () => {
  const h = harness(), read = deferred()
  h.bridge.googleGmailGetMessage = () => read.promise
  const result = h.render().gmailImport({ messageId: 'msg-a' })
  h.accountChanged(); read.resolve(h.message)
  await assert.rejects(result, /Gmail account changed/)
  assert.deepEqual(h.calls, [])
})

test('Google Drive account events do not cancel an independent Gmail import', async () => {
  const h = harness(), read = deferred()
  h.bridge.googleGmailGetMessage = () => read.promise
  const result = h.render().gmailImport({ messageId: 'msg-a' })
  h.accountChanged('drive'); read.resolve(h.message)
  assert.equal((await result).status, 'imported')
})

test('successful plugin reconnect cancels an in-flight import from the previous Gmail account', async () => {
  const h = harness(), read = deferred()
  h.bridge.googleGmailGetMessage = () => read.promise
  const runtime = h.render()
  const result = runtime.gmailImport({ messageId: 'msg-a' })
  assert.equal((await runtime.gmailConnect({ clientId: 'desktop.apps.googleusercontent.com' })).status, 'connected')
  read.resolve(h.message)
  await assert.rejects(result, /Gmail account changed/)
  assert.deepEqual(h.calls, [])
})

test('Gmail account change during save prevents indexing and success notification', async () => {
  const h = harness(), save = deferred(), entered = deferred()
  h.bridge.vaultSaveNote = async (...args) => { h.calls.push(['save', ...args]); entered.resolve(); await save.promise }
  const result = h.render().gmailImport({ messageId: 'msg-a' })
  await entered.promise
  h.accountChanged(); save.resolve()
  assert.equal((await result).status, 'saved-in-originating-vault')
  assert.deepEqual(h.calls.map(call => call[0]), ['save'])
})

test('note factory receives an account-aware import predicate and cannot publish stale success', async () => {
  const h = harness(), saved = deferred(), entered = deferred()
  let isCurrent
  h.options.createNote = async (_title, _markdown, options) => {
    isCurrent = options.isCurrent; entered.resolve(); await saved.promise; return 'Email/Research.md'
  }
  const result = h.render().gmailImport({ messageId: 'msg-a' })
  await entered.promise
  assert.equal(isCurrent(), true)
  h.accountChanged()
  assert.equal(isCurrent(), false)
  saved.resolve()
  assert.equal((await result).status, 'saved-in-originating-vault')
  assert.deepEqual(h.calls, [])
})

test('unmount invalidates delayed Gmail reads and removes account listeners', async () => {
  const h = harness(), read = deferred()
  h.bridge.googleGmailGetMessage = () => read.promise
  const result = h.render().gmailImport({ messageId: 'msg-a' })
  h.dispose(); read.resolve(h.message)
  await assert.rejects(result, /Gmail account changed/)
  assert.deepEqual(h.calls, [])
})
