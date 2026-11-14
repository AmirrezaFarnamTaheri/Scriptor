import assert from 'node:assert/strict'
import test from 'node:test'
import { CollaborativeMarkdown } from './liveCollaborationYjs.ts'

const scope = (peerId: string) => ({
  vaultId: `local_${peerId}`,
  roomId: 'room_alpha',
  documentId: 'doc_beta',
  epoch: 1,
  peerId,
})
const sender = (peerId: string) => ({ roomId: 'room_alpha', documentId: 'doc_beta', epoch: 1, peerId })
const seed = (markdown = 'Hello') => {
  const owner = new CollaborativeMarkdown(scope('alice'))
  const updates = owner.initializeOwner(markdown)
  return { owner, updates }
}
const join = (peerId: string, updates: Uint8Array[]) => {
  const replica = new CollaborativeMarkdown(scope(peerId))
  replica.hydrate(updates)
  return replica
}

test('owner creates a bounded bootstrap and a joining peer reproduces the original Markdown', () => {
  const { owner, updates } = seed('Hello, collaboration!')
  assert.ok(owner.ready)
  assert.ok(updates.length > 0)
  assert.ok(updates.every(update => update.byteLength > 0 && update.byteLength <= 256 * 1024))
  const bob = join('bob', updates)
  assert.equal(bob.value, owner.value)
  assert.equal(bob.value, 'Hello, collaboration!')
  bob.close()
  owner.close()
})

test('three independent authors converge through reordered and duplicated causal Yjs updates', () => {
  const { owner, updates } = seed('start')
  const bob = join('bob', updates)
  const carol = join('carol', updates)
  const a = owner.change(5, 5, ' A')
  const b = bob.change(5, 5, ' B')
  const c = carol.change(5, 5, ' C')
  for (const [replica, incoming] of [
    [owner, [[c, sender('carol')], [b, sender('bob')], [c, sender('carol')]]],
    [bob, [[a, sender('alice')], [c, sender('carol')], [a, sender('alice')]]],
    [carol, [[b, sender('bob')], [a, sender('alice')], [b, sender('bob')]]],
  ] as const) for (const [update, identity] of incoming) replica.applyRemote(update, identity)
  assert.equal(owner.value, bob.value)
  assert.equal(bob.value, carol.value)
  assert.match(owner.value, / A/)
  assert.match(owner.value, / B/)
  assert.match(owner.value, / C/)
  owner.close(); bob.close(); carol.close()
})

test('Yjs state vectors exchange only missing state across a reconnect', () => {
  const { owner, updates } = seed('first')
  const bob = join('bob', updates)
  owner.change(5, 5, ' second')
  const patch = owner.diff(bob.stateVector())
  bob.applyRemote(patch, sender('alice'))
  assert.equal(bob.value, owner.value)
  const reverse = bob.diff(owner.stateVector())
  owner.applyRemote(reverse, sender('bob'))
  assert.equal(bob.value, owner.value)
})

test('local undo does not revert a remote author edit', () => {
  const { owner, updates } = seed('base')
  const bob = join('bob', updates)
  const aliceEdit = owner.change(4, 4, ' local')
  const bobEdit = bob.change(4, 4, ' remote')
  owner.applyRemote(bobEdit, sender('bob'))
  bob.applyRemote(aliceEdit, sender('alice'))
  const undoUpdate = owner.undo()
  assert.ok(undoUpdate && undoUpdate.byteLength > 0)
  bob.applyRemote(undoUpdate, sender('alice'))
  assert.equal(owner.value, bob.value)
  assert.match(bob.value, /remote/)
  assert.doesNotMatch(bob.value, /local/)
  const redoUpdate = owner.redo()
  assert.ok(redoUpdate && redoUpdate.byteLength > 0)
  bob.applyRemote(redoUpdate, sender('alice'))
  assert.equal(owner.value, bob.value)
  assert.match(bob.value, /local/)
})

