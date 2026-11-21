import assert from 'node:assert/strict'
import test from 'node:test'
import { RecoverableCanonicalProjection, type CanonicalProjectionSource } from './liveCollaborationProjection.ts'

const hash = (n: number) => String(n).repeat(64)

function fixture(initial = 'initial') {
  let text = initial
  const observers = new Set<(markdown: string) => void>()
  const source: CanonicalProjectionSource & { change(markdown: string): void } = {
    get value() { return text },
    subscribe(listener: (markdown: string) => void) {
      observers.add(listener)
      return () => observers.delete(listener)
    },
    change(markdown: string) { text = markdown; for (const listener of observers) listener(markdown) },
  }
  let disk = initial
  let diskHash = hash(1)
  const writes: Array<[string, string]> = []
  let ambiguity = false
  let collision = false
  const errors: string[] = []
  const updates: string[] = []
  const controller = new RecoverableCanonicalProjection({
    source, scope: { vaultId: 'vault_A', notePath: 'notes/demo.md' },
    baseline: { markdown: initial, contentHash: hash(1) },
    updateDraft: markdown => { updates.push(markdown) },
    project: async (markdown, expected) => {
      writes.push([markdown, expected])
      if (expected !== diskHash && disk !== markdown) throw new Error('CAS conflict')
      if (expected === diskHash) {
        disk = markdown
        diskHash = hash(writes.length + 1)
      }
      if (ambiguity) { ambiguity = false; throw new Error('native reply lost') }
      return { metadata: { vault_id: 'vault_A', path: 'notes/demo.md', content_hash: collision ? expected : diskHash } }
    },
    onError: error => { errors.push(error.message) },
  })
  return {
    source, controller, writes, errors, updates,
    get disk() { return disk },
    setAmbiguity: () => { ambiguity = true },
    setCollision: () => { collision = true },
  }
}

test('automatic projection follows subscribed canonical text and updates the file baseline', async () => {
  const x = fixture()
  x.controller.start()
  x.source.change('saved')
  await x.controller.waitUntilProjected()
  assert.equal(x.disk, 'saved')
  assert.equal(x.controller.projectedHash, hash(2))
  assert.deepEqual(x.writes, [['saved', hash(1)]])
  assert.deepEqual(x.updates, ['saved'])
  assert.equal(x.controller.hasUnprojectedChanges, false)
  x.controller.dispose()
})

test('an ambiguous write retains exact text/hash and retries before a newer revision', async () => {
  const x = fixture()
  x.controller.start()
  x.setAmbiguity()
  x.source.change('first')
  await assert.rejects(x.controller.waitUntilProjected(), /native reply lost/)
  x.source.change('second')
  assert.equal(x.controller.blocked, true)
  assert.deepEqual(x.writes, [['first', hash(1)]])
  await x.controller.retry()
  assert.equal(x.disk, 'second')
  assert.deepEqual(x.writes, [
    ['first', hash(1)],
    ['first', hash(1)],
    ['second', hash(2)],
  ])
  assert.equal(x.controller.hasUnprojectedChanges, false)
  x.controller.dispose()
})

test('a non-authoritative receipt fails closed and keeps its retry bytes', async () => {
  const x = fixture()
  x.controller.start()
  x.setCollision()
  x.source.change('incomplete')
  await assert.rejects(x.controller.waitUntilProjected(), /not confirmed/)
  assert.equal(x.controller.blocked, true)
  assert.equal(x.controller.hasUnprojectedChanges, true)
  assert.equal(x.controller.projectedHash, hash(1))
  x.controller.dispose()
})

test('native projection only starts after explicit opt-in and never after dispose', async () => {
  const x = fixture()
  x.source.change('before')
  assert.deepEqual(x.writes, [])
  x.controller.start()
  await x.controller.waitUntilProjected()
  assert.equal(x.disk, 'before')
  x.controller.dispose()
  x.source.change('after')
  assert.equal(x.disk, 'before')
})

test('safe projection refuses a missing note scope or content revision', async () => {
  const f = fixture()
  assert.throws(() => new RecoverableCanonicalProjection({
    source: f.source,
    scope: { vaultId: 'vault_A', notePath: '' },
    baseline: { markdown: 'initial', contentHash: hash(1) },
    project: async () => null,
    updateDraft: () => {},
    onError: () => {},
  }), /verified vault note/)
  await assert.rejects(f.controller.waitUntilProjected(), /Projection is not active/)
})
