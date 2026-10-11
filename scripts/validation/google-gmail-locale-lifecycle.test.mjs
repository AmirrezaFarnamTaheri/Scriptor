import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import vm from 'node:vm'
import ts from 'typescript'

const source = ts.transpileModule(readFileSync(new URL('../../src/components/GmailManagerPanel.tsx', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
}).outputText

function deferred() {
  let resolve
  const promise = new Promise(done => { resolve = done })
  return { promise, resolve }
}

const settle = async () => { for (let index = 0; index < 8; index += 1) await Promise.resolve() }

function harness(connected = true) {
  const slots = [], effects = [], listeners = new Map()
  let cursor = 0, locale = 'en', authReads = 0
  const equal = (a, b) => a && b && a.length === b.length && a.every((value, index) => Object.is(value, b[index]))
  const react = {
    useState(initial) {
      const index = cursor++
      if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial
      return [slots[index], next => { slots[index] = typeof next === 'function' ? next(slots[index]) : next }]
    },
    useRef(initial) { return slots[cursor++] ??= { current: initial } },
    useCallback(fn, dependencies) {
      const index = cursor++
      if (!equal(slots[index]?.dependencies, dependencies)) slots[index] = { fn, dependencies }
      return slots[index].fn
    },
    useMemo(fn, dependencies) {
      const index = cursor++
      if (!equal(slots[index]?.dependencies, dependencies)) slots[index] = { value: fn(), dependencies }
      return slots[index].value
    },
    useEffect(fn, dependencies) {
      const index = cursor++
      if (!equal(slots[index]?.dependencies, dependencies)) effects.push(() => {
        slots[index]?.cleanup?.(); slots[index] = { dependencies, cleanup: fn() }
      })
    },
  }
  const window = {
    addEventListener(type, listener) { if (!listeners.has(type)) listeners.set(type, new Set()); listeners.get(type).add(listener) },
    removeEventListener(type, listener) { listeners.get(type)?.delete(listener) },
    dispatchEvent(event) { for (const listener of listeners.get(event.type) ?? []) listener(event) },
  }
  class CustomEvent { constructor(type, options) { this.type = type; this.detail = options.detail } }
  const message = { id: 'msg-a', threadId: 'thread-a', subject: 'Research', from: 'a@example.invalid', date: '', snippet: 'Body', plainText: 'Body' }
  const bridge = {
    googleGmailGetAuthedEmail: async () => { authReads += 1; if (!connected) throw new Error('GOOGLE_AUTH_REQUIRED: disconnected'); return 'a@example.invalid' },
    googleGmailListMessagesPage: async () => ({ messages: [message], nextPageToken: null }),
    googleGmailGetMessage: async () => message,
    googleGmailStartAuth: async () => 'a@example.invalid',
    googleGmailSendMessage: async () => {},
  }
  const translators = Object.fromEntries(['en', 'de', 'fa'].map(value => [value, key => `${value}:${key}`]))
  const props = { onClose() {}, defaultClientId: 'desktop.apps.googleusercontent.com', onImportNote: async () => {} }
  const module = { exports: {} }
  vm.runInNewContext(source, {
    module, exports: module.exports, window, CustomEvent,
    require: id => {
      if (id === 'react') return react
      if (id === 'react/jsx-runtime') return { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) }
      if (id === 'lucide-react') return new Proxy({}, { get: (_target, key) => key })
      if (id.includes('/google_gmail.ts')) return bridge
      if (id.includes('/platform.ts')) return { isNativeBridgeAvailable: () => true }
      if (id.includes('gmailRfc5322')) return { buildRfc5322Message: () => 'encoded', buildGmailMarkdown: () => '# Research' }
      if (id.includes('googleAuthErrors')) return { googleAuthErrorMessage: String, isGoogleAuthRequiredError: error => String(error).includes('GOOGLE_AUTH_REQUIRED:') }
      if (id.includes('/i18n/')) return { useI18n: () => ({ t: translators[locale] }) }
      return { UnifiedPanelShell: 'panel' }
    },
  })
  const render = () => {
    cursor = 0
    const tree = module.exports.GmailManagerPanel(props)
    effects.splice(0).forEach(fn => fn())
    return tree
  }
  return { bridge, props, render, locale: value => { locale = value }, authReads: () => authReads }
}