test('Persian RTL, emoji, combining marks and UTF-16 cursor offsets survive concurrent changes', () => {
  const base = 'سلام \u{1F469}\u{1F3FD}\u200D\u{1F4BB} e\u0301'
  const { owner, updates } = seed(base)
  const bob = join('bob', updates)
  const from = base.indexOf('e')
  const a = owner.change(from, from + 2, 'é')
  const b = bob.change(0, 0, 'آغاز ')
  owner.applyRemote(b, sender('bob'))
  bob.applyRemote(a, sender('alice'))
  assert.equal(owner.value, bob.value)
  assert.match(owner.value, /سلام/)
  assert.ok(owner.value.includes('\u{1F469}\u{1F3FD}\u200D\u{1F4BB}'))
  assert.match(owner.value, /é/)
})

test('foreign room, document and epoch updates are rejected without changing this replica', () => {
  const { owner, updates } = seed('safe')
  const bob = join('bob', updates)
  const change = owner.change(4, 4, '!')
  for (const wrong of [
    { ...sender('alice'), roomId: 'other_room' },
    { ...sender('alice'), documentId: 'other_doc' },
    { ...sender('alice'), epoch: 2 },
  ]) {
    assert.throws(() => bob.applyRemote(change, wrong), /scope|room|epoch|document/i)
    assert.equal(bob.value, 'safe')
  }
})

test('malformed, empty and overbudget remote updates cannot corrupt accepted content', () => {
  const { owner, updates } = seed('safe')
  const bob = join('bob', updates)
  for (const bad of [new Uint8Array(0), new Uint8Array([255, 255]), new Uint8Array(256 * 1024 + 1)]) {
    assert.throws(() => bob.applyRemote(bad, sender('alice')))
    assert.equal(bob.value, 'safe')
  }
})

test('initial Markdown up to 2 MiB is emitted as bounded CRDT updates, never one oversized frame', () => {
  const original = 'a'.repeat(700_000)
  const { owner, updates } = seed(original)
  assert.ok(updates.length > 1)
  assert.ok(updates.every(update => update.byteLength <= 256 * 1024))
  assert.equal(join('bob', updates).value, original)
})

test('editing is forbidden before authenticated seed hydration and after disposal', () => {
  const bob = new CollaborativeMarkdown(scope('bob'))
  assert.equal(bob.ready, false)
  assert.throws(() => bob.change(0, 0, 'forged'), /seed|initialized|ready/i)
  const { owner, updates } = seed('test')
  bob.hydrate(updates)
  bob.close()
  assert.throws(() => bob.change(0, 0, 'late'), /closed|disposed/i)
  assert.throws(() => owner.change(-1, 99, 'out of bounds'), /range|bounds|invalid/i)
  assert.equal(owner.value, 'test')
})


test('staging a text edit is invisible until committed and remains in per-author undo', () => {
  const { owner, updates } = seed('original')
  const bob = join('bob', updates)
  const stage = owner.prepareChange(8, 8, ' saved')
  assert.ok(stage)
  assert.equal(owner.value, 'original')
  assert.equal(bob.value, 'original')
  owner.commitPrepared(stage)
  bob.applyRemote(stage.update, sender('alice'))
  assert.equal(owner.value, 'original saved')
  assert.equal(bob.value, 'original saved')
  assert.ok(owner.undo(), 'staged edit must be in the local author undo manager')
  assert.equal(owner.value, 'original')
  owner.close()
  bob.close()
})

test('staged and remote updates merge without silently losing a new author edit', () => {
  const { owner, updates } = seed('baseline')
  const bob = join('bob', updates)
  const stage = owner.prepareChange(8, 8, ' Alice')
  assert.ok(stage)
  const remote = bob.change(8, 8, ' Bob')
  owner.applyRemote(remote, sender('bob'))
  owner.commitPrepared(stage)
  bob.applyRemote(stage.update, sender('alice'))
  assert.equal(owner.value, bob.value)
  assert.ok(owner.value.includes(' Alice'))
  assert.ok(owner.value.includes(' Bob'))
  assert.throws(() => owner.commitPrepared(stage), /prepared|identity|payload/i)
})

test('forged or modified prepared payloads cannot be committed', () => {
  const { owner } = seed('safe')
  const stage = owner.prepareChange(4, 4, ' protected')
  assert.ok(stage)
  stage.update[0] ^= 0xff
  assert.throws(() => owner.commitPrepared(stage), /prepared|identity|payload/i)
  assert.equal(owner.value, 'safe')
})
