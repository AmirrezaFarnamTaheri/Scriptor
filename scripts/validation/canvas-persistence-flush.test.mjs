import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import vm from 'node:vm'
import ts from 'typescript'

const source = ts.transpileModule(
  readFileSync(new URL('../../src/hooks/useCanvasBoard.ts', import.meta.url), 'utf8'),
  {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  },
).outputText

class MockOperationGuard {
  constructor() {
    this.generation = 0
  }
  /** Captures the current operation generation. */
  snapshot() {
    return this.generation
  }
  /** Advances and returns the operation generation. */
  issue() {
    return ++this.generation
  }
  /** Reports whether a captured generation is still current. */
  isCurrent(expected) {
    return this.generation === expected
  }
  /** Invalidates every previously captured generation. */
  invalidate() {
    this.generation++
  }
}

class MockCanvasCrdtSync {
  constructor(enabled, docId) {
    this.enabled = enabled
    this.docId = docId
    this.flushed = false
    this.localEdited = false
  }
  /** Releases the mock CRDT session. */
  dispose() {}
  /** Registers a no-op remote-change listener and returns its cleanup. */
  subscribe() {
    return () => {}
  }
  /** Records that the board received a local edit. */
  markLocalEdit() {
    this.localEdited = true
  }
  /** Adds the synthetic CRDT payload used by the persistence assertions. */
  snapshot(doc) {
    return { ...doc, crdtSnapshot: true }
  }
  /** Records that pending mock CRDT changes were flushed. */
  flush() {
    this.flushed = true
  }
}

