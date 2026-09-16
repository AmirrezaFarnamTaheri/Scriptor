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
  snapshot() {
    return this.generation
  }
  issue() {
    return ++this.generation
  }
  isCurrent(expected) {
    return this.generation === expected
  }
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
  dispose() {}
  subscribe() {
    return () => {}
  }
  markLocalEdit() {
    this.localEdited = true
  }
  snapshot(doc) {
    return { ...doc, crdtSnapshot: true }
  }
  flush() {
    this.flushed = true
  }
}

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
          if (typeof next === 'function') {
            next(slots[i])
            slots[i] = next(slots[i])
          } else {
            slots[i] = next
          }
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

  const commands = {
    canvasListDocuments: async () => [],
    canvasLoadDocument: async (id) => savedDisks.get(id) ?? JSON.stringify({ id, title: id, layers: [], blocks: [] }),
    canvasSaveDocument: async (json, vaultId) => {
      saveCalls.push({ json, vaultId })
      const doc = JSON.parse(json)
      savedDisks.set(doc.id, json)
      return `vault://${vaultId}/canvas/${doc.id}.canvas`
    },
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

  return {
    render,
    unmount,
    saveCalls,
    savedDisks,
    timers,
    commands,
  }
}

test('adding a card followed by immediate flushPendingSave writes board to disk', async () => {
  const h = harness()
  const board = h.render()

  // Add a block to the board
  const updatedDoc = {
    ...board.document,
    blocks: [
      {
        id: 'block-1',
        layerId: 'layer-1',
        content: 'Card 1 content',
        x: 100,
        y: 100,
        width: 200,
        height: 150,
        zIndex: 1,
      },
    ],
  }

  board.updateDocument(() => updatedDoc)

  // A 400ms debounce timer is scheduled
  assert.equal(h.saveCalls.length, 0)
  assert.ok(h.timers.size > 0, 'Debounced timer scheduled')

  // User closes modal immediately, triggering flushPendingSave()
  await board.flushPendingSave()

  assert.equal(h.saveCalls.length, 1)
  const savedDoc = JSON.parse(h.saveCalls[0].json)
  assert.equal(savedDoc.blocks.length, 1)
  assert.equal(savedDoc.blocks[0].content, 'Card 1 content')
})

test('component unmount flushes pending dirty canvas edits synchronously to bridge', async () => {
  const h = harness()
  const board = h.render()

  // Mutate board
  const updatedDoc = {
    ...board.document,
    title: 'Updated Board Title',
    blocks: [{ id: 'b1', content: 'Unmounted save test', zIndex: 0 }],
  }
  board.updateDocument(() => updatedDoc)

  assert.equal(h.saveCalls.length, 0)

  // Unmount component without explicit flush
  h.unmount()

  // Unmount cleanup must have triggered save
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

  assert.equal(h.saveCalls.length, 1)
  const saved = JSON.parse(h.saveCalls[0].json)
  assert.equal(saved.crdtSnapshot, true)
})
