import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

import type { CanvasBlock, CanvasDocument } from '@scriptor/core/contracts/canvas'

import { CanvasCrdtSync, mergeCrdtOps, type CanvasCrdtOp } from './crdt-sync.ts'
import { runCanvasValidationTests } from './index.ts'

function loadFixture(name: string): CanvasDocument {
  const root = join(dirname(fileURLToPath(import.meta.url)), '../../test-fixtures/canvas')
  const raw = readFileSync(join(root, name), 'utf8')
  return JSON.parse(raw) as CanvasDocument
}

const failures = runCanvasValidationTests(loadFixture)
if (failures.length > 0) {
  console.error('Canvas validation failed:')
  for (const failure of failures) {
    console.error(`- ${failure}`)
  }
  process.exit(1)
}

// --- CRDT regression tests -------------------------------------------------

function block(id: string, contentRef: string, zIndex = 1): CanvasBlock {
  return {
    id,
    kind: 'sticky-note',
    layerId: 'layer-main',
    bounds: { x: 0, y: 0, width: 10, height: 10 },
    zIndex,
    contentRef,
  }
}

function op(
  id: string,
  peerId: string,
  timestamp: string,
  blocks: CanvasBlock[],
  deletedBlockIds: string[] = [],
): CanvasCrdtOp {
  return { id, peerId, documentId: 'doc-1', timestamp, blocks, deletedBlockIds }
}

interface FakeStorage {
  setItem(key: string, value: string): void
  getItem(key: string): string | null
  removeItem(key: string): void
  failWrites: boolean
}

function installFakeWindow(): { storage: FakeStorage; restore: () => void } {
  const values = new Map<string, string>()
  const storage: FakeStorage = {
    failWrites: false,
    setItem(key, value) {
      if (storage.failWrites) {
        const error = new Error('The quota has been exceeded.')
        error.name = 'QuotaExceededError'
        throw error
      }
      values.set(key, value)
    },
    getItem(key) {
      return values.get(key) ?? null
    },
    removeItem(key) {
      values.delete(key)
    },
  }
  const scope = globalThis as Record<string, unknown>
  const previous = scope.window
  scope.window = {
    localStorage: storage,
    addEventListener() {},
    removeEventListener() {},
  }
  return {
    storage,
    restore() {
      if (previous === undefined) {
        delete scope.window
      } else {
        scope.window = previous
      }
    },
  }
}

function emptyDocument(blocks: CanvasBlock[]): CanvasDocument {
  return {
    id: 'doc-1',
    vaultId: 'vault',
    title: 'Board',
    mode: 'edgeless',
    layers: [{ id: 'layer-main', name: 'Main', visible: true, locked: false, order: 0 }],
    blocks,
    updatedAt: '2026-01-01T00:00:00.000Z',
  }
}

test('crdt merge converges regardless of op application order', () => {
  const sameMs = '2026-01-01T00:00:00.000Z'
  const ops: CanvasCrdtOp[] = [
    op('op-1', 'peer-a', '2026-01-01T00:00:00.000Z', [block('b1', 'a-first'), block('b2', 'keep', 3)]),
    op('op-2', 'peer-b', sameMs, [block('b1', 'b-first')]),
    op('op-3', 'peer-a', sameMs, [block('b3', 'third', 2)]),
    op('op-4', 'peer-c', '2026-01-01T00:00:01.000Z', [], ['b2']),
    op('op-5', 'peer-a', '2026-01-01T00:00:00.500Z', [block('b2', 'stale', 3)]),
  ]

  const orderA = mergeCrdtOps(ops)
  const orderB = mergeCrdtOps([ops[4]!, ops[1]!, ops[3]!, ops[0]!, ops[2]!])
  const orderC = mergeCrdtOps([ops[2]!, ops[3]!, ops[4]!, ops[0]!, ops[1]!])

  assert.deepEqual(orderA, orderB, 'replicas must converge on identical state')
  assert.deepEqual(orderA, orderC, 'replicas must converge on identical state')
  assert.deepEqual(
    orderA.map((entry) => entry.id),
    ['b1', 'b3'],
    'tombstoned block must not survive the merge',
  )
})