/** Creates a manually controlled promise for serialized-save race tests. */
function deferred() {
  let resolve
  let reject
  const promise = new Promise((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

/** Lets queued promise continuations settle without advancing mock timers. */
async function flushMicrotasks(turns = 8) {
  // Hook mount hydration crosses multiple nested async continuations
  // (board-list command -> refresh helper -> mount effect). Drain enough
  // microtask turns to make the harness deterministic before race assertions.
  for (let turn = 0; turn < turns; turn++) {
    await Promise.resolve()
  }
}

/** Builds an isolated hook harness with controllable persistence and timers. */
function harness(options = {}) {
  const slots = []
  let cursor = 0
  let effects = []
  let cleanupFns = []

  const react = {
    useState(initial) {
      const i = cursor++
      if (!(i in slots)) slots[i] = typeof initial === 'function' ? initial() : initial
      return [
        slots[i],
        (next) => {
          slots[i] = typeof next === 'function' ? next(slots[i]) : next
        },
      ]
    },
    useRef(initial) {
      const i = cursor++
      return (slots[i] ??= { current: initial })
    },
    useCallback: (fn) => fn,
    useMemo: (fn) => fn(),
    useEffect: (fn) => {
      effects.push(fn)
    },
  }

  let nextTimerId = 1
  const timers = new Map()
  const windowMock = {
    setTimeout: (fn, delay = 0) => {
      const id = nextTimerId++
      timers.set(id, { fn, delay })
      return id
    },
    clearTimeout: (id) => {
      timers.delete(id)
    },
  }

  const saveCalls = []
  const savedDisks = new Map()

  const defaultSave = async (json, vaultId) => {
    saveCalls.push({ json, vaultId })
    const doc = JSON.parse(json)
    savedDisks.set(doc.id, json)
    return `vault://${vaultId}/canvas/${doc.id}.canvas`
  }

  const commands = {
    canvasListDocuments: async () => [],
    canvasLoadDocument: async (id) => savedDisks.get(id) ?? JSON.stringify({ id, title: id, layers: [], blocks: [] }),
    canvasSaveDocument: defaultSave,
    canvasApplyTemplate: async (json) => ({ document: JSON.parse(json), blocksAdded: 0 }),
    canvasSnapshot: async () => ({ artifactPath: 'snap.png' }),
    ...options.commandOverrides,
  }

  const module = { exports: {} }
  vm.runInNewContext(source, {
    exports: module.exports,
    module,
    require: (id) => {
      if (id === 'react') return react
      if (id.endsWith('/commands')) return commands
      if (id.endsWith('/platform')) return { isNativeBridgeAvailable: () => true }
      if (id.endsWith('/operation-guard')) return { OperationGuard: MockOperationGuard }
      if (id.includes('@scriptor/canvas')) {
        return {
          blocksForTemplate: () => [],
          canvasTemplateCatalog: [],
          CanvasCrdtSync: MockCanvasCrdtSync,
          createEmptyDocument: (vaultId, title) => ({
            id: 'board-default',
            vaultId,
            title,
            layers: [{ id: 'layer-1', name: 'Default', visible: true, locked: false }],
            blocks: [],
          }),
        }
      }
      return {}
    },
    window: windowMock,
    console,
    structuredClone: globalThis.structuredClone ?? ((obj) => JSON.parse(JSON.stringify(obj))),
    JSON,
    Error,
  })

  const render = (vaultId = 'vault-test', vaultOpen = true, crdtEnabled = false) => {
    cursor = 0
    effects = []
    const result = module.exports.useCanvasBoard(vaultId, vaultOpen, crdtEnabled)
    effects.forEach((fn) => {
      const cleanup = fn()
      if (typeof cleanup === 'function') cleanupFns.push(cleanup)
    })
    return result
  }

  const unmount = () => {
    cleanupFns.forEach((fn) => fn())
    cleanupFns = []
  }

  const fireTimers = () => {
    const queued = [...timers.values()]
    timers.clear()
    for (const timer of queued) timer.fn()
  }

  return {
    render,
    unmount,
    saveCalls,
    savedDisks,
    // Positional hook slots: document is index 1, status is index 4.
    // Revisit these mappings if useCanvasBoard changes hook declaration order.
    currentDocument: () => slots[1],
    currentStatus: () => slots[4],
    timers,
    fireTimers,
    commands,
  }
}

test('adding a card followed by immediate flushPendingSave writes board to disk', async () => {
  const h = harness()
  const board = h.render()
  const updatedDoc = {
    ...board.document,
    blocks: [{ id: 'block-1', layerId: 'layer-1', content: 'Card 1 content', x: 100, y: 100, width: 200, height: 150, zIndex: 1 }],
  }

  board.updateDocument(() => updatedDoc)
  assert.equal(h.saveCalls.length, 0)
  assert.ok(h.timers.size > 0, 'Debounced timer scheduled')

  assert.equal(await board.flushPendingSave(), true)

  assert.equal(h.saveCalls.length, 1)
  const savedDoc = JSON.parse(h.saveCalls[0].json)
  assert.equal(savedDoc.blocks.length, 1)
  assert.equal(savedDoc.blocks[0].content, 'Card 1 content')
})

test('an already in-flight failure cannot make flush report success', async () => {
  let attempts = 0
  const h = harness({
    commandOverrides: {
      canvasSaveDocument: async () => {
        attempts++
        throw new Error('disk full')
      },
    },
  })
  const board = h.render()
  board.updateDocument((current) => ({ ...current, title: 'Dirty title' }))

  h.fireTimers() // move the payload from pending state into the serialized tail
  await flushMicrotasks()

  const saved = await board.flushPendingSave()
  assert.equal(saved, false)
  assert.equal(attempts, 2, 'explicit flush retries the newest failed full-document payload once')
})

test('unmount enqueues the newest pending save behind an in-flight write', async () => {
  const first = deferred()
  const calls = []
  let call = 0
  const h = harness({
    commandOverrides: {
      canvasSaveDocument: async (json) => {
        calls.push(JSON.parse(json).title)
        call++
        if (call === 1) return first.promise
        return 'vault://saved'
      },
    },
  })
  const board = h.render()

  board.updateDocument((current) => ({ ...current, title: 'Revision A' }))
  h.fireTimers()
  await flushMicrotasks()
  assert.deepEqual(calls, ['Revision A'])

  board.updateDocument((current) => ({ ...current, title: 'Revision B' }))
  h.unmount()
  await flushMicrotasks()
  assert.deepEqual(calls, ['Revision A'], 'teardown must not bypass the persistence tail')

  first.resolve('vault://first')
  await flushMicrotasks()
  await flushMicrotasks()
  assert.deepEqual(calls, ['Revision A', 'Revision B'])
})

test('component unmount flushes pending dirty canvas edits through the queue', async () => {
  const h = harness()
  const board = h.render()
  const updatedDoc = {
    ...board.document,
    title: 'Updated Board Title',
    blocks: [{ id: 'b1', content: 'Unmounted save test', zIndex: 0 }],
  }
  board.updateDocument(() => updatedDoc)

  assert.equal(h.saveCalls.length, 0)
  h.unmount()
  await flushMicrotasks()

  assert.equal(h.saveCalls.length, 1)
  const savedDoc = JSON.parse(h.saveCalls[0].json)
  assert.equal(savedDoc.title, 'Updated Board Title')
  assert.equal(savedDoc.blocks[0].content, 'Unmounted save test')
})

test('CRDT edits mark local edit, flush CRDT, and save on unmount', async () => {
  const h = harness()
  const board = h.render('vault-test', true, true)

  const updatedDoc = {
    ...board.document,
    blocks: [{ id: 'crdt-1', content: 'CRDT content', zIndex: 0 }],
  }
  board.updateDocument(() => updatedDoc)

  h.unmount()
  await flushMicrotasks()

  assert.equal(h.saveCalls.length, 1)
  const saved = JSON.parse(h.saveCalls[0].json)
  assert.equal(saved.crdtSnapshot, true)
})


test('late native template response cannot overwrite an edit made after submission', async () => {
  const template = deferred()
  const h = harness({
    commandOverrides: {
      canvasApplyTemplate: async () => template.promise,
    },
  })
  const board = h.render()
  const applying = board.applyTemplate('native-template')
  board.updateDocument((current) => ({ ...current, title: 'Local edit after request' }))

  template.resolve({ document: { ...board.document, title: 'Template result' }, blocksAdded: 1 })
  await applying

  assert.equal(await board.flushPendingSave(), true)
  assert.equal(JSON.parse(h.saveCalls.at(-1).json).title, 'Local edit after request')
})

test('vault lifecycle change invalidates an outstanding native template response', async () => {
  const template = deferred()
  const h = harness({
    commandOverrides: {
      canvasApplyTemplate: async () => template.promise,
    },
  })
  const board = h.render('vault-a')
  const applying = board.applyTemplate('native-template')

  h.render('vault-b')
  template.resolve({ document: { ...board.document, title: 'Wrong vault result' }, blocksAdded: 1 })
  await applying
  h.fireTimers()
  await flushMicrotasks()

  assert.equal(h.saveCalls.length, 0)
})

test('newer native template request supersedes an older response', async () => {
  const first = deferred()
  const second = deferred()
  let call = 0
  const h = harness({
    commandOverrides: {
      canvasApplyTemplate: async () => (++call === 1 ? first.promise : second.promise),
    },
  })
  const board = h.render()
  // Let the mount-time board-list hydration settle before exercising request
  // supersession; otherwise the harness can invalidate both requests for an
  // unrelated lifecycle transition that a user cannot race in the mounted UI.
  await flushMicrotasks()
  const firstApply = board.applyTemplate('first-template')
  const secondApply = board.applyTemplate('second-template')

  second.resolve({ document: { ...board.document, title: 'Second wins' }, blocksAdded: 2 })
  await secondApply
  first.resolve({ document: { ...board.document, title: 'First is stale' }, blocksAdded: 1 })
  await firstApply

  assert.equal(await board.flushPendingSave(), true)
  assert.equal(JSON.parse(h.saveCalls.at(-1).json).title, 'Second wins')
})

test('unmount rejects a late native template response without scheduling persistence', async () => {
  const template = deferred()
  const h = harness({
    commandOverrides: {
      canvasApplyTemplate: async () => template.promise,
    },
  })
  const board = h.render()
  const applying = board.applyTemplate('native-template')

  h.unmount()
  template.resolve({ document: { ...board.document, title: 'Unmounted result' }, blocksAdded: 1 })
  await applying
  h.fireTimers()
  await flushMicrotasks()

  assert.equal(h.saveCalls.length, 0)
})

test('a committed canvas write remains successful when the board list refresh fails', async () => {
  let failList = false
  const h = harness({
    commandOverrides: {
      canvasListDocuments: async () => {
        if (failList) throw new Error('board list temporarily unavailable')
        return []
      },
    },
  })
  const board = h.render()
  await flushMicrotasks()
  board.updateDocument((current) => ({ ...current, title: 'Saved revision' }))
  failList = true
  assert.equal(await board.flushPendingSave(), true, 'a successful native save must not be retried as a failure')
  assert.equal(h.saveCalls.length, 1)
  assert.match(h.currentStatus(), /saved/i)
  assert.doesNotMatch(h.currentStatus(), /vault:\/\/|[a-f0-9]{8}-[a-f0-9]{4}-/)
})

test('failed board creation keeps the previous document selected and editable', async () => {
  const h = harness({
    commandOverrides: { canvasSaveDocument: async () => { throw new Error('disk full') } },
  })
  const board = h.render()
  await flushMicrotasks()
  const originalTitle = board.document.title
  await board.createBoard('Unsaved board')
  assert.equal(h.currentDocument().title, originalTitle)
  assert.match(h.currentStatus(), /disk full/)
})

test('a late successful board creation cannot replace intervening local edits', async () => {
  const save = deferred()
  const started = deferred()
  const h = harness({
    commandOverrides: {
      canvasSaveDocument: async () => {
        started.resolve()
        return save.promise
      },
    },
  })
  const board = h.render()
  await flushMicrotasks()
  const creating = board.createBoard('New board')
  await started.promise
  assert.equal(h.currentDocument().title, 'Research board', 'pending creation must not replace the active board')
  board.updateDocument((current) => ({ ...current, title: 'Edited while creating' }))
  save.resolve('vault://saved/new-board')
  await creating
  assert.equal(h.currentDocument().title, 'Edited while creating')
})

test('a late initial board load must not discard an edit made while loading', async () => {
  const started = deferred()
  const loading = deferred()
  const h = harness({
    commandOverrides: {
      canvasListDocuments: async () => [{ id: 'saved-board' }],
      canvasLoadDocument: async () => {
        started.resolve()
        return loading.promise
      },
    },
  })
  const board = h.render()
  await started.promise
  board.updateDocument((current) => ({ ...current, title: 'Local typing while board loads' }))
  loading.resolve(JSON.stringify({ id: 'saved-board', title: 'Stale loaded board', layers: [], blocks: [] }))
  await flushMicrotasks()
  assert.equal(h.currentDocument().title, 'Local typing while board loads')
})

test('a board switch must not discard an edit made while its target is loading', async () => {
  const started = deferred()
  const loading = deferred()
  const h = harness({
    commandOverrides: {
      canvasLoadDocument: async () => {
        started.resolve()
        return loading.promise
      },
    },
  })
  const board = h.render()
  await flushMicrotasks()
  const switching = board.switchBoard('saved-board')
  await started.promise
  board.updateDocument((current) => ({ ...current, title: 'Changed before load completed' }))
  loading.resolve(JSON.stringify({ id: 'saved-board', title: 'Stale target board', layers: [], blocks: [] }))
  await switching
  assert.equal(h.currentDocument().title, 'Changed before load completed')
})

test('board creation paused on a previous save cannot cross a vault lifecycle change', async () => {
  const writing = deferred()
  const started = deferred()
  const saveCalls = []
  const h = harness({
    commandOverrides: {
      canvasSaveDocument: async (json, vault) => {
        saveCalls.push({ json, vault })
        started.resolve()
        return writing.promise
      },
    },
  })
  const board = h.render('old-vault')
  await flushMicrotasks()
  board.updateDocument((current) => ({ ...current, title: 'Unsaved older vault' }))
  h.fireTimers()
  await started.promise
  const creating = board.createBoard('Should not be created in the wrong vault')
  h.render('new-vault')
  writing.resolve('vault://old-vault/canvas/old-board')
  await creating
  assert.equal(saveCalls.length, 1, 'creation should not write another board after vault switch')
})

test('an edit before initial board-list hydration resolves prevents late board installation', async () => {
  const list = deferred()
  let loadCalls = 0
  const h = harness({
    commandOverrides: {
      canvasListDocuments: async () => list.promise,
      canvasLoadDocument: async () => {
        loadCalls++
        return JSON.stringify({ id: 'saved-board', title: 'Unwanted board', layers: [], blocks: [] })
      },
    },
  })
  const board = h.render()
  board.updateDocument((current) => ({ ...current, title: 'Started writing' }))
  list.resolve([{ id: 'saved-board' }])
  await flushMicrotasks()
  assert.equal(loadCalls, 0)
  assert.equal(h.currentDocument().title, 'Started writing')
})

test('a failed initial list read does not reset an edit made while waiting', async () => {
  const list = deferred()
  const h = harness({ commandOverrides: { canvasListDocuments: async () => list.promise } })
  const board = h.render()
  board.updateDocument((current) => ({ ...current, title: 'Retain edit on load failure' }))
  list.reject(new Error('temporarily inaccessible'))
  await flushMicrotasks()
  assert.equal(h.currentDocument().title, 'Retain edit on load failure')
})

test('a board switch awaiting a save cannot load into a different vault', async () => {
  const writing = deferred()
  const started = deferred()
  let loadCalls = 0
  const h = harness({
    commandOverrides: {
      canvasSaveDocument: async () => {
        started.resolve()
        return writing.promise
      },
      canvasLoadDocument: async () => {
        loadCalls++
        return JSON.stringify({ id: 'old-board', title: 'Wrong vault', layers: [], blocks: [] })
      },
    },
  })
  const board = h.render('old-vault')
  await flushMicrotasks()
  board.updateDocument((current) => ({ ...current, title: 'Unsaved old data' }))
  h.fireTimers()
  await started.promise
  const switching = board.switchBoard('old-board')
  h.render('new-vault')
  writing.resolve('vault://old-vault/canvas/old-board')
  await switching
  assert.equal(loadCalls, 0, 'old-vault switch cannot load after a vault change')
})

test('concurrent new-board requests do not duplicate the native creation write', async () => {
  const writing = deferred()
  const started = deferred()
  let saves = 0
  const h = harness({
    commandOverrides: {
      canvasSaveDocument: async () => {
        saves++
        started.resolve()
        return writing.promise
      },
    },
  })
  const board = h.render()
  await flushMicrotasks()
  const first = board.createBoard('Only once')
  await started.promise
  await board.createBoard('Unexpected second board')
  writing.resolve('vault://saved/new-board')
  await first
  assert.equal(saves, 1)
  assert.equal(h.currentDocument().title, 'Only once')
})
