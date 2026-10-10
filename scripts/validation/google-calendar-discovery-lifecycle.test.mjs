import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import vm from 'node:vm'
import ts from 'typescript'

const source = ts.transpileModule(readFileSync(new URL('../../src/hooks/useGoogleCalendarSync.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText

function harness() {
  const consumers = new Map()
  let slots = []
  let cursor = 0
  let effects = []
  const equal = (a, b) => a && b && a.length === b.length && a.every((value, index) => Object.is(value, b[index]))
  const react = {
    useState(initial) {
      const index = cursor++
      const ownSlots = slots
      if (!(index in ownSlots)) ownSlots[index] = typeof initial === 'function' ? initial() : initial
      return [ownSlots[index], (next) => { ownSlots[index] = typeof next === 'function' ? next(ownSlots[index]) : next }]
    },
    useRef(initial) { return slots[cursor++] ??= { current: initial } },
    useCallback(fn, dependencies) {
      const index = cursor++
      if (!equal(slots[index]?.dependencies, dependencies)) slots[index] = { fn, dependencies }
      return slots[index].fn
    },
    useEffect(fn, dependencies) {
      const index = cursor++
      if (!equal(slots[index]?.dependencies, dependencies)) {
        const ownSlots = slots
        effects.push(() => { ownSlots[index]?.cleanup?.(); ownSlots[index] = { dependencies, cleanup: fn() } })
      }
    },
  }
  const listeners = new Map()
  const window = {
    addEventListener(type, listener) { if (!listeners.has(type)) listeners.set(type, new Set()); listeners.get(type).add(listener) },
    removeEventListener(type, listener) { listeners.get(type)?.delete(listener) },
    dispatchEvent(event) { for (const listener of [...(listeners.get(event.type) ?? [])]) listener(event) },
  }
  class CustomEvent { constructor(type, options) { this.type = type; this.detail = options.detail } }
  const bridge = {
    googleCalendarListCalendars: async () => [{ id: 'work', summary: 'Work', accessRole: 'writer', primary: false, writable: true }],
    googleCalendarListTaskLists: async () => [{ id: 'tasks', title: 'Tasks' }],
    googleCalendarListEvents: async () => [{ id: 'event' }],
    googleCalendarListTasks: async () => [{ id: 'task' }],
    googleCalendarGetAuthedEmail: async () => 'calendar@example.invalid',
    googleCalendarStartAuth: async () => 'calendar@example.invalid',
    googleCalendarDisconnect: async () => {},
  }
  const options = { vaultId: 'vault-a', config: { enabled: true, google_client_id: 'client', google_calendar_id: 'primary', google_task_list_id: '@default', lookahead_days: 7 } }
  const module = { exports: {} }
  vm.runInNewContext(source, {
    module, exports: module.exports,
    window, CustomEvent, setTimeout: () => 1, clearTimeout() {}, setInterval: () => 1, clearInterval() {},
    require: (id) => id === 'react' ? react : id.includes('/google_calendar.ts') ? bridge
      : { googleAuthErrorMessage: String, isGoogleAuthRequiredError: (error) => String(error).startsWith('GOOGLE_AUTH_REQUIRED:') },
  })
  return {
    bridge, options,
    render: (consumer = 0) => {
      if (!consumers.has(consumer)) consumers.set(consumer, [])
      slots = consumers.get(consumer); cursor = 0; effects = []
      const value = module.exports.useGoogleCalendarSync(options)
      for (const effect of effects) effect()
      return value
    },
    dispose: (consumer = 0) => { for (const slot of consumers.get(consumer) ?? []) slot?.cleanup?.() },
  }
}

test('disconnect invalidates an in-flight discovery reply', async () => {
  const h = harness()
  let resolve
  h.bridge.googleCalendarListCalendars = () => new Promise((done) => { resolve = done })
  const pending = h.render().discoverResources()
  await h.render().disconnect()
  resolve([{ id: 'late-calendar' }])
  await pending
  assert.equal(h.render().calendars.length, 0)
  assert.equal(h.render().taskLists.length, 0)
  assert.equal(h.render().discoveringResources, false)
})

test('failed resource discovery exposes an error and does not retain a partial catalog', async () => {
  const h = harness()
  await h.render().discoverResources()
  assert.equal(h.render().calendars.length, 1)
  h.bridge.googleCalendarListTaskLists = async () => { throw 'Incomplete task-list pagination' }
  await h.render().discoverResources()
  assert.equal(h.render().calendars.length, 0)
  assert.equal(h.render().taskLists.length, 0)
  assert.equal(h.render().discoveryError, 'Incomplete task-list pagination')
})

test('expired credentials clear cached provider data and resource selections', async () => {
  const h = harness()
  await h.render().refresh()
  assert.equal(h.render().events.length, 1)
  h.bridge.googleCalendarListEvents = async () => { throw 'GOOGLE_AUTH_REQUIRED: expired' }
  await h.render().refresh()
  assert.equal(h.render().status, 'disconnected')
  assert.equal(h.render().events.length, 0)
  assert.equal(h.render().tasks.length, 0)
  assert.equal(h.render().authedEmail, null)
  assert.equal(h.render().calendars.length, 0)
})

test('successful reconnect updates two consumers and invalidates a late old-account discovery', async () => {
  const h = harness()
  await h.render(0).refresh()
  await h.render(1).refresh()
  const previous = h.render(1).accountGeneration
  let finishOldDiscovery
  h.bridge.googleCalendarListCalendars = () => new Promise(resolve => { finishOldDiscovery = resolve })
  const pending = h.render(1).discoverResources()
  h.bridge.googleCalendarListCalendars = async () => [{ id: 'new-calendar', summary: 'New account', accessRole: 'owner', primary: true, writable: true }]
  h.bridge.googleCalendarGetAuthedEmail = async () => 'replacement@example.invalid'
  h.bridge.googleCalendarStartAuth = async () => 'replacement@example.invalid'
  assert.equal(await h.render(0).startAuth(), true)
  finishOldDiscovery([{ id: 'stale-calendar' }])
  await pending
  await Promise.resolve()
  assert.equal(h.render(1).authedEmail, 'replacement@example.invalid')
  assert.equal(h.render(1).accountGeneration, previous + 1)
  assert.equal(h.render(0).accountGeneration, 1)
  assert.equal(h.render(1).calendars[0].id, 'new-calendar')
})

test('same-email reconnect invalidates reviews, and one consumer disconnect clears both', async () => {
  const h = harness()
  await h.render(0).refresh(); await h.render(1).refresh()
  await h.render(0).startAuth()
  assert.equal(h.render(1).accountGeneration, 1)
  assert.equal(h.render(1).authedEmail, 'calendar@example.invalid')
  await h.render(0).disconnect()
  for (const consumer of [0, 1]) {
    const result = h.render(consumer)
    assert.equal(result.accountGeneration, 2)
    assert.equal(result.status, 'disconnected')
    assert.equal(result.events.length, 0)
    assert.equal(result.tasks.length, 0)
    assert.equal(result.calendars.length, 0)
    assert.equal(result.authedEmail, null)
  }
})

test('native OAuth completion notifies surviving consumers after the initiating settings unmounts', async () => {
  const h = harness()
  await h.render(1).refresh()
  let finishAuth
  h.bridge.googleCalendarStartAuth = () => new Promise(resolve => { finishAuth = resolve })
  const pending = h.render(0).startAuth()
  h.dispose(0)
  h.bridge.googleCalendarGetAuthedEmail = async () => 'after-close@example.invalid'
  finishAuth('after-close@example.invalid')
  assert.equal(await pending, false)
  await Promise.resolve(); await Promise.resolve()
  assert.equal(h.render(1).accountGeneration, 1)
  assert.equal(h.render(1).authedEmail, 'after-close@example.invalid')
})
