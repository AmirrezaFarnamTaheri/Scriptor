import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import vm from 'node:vm'
import ts from 'typescript'

const compile = relative => ts.transpileModule(readFileSync(new URL(relative, import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
}).outputText
const componentSource = compile('../../src/components/PlannerWorkspace.tsx')
const plannerSource = compile('../../src/lib/planner.ts')
const ownershipSource = compile('../../src/lib/plannerGoogleOwnership.ts')
const deferred = () => {
  let resolve
  const promise = new Promise(done => { resolve = done })
  return { promise, resolve }
}
const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve() }

function harness() {
  const values = new Map()
  const writes = []
  const localStorage = {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => { writes.push({ key, value }); values.set(key, value) },
  }
  const calls = { saves: [], indexes: [], reloads: [], updatesAfterUnmount: 0 }
  const bridge = {
    googlePlannerWrite: async () => ({ id: 'provider-event', etag: 'etag' }),
    googleCalendarCreateTask: async () => ({ id: 'provider-task' }),
    vaultReadNote: async () => ({ markdown: '- [ ] Task\n', metadata: { content_hash: 'hash', vault_id: 'vault' } }),
    vaultSaveNote: async (...args) => { calls.saves.push(args) },
    indexerSyncNoteTasks: async path => { calls.indexes.push(path) },
  }
  const loadModule = (source, require) => {
    const module = { exports: {} }
    vm.runInNewContext(source, { module, exports: module.exports, require, localStorage, TextEncoder, crypto: { randomUUID: () => '11111111-1111-4111-8111-111111111111' } })
    return module.exports
  }
  const planner = loadModule(plannerSource, () => ({}))
  const ownership = loadModule(ownershipSource, () => planner)
  const nodes = tree => {
    if (Array.isArray(tree)) return tree.flatMap(nodes)
    if (!tree || typeof tree !== 'object') return []
    return [tree, ...nodes(tree.props?.children)]
  }
  const text = node => Array.isArray(node) ? node.map(text).join('') : node && typeof node === 'object' ? text(node.props?.children) : node ?? ''
  const mount = (overrides = {}) => {
    const slots = []
    const effects = []
    let cursor = 0
    let mounted = true
    const react = {
      useState(initial) {
        const index = cursor++
        if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial
        return [slots[index], next => {
          if (!mounted) calls.updatesAfterUnmount++
          slots[index] = typeof next === 'function' ? next(slots[index]) : next
        }]
      },
      useRef(initial) { return slots[cursor++] ??= { current: initial } },
      useMemo: callback => callback(),
      useEffect(callback) { const index = cursor++; if (!(index in slots)) { slots[index] = {}; effects.push(() => { slots[index].cleanup = callback() }) } },
    }
    const jsx = (type, props) => ({ type, props })
    const component = loadModule(componentSource, id => {
      if (id === 'react') return react
      if (id === 'react/jsx-runtime') return { jsx, jsxs: jsx, Fragment: 'fragment' }
      if (id.includes('plannerGoogleOwnership')) return ownership
      if (id.includes('/planner')) return planner
      if (id.includes('/date')) return { formatLocalDate: () => '2026-10-09' }
      if (id.includes('/i18n')) return { useI18n: () => ({ locale: 'en' }) }
      return bridge
    })
    const options = { vaultId: 'vault', googleAccount: 'first@example.com', calendarId: 'primary', taskListId: '@default', tasks: [], events: [], remoteTasks: [], connected: true, calendarWritable: true, onReload: () => { calls.reloads.push(options.googleAccount) }, onOpenNote() {}, ...overrides }
    let tree
    const render = () => {
      cursor = 0; tree = component.PlannerWorkspace(options)
      while (effects.length) effects.shift()()
      return tree
    }
    render()
    return {
      options, render,
      button: label => nodes(tree).find(node => node.type === 'button' && text(node) === label),
      element: (type, predicate = () => true) => nodes(tree).find(node => node.type === type && predicate(node.props)),
      unmount: () => { for (const slot of slots) slot?.cleanup?.(); mounted = false },
    }
  }
  return { values, writes, calls, bridge, ownership, mount }
}

