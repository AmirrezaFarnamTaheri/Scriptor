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
      : id.endsWith('/googleOAuthClient.ts') ? { getGoogleOAuthClientId: (legacy) => legacy?.trim() ?? '' }
      : { googleAuthErrorMessage: String, isGoogleAuthRequiredError: (error) => String(error).startsWith('GOOGLE_AUTH_REQUIRED:'),
        isGoogleAccountNotConnectedError: (error) => ['GOOGLE_AUTH_REQUIRED: disconnected', 'GOOGLE_AUTH_REQUIRED: Google account is not connected.', 'GOOGLE_AUTH_REQUIRED: Gmail is not connected'].includes(String(error)) },
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
  assert.equal(h.render().status, 'reconnect-required')
  assert.match(h.render().error ?? '', /expired/)
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

test('MAT-015: Calendar OAuth expiry clears previously observed account identity and requires reconnection', async () => {
  const h = harness()
  await h.render().refresh()
  assert.equal(h.render().authedEmail, 'calendar@example.invalid')
  h.bridge.googleCalendarStartAuth = async () => { throw 'GOOGLE_AUTH_REQUIRED: account authorization expired' }
  assert.equal(await h.render().startAuth(), false)
  assert.equal(h.render().status, 'reconnect-required')
  assert.equal(h.render().authedEmail, null)
  assert.equal(h.render().events.length, 0)
  assert.equal(h.render().tasks.length, 0)
  assert.match(h.render().error ?? '', /authorization expired/)
})

test('MAT-015: Calendar Settings exposes the existing localized reconnect route for expired sessions', () => {
  const ui = readFileSync(new URL('../../src/components/GoogleIntegrationSettingsSection.tsx', import.meta.url), 'utf8')
  assert.match(ui, /calendarSync\.status === 'reconnect-required'/)
  assert.match(ui, /calendarNeedsReconnect \? t\('integrations\.google\.reconnect'\)/)
})

test('MAT-015: missing Calendar credentials remain disconnected instead of demanding reconnection', async () => {
  const h = harness()
  h.bridge.googleCalendarListEvents = async () => { throw 'GOOGLE_AUTH_REQUIRED: Google account is not connected.' }
  await h.render().refresh()
  assert.equal(h.render().status, 'disconnected')
  assert.equal(h.render().authedEmail, null)
  assert.equal(h.render().events.length, 0)
})

test('MAT-015: Task panel renders a localized reconnect label instead of a missing status key', () => {
  const ui = readFileSync(new URL('../../src/components/TaskPanel.tsx', import.meta.url), 'utf8')
  assert.match(ui, /calendarSync\.status === 'reconnect-required'\s*\?\s*t\('integrations\.google\.reconnect'\)/)
  assert.match(ui, /calendarStatusLabel/)
})

test('MAT-015: expired Calendar refresh invalidates every mounted consumer without retry loops', async () => {
  const h = harness()
  await h.render(0).refresh()
  await h.render(1).refresh()
  const beforeGeneration = h.render(1).accountGeneration
  let reads = 0
  h.bridge.googleCalendarListEvents = async () => {
    reads += 1
    throw 'GOOGLE_AUTH_REQUIRED: Google authorization expired. Reconnect the account.'
  }
  await h.render(0).refresh()
  assert.equal(h.render(0).status, 'reconnect-required')
  const other = h.render(1)
  assert.equal(other.status, 'reconnect-required')
  assert.equal(other.accountGeneration, beforeGeneration + 1)
  assert.equal(other.authedEmail, null)
  assert.equal(other.events.length, 0)
  assert.equal(other.tasks.length, 0)
  assert.match(other.error ?? '', /authorization expired/)
  assert.equal(reads, 1, 'peer must not auto-refresh an expired account in a notification loop')
})

test('MAT-015: rejected Calendar OAuth in Settings clears remote state in other mounted panels', async () => {
  const h = harness()
  await h.render(0).refresh()
  await h.render(1).refresh()
  const beforeGeneration = h.render(1).accountGeneration
  h.bridge.googleCalendarStartAuth = async () => {
    throw 'GOOGLE_AUTH_REQUIRED: account session expired during reconnect'
  }
  assert.equal(await h.render(0).startAuth(), false)
  const other = h.render(1)
  assert.equal(other.status, 'reconnect-required')
  assert.equal(other.accountGeneration, beforeGeneration + 1)
  assert.equal(other.authedEmail, null)
  assert.deepEqual(Array.from(other.events), [])
  assert.deepEqual(Array.from(other.tasks), [])
  assert.match(other.error ?? '', /session expired/)
})

test('MAT-015: missing Calendar credentials clear other panels without mislabeling first-time setup', async () => {
  const h = harness()
  await h.render(0).refresh()
  await h.render(1).refresh()
  h.bridge.googleCalendarListEvents = async () => {
    throw 'GOOGLE_AUTH_REQUIRED: Google account is not connected.'
  }
  await h.render(0).refresh()
  const other = h.render(1)
  assert.equal(other.status, 'disconnected')
  assert.equal(other.authedEmail, null)
  assert.equal(other.events.length, 0)
  assert.equal(other.tasks.length, 0)
})

test('MAT-015: an already submitted Google Task result cannot repopulate cache after native auth expires', async () => {
  const h = harness()
  await h.render().refresh()
  let finishCreation
  h.bridge.googleCalendarCreateTask = () => new Promise(resolve => { finishCreation = resolve })
  const pendingCreation = h.render().pushTask({ title: 'Pending task' })
  h.bridge.googleCalendarListEvents = async () => {
    throw 'GOOGLE_AUTH_REQUIRED: session expired while a task request was pending'
  }
  await h.render().refresh()
  assert.equal(h.render().status, 'reconnect-required')
  finishCreation({ id: 'late-task', title: 'Pending task', etag: 'late-revision' })
  await pendingCreation
  assert.equal(h.render().tasks.length, 0, 'a late provider response cannot revive a cache after credential expiry')
  assert.equal(h.render().authedEmail, null)
})