test('crdt breaks same-millisecond conflicts deterministically', () => {
  const sameMs = '2026-05-05T12:00:00.000Z'
  const fromA = op('op-a', 'peer-a', sameMs, [block('b1', 'from-a')])
  const fromB = op('op-b', 'peer-b', sameMs, [block('b1', 'from-b')])

  const forward = mergeCrdtOps([fromA, fromB])
  const reversed = mergeCrdtOps([fromB, fromA])

  assert.equal(forward[0]?.contentRef, 'from-b')
  assert.deepEqual(forward, reversed)

  // Identical peer + timestamp falls through to the peer's own sequence number,
  // so a peer's later write never loses to its own earlier one.
  const first = { ...op('op-z', 'peer-a', sameMs, [block('b1', 'one')]), seq: 1 }
  const second = { ...op('op-a', 'peer-a', sameMs, [block('b1', 'two')]), seq: 2 }
  assert.equal(mergeCrdtOps([first, second])[0]?.contentRef, 'two')
  assert.equal(mergeCrdtOps([second, first])[0]?.contentRef, 'two')
})

test('crdt tombstones suppress older writes and lose to newer re-adds', () => {
  const create = op('op-1', 'peer-a', '2026-01-01T00:00:00.000Z', [block('b1', 'v1')])
  const remove = op('op-2', 'peer-b', '2026-01-01T00:00:01.000Z', [], ['b1'])
  const readd = op('op-3', 'peer-a', '2026-01-01T00:00:02.000Z', [block('b1', 'v2')])

  assert.equal(mergeCrdtOps([create, remove]).length, 0, 'delete must not resurrect from an older op')
  assert.equal(mergeCrdtOps([remove, create]).length, 0)
  assert.equal(mergeCrdtOps([create, remove, readd])[0]?.contentRef, 'v2')
  assert.equal(mergeCrdtOps([readd, remove, create])[0]?.contentRef, 'v2')
})

test('crdt snapshot emits tombstones for locally removed blocks', () => {
  const fake = installFakeWindow()
  try {
    const sync = new CanvasCrdtSync(true, 'doc-1', 'peer-a')
    sync.snapshot(emptyDocument([block('b1', 'one'), block('b2', 'two', 2)]))
    const after = sync.snapshot(emptyDocument([block('b1', 'one')]))
    assert.deepEqual(
      after.blocks.map((entry) => entry.id),
      ['b1'],
      'removing a block locally must propagate as a delete',
    )
  } finally {
    fake.restore()
  }
})

test('crdt opCount reflects the truncated op log', () => {
  const fake = installFakeWindow()
  try {
    const sync = new CanvasCrdtSync(true, 'doc-1', 'peer-a')
    for (let index = 0; index < 520; index += 1) {
      sync.snapshot(emptyDocument([block('b1', `v${index}`)]))
    }
    assert.equal(sync.getState().opCount, 500, 'opCount must not exceed the retained op window')
  } finally {
    fake.restore()
  }
})

test('crdt surfaces storage quota failures instead of throwing', () => {
  const fake = installFakeWindow()
  try {
    const sync = new CanvasCrdtSync(true, 'doc-1', 'peer-a')
    fake.storage.failWrites = true
    const result = sync.snapshot(emptyDocument([block('b1', 'one')]))
    assert.equal(result.blocks.length, 1)
    const state = sync.flush()
    assert.ok(state.lastError, 'quota failure must be surfaced through sync state')
    assert.match(state.lastError, /quota/i)
  } finally {
    fake.restore()
  }
})

test('crdt supports multiple independent subscribers', () => {
  const fake = installFakeWindow()
  try {
    const sync = new CanvasCrdtSync(true, 'doc-1', 'peer-a')
    const seen: string[] = []
    const disposeFirst = sync.subscribe(() => seen.push('first'))
    sync.subscribe(() => seen.push('second'))

    const notify = (sync as unknown as { onStorage: (event: { key: string }) => void }).onStorage
    notify({ key: 'scriptor.canvas.crdt.doc-1' })
    assert.deepEqual(seen, ['first', 'second'], 'a second subscriber must not evict the first')

    seen.length = 0
    disposeFirst()
    notify({ key: 'scriptor.canvas.crdt.doc-1' })
    assert.deepEqual(seen, ['second'], 'disposing one subscriber must not detach the others')
  } finally {
    fake.restore()
  }
})

test('crdt construction is safe without a window (SSR/worker)', () => {
  const scope = globalThis as Record<string, unknown>
  const previous = scope.window
  delete scope.window
  try {
    const sync = new CanvasCrdtSync(true, 'doc-ssr', 'peer-a')
    assert.equal(sync.getState().opCount, 0)
  } finally {
    if (previous !== undefined) scope.window = previous
  }
})