test('a completed event write from an unmounted account cannot replace another account’s new local schedule', async () => {
  const h = harness()
  const storageKey = 'scriptor:planner:v1:vault'
  const block = { taskId: 'old-task', title: 'Old block', start: '2026-10-09T09:00:00Z', end: '2026-10-09T10:00:00Z' }
  h.values.set(storageKey, h.ownership.serializeGoogleOwnedPlannerBlocks([block], { account: 'first@example.com', calendarId: 'primary' }))
  const pending = deferred()
  h.bridge.googlePlannerWrite = () => pending.promise
  const old = h.mount()
  old.button('Review bidirectional sync').props.onClick(); old.render()
  old.button('Use vault → Google').props.onClick()
  await flush()
  old.unmount()
  const replacement = h.mount({ googleAccount: 'second@example.com', tasks: [{ id: 'new-task', title: 'New account schedule', status: 'open', dueAt: null }] })
  replacement.element('select').props.onChange({ target: { value: 'new-task' } }); replacement.render()
  replacement.element('form').props.onSubmit({ preventDefault() {} }); replacement.render()
  const saved = h.values.get(storageKey)
  assert.match(saved, /second@example.com/)
  assert.match(saved, /New account schedule/)
  const writesBeforeCompletion = h.writes.length
  pending.resolve({ id: 'late-old-event', etag: 'old-etag' })
  await flush()
  assert.equal(h.values.get(storageKey), saved)
  assert.equal(h.writes.length, writesBeforeCompletion)
  assert.equal(h.calls.reloads.length, 0)
  assert.equal(h.calls.updatesAfterUnmount, 0)
})

test('a delayed source-note read cannot write or index after the planner unmounts', async () => {
  const h = harness()
  const pending = deferred()
  h.bridge.vaultReadNote = () => pending.promise
  const task = { id: 'task', title: 'Task', status: 'open', dueAt: null, line: 0, sourceNotePath: 'Task.md' }
  const remote = { id: 'remote-task', title: 'Updated task', status: 'completed', due: null, notes: 'Scriptor source: vault:vault:task', etag: 'etag' }
  const old = h.mount({ tasks: [task], remoteTasks: [remote] })
  old.button('Review bidirectional sync').props.onClick(); old.render()
  old.button('Use Google → vault').props.onClick()
  await flush()
  old.unmount()
  pending.resolve({ markdown: '- [ ] Task\n', metadata: { content_hash: 'hash', vault_id: 'vault' } })
  await flush()
  assert.equal(h.calls.saves.length, 0)
  assert.equal(h.calls.indexes.length, 0)
  assert.equal(h.calls.reloads.length, 0)
  assert.equal(h.calls.updatesAfterUnmount, 0)
})

test('a note save already submitted before unmount does not index the replacement vault or update stale UI', async () => {
  const h = harness()
  const pending = deferred()
  h.bridge.vaultSaveNote = (...args) => { h.calls.saves.push(args); return pending.promise }
  const task = { id: 'task', title: 'Task', status: 'open', dueAt: null, line: 0, sourceNotePath: 'Task.md' }
  const old = h.mount({ tasks: [task], remoteTasks: [{ id: 'remote', title: 'Updated task', status: 'completed', due: null, notes: 'Scriptor source: vault:vault:task' }] })
  old.button('Review bidirectional sync').props.onClick(); old.render()
  old.button('Use Google → vault').props.onClick()
  await flush()
  assert.equal(h.calls.saves.length, 1)
  old.unmount(); pending.resolve()
  await flush()
  assert.equal(h.calls.indexes.length, 0)
  assert.equal(h.calls.reloads.length, 0)
  assert.equal(h.calls.updatesAfterUnmount, 0)
})