function nodes(tree, predicate) {
  if (Array.isArray(tree)) return tree.flatMap(item => nodes(item, predicate))
  if (!tree || typeof tree !== 'object') return []
  return [...(predicate(tree) ? [tree] : []), ...nodes(tree.props?.children, predicate)]
}

const form = (tree, className) => nodes(tree, node => node.type === 'form' && node.props.className === className)[0]
const button = (tree, key) => nodes(tree, node => node.type === 'button' && JSON.stringify(node.props.children).includes(key))[0]
const submit = tree => nodes(tree, node => node.type === 'button' && node.props.type === 'submit')[0]
const event = { preventDefault() {} }

test('locale changes during Gmail authentication do not invalidate completion or leave controls busy', async () => {
  const h = harness(false), auth = deferred()
  h.render(); await settle()
  h.render().props.onTabChange('account')
  h.bridge.googleGmailStartAuth = () => auth.promise
  const pending = form(h.render(), 'gmail-manager-account-form').props.onSubmit(event)
  h.locale('de')
  assert.equal(submit(h.render()).props.disabled, true)
  assert.equal(h.authReads(), 1)
  auth.resolve('a@example.invalid'); await pending; await settle()
  const tree = h.render()
  assert.equal(tree.props.activeTab, 'messages')
  assert.equal(nodes(tree, node => node.props?.className?.split(' ').includes('gmail-manager-message-row')).length, 1)
  tree.props.onTabChange('account')
  assert.equal(button(h.render(), 'integrations.gmail.disconnect').props.disabled, false)
  assert.equal(h.authReads(), 1)
})

test('locale changes during Gmail sending preserve the operation and release compose controls', async () => {
  const h = harness(), sent = deferred()
  h.render(); await settle()
  h.render().props.onTabChange('compose')
  const fields = nodes(h.render(), node => node.type === 'input' || node.type === 'textarea')
  for (const [index, value] of ['person@example.invalid', 'Subject', 'Body'].entries()) fields[index].props.onChange({ target: { value } })
  h.bridge.googleGmailSendMessage = () => sent.promise
  const pending = form(h.render(), 'gmail-manager-compose').props.onSubmit(event)
  h.locale('fa')
  assert.equal(nodes(h.render(), node => node.type === 'input')[0].props.disabled, true)
  assert.equal(h.authReads(), 1)
  sent.resolve(); await pending
  const tree = h.render()
  assert.equal(nodes(tree, node => node.type === 'textarea')[0].props.disabled, false)
  assert.equal(nodes(tree, node => node.type === 'textarea')[0].props.value, '')
  assert.equal(nodes(tree, node => node.props?.role === 'status').length, 1)
})

test('locale changes during Gmail importing retain current ownership and release import controls', async () => {
  const h = harness(), imported = deferred()
  let current
  h.props.onImportNote = async (_subject, _markdown, _id, isCurrent) => { current = isCurrent; await imported.promise }
  h.render(); await settle()
  nodes(h.render(), node => node.props?.className?.split(' ').includes('gmail-manager-message-row'))[0].props.onClick()
  await settle()
  button(h.render(), 'integrations.gmail.import').props.onClick()
  await settle()
  h.locale('de')
  assert.equal(button(h.render(), 'integrations.gmail.import').props.disabled, true)
  assert.equal(current(), true)
  assert.equal(h.authReads(), 1)
  imported.resolve(); await settle()
  assert.equal(button(h.render(), 'integrations.gmail.import').props.disabled, false)
  assert.equal(nodes(h.render(), node => node.props?.role === 'status').length, 1)
})
