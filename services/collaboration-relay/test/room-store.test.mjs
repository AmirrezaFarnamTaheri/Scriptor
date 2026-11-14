import assert from 'node:assert/strict'
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { RelayRoomStore } from '../src/room-store.mjs'

const identity = { roomId: 'room_01', documentId: 'document_01', epoch: 1 }
function update(peerId, clientSeq, vaultId = 'vault_a', payload = 'YQ==') {
  return { version: 1, kind: 'LOCAL_UPDATE', ...identity, vaultId, peerId,
    clientSeq, messageId: `msg_${peerId}_${clientSeq}`, payload }
}
function withStore(run) {
  const dir = mkdtempSync(join(tmpdir(), 'scriptor-relay-'))
  try { return run(dir) } finally { rmSync(dir, { recursive: true, force: true }) }
}
function create(store, seed = update('alice', 1)) {
  return store.createRoom({ ...identity, ownerPeerId: 'alice', initialUpdate: seed })
}
function read(store, peerId, afterCursor = 0) {
  return store.read({ ...identity, authenticatedPeerId: peerId, afterCursor })
}
function append(store, peerId, change = update(peerId, 1)) {
  return store.append({ ...identity, authenticatedPeerId: peerId, update: change })
}

test('bootstrap is atomic and replay survives closing and reopening the WAL store', () => withStore(dir => {
  let store = new RelayRoomStore(dir)
  const seeded = create(store)
  assert.equal(seeded.cursor, 1)
  assert.equal(seeded.durable, true)
  assert.deepEqual(read(store, 'alice').updates.map(row => row.update.payload), ['YQ=='])
  store.close()
  store = new RelayRoomStore(dir)
  assert.deepEqual(read(store, 'alice').updates.map(row => row.update.messageId), ['msg_alice_1'])
  assert.equal(create(store).cursor, seeded.cursor)
  store.close()
}))

test('idempotent retry preserves the original durable cursor and refuses identity reuse', () => withStore(dir => {
  const store = new RelayRoomStore(dir)
  create(store)
  store.grant({ ...identity, actorPeerId: 'alice', targetPeerId: 'bob', role: 'editor' })
  const first = append(store, 'bob')
  const second = append(store, 'bob')
  assert.equal(first.durable, true)
  assert.deepEqual(second, { ...first, duplicate: true })
  assert.equal(read(store, 'bob').updates.length, 2)
  assert.throws(() => append(store, 'bob', { ...update('bob', 1), payload: 'Yg==' }), /identity|different|mismatch/i)
  assert.throws(() => append(store, 'bob', { ...update('bob', 1), messageId: 'different_msg' }), /sequence/i)
  store.close()
}))

test('viewer is read-only and a revoked peer loses both read and write access', () => withStore(dir => {
  const store = new RelayRoomStore(dir)
  create(store)
  store.grant({ ...identity, actorPeerId: 'alice', targetPeerId: 'bob', role: 'viewer' })
  assert.equal(read(store, 'bob').updates.length, 1)
  assert.throws(() => append(store, 'bob'), /permission|viewer|denied/i)
  store.grant({ ...identity, actorPeerId: 'alice', targetPeerId: 'bob', role: 'editor' })
  append(store, 'bob')
  store.grant({ ...identity, actorPeerId: 'alice', targetPeerId: 'bob', role: 'revoked' })
  assert.throws(() => append(store, 'bob', update('bob', 2)), /permission|revoked|denied/i)
  assert.throws(() => read(store, 'bob'), /permission|revoked|denied/i)
  store.close()
}))

test('unauthorized role changes and mismatched authenticated sender are refused', () => withStore(dir => {
  const store = new RelayRoomStore(dir)
  create(store)
  store.grant({ ...identity, actorPeerId: 'alice', targetPeerId: 'bob', role: 'editor' })
  assert.throws(() => store.grant({ ...identity, actorPeerId: 'bob', targetPeerId: 'eve', role: 'editor' }), /owner|permission/i)
  assert.throws(() => append(store, 'bob', update('alice', 3)), /scope|peer|mismatch/i)
  assert.throws(() => append(store, 'eve', update('eve', 1)), /permission|denied/i)
  store.close()
}))

test('scope and epochs are isolated; replay cursors are monotonic and pagination is bounded', () => withStore(dir => {
  const store = new RelayRoomStore(dir)
  create(store)
  store.grant({ ...identity, actorPeerId: 'alice', targetPeerId: 'bob', role: 'editor' })
  const a = append(store, 'bob', update('bob', 3))
  const b = append(store, 'bob', update('bob', 2))
  assert.equal(a.cursor + 1, b.cursor)
  const page = store.read({ ...identity, authenticatedPeerId: 'alice', afterCursor: 0, limit: 2 })
  assert.equal(page.updates.length, 2)
  assert.equal(store.read({ ...identity, authenticatedPeerId: 'alice', afterCursor: page.nextCursor }).updates.length, 1)
  assert.throws(() => append(store, 'bob', { ...update('bob', 4), epoch: 2 }), /scope|epoch|room/i)
  assert.throws(() => store.createRoom({ ...identity, epoch: 2, ownerPeerId: 'alice', initialUpdate: { ...update('alice', 1), epoch: 2 } }), /epoch|reset|existing/i)
  store.close()
}))

test('quota and malformed frames fail without committing an update', () => withStore(dir => {
  const store = new RelayRoomStore(dir, { maxDocumentBytes: 2 })
  create(store)
  store.grant({ ...identity, actorPeerId: 'alice', targetPeerId: 'bob', role: 'editor' })
  append(store, 'bob')
  assert.throws(() => append(store, 'bob', update('bob', 2)), /quota|budget|limit/i)
  assert.throws(() => append(store, 'bob', { ...update('bob', 3), payload: '!@' }), /payload|encoding/i)
  assert.equal(read(store, 'alice').updates.length, 2)
  store.close()
}))

test('multiple SQLite handles serialize deduplication and observe committed revocations', () => withStore(dir => {
  const storeA = new RelayRoomStore(dir)
  const storeB = new RelayRoomStore(dir)
  create(storeA)
  storeA.grant({ ...identity, actorPeerId: 'alice', targetPeerId: 'bob', role: 'editor' })
  const a = append(storeA, 'bob')
  const b = append(storeB, 'bob')
  assert.equal(a.cursor, b.cursor)
  storeB.grant({ ...identity, actorPeerId: 'alice', targetPeerId: 'bob', role: 'revoked' })
  assert.throws(() => append(storeA, 'bob', update('bob', 2)), /revoked|permission/i)
  storeA.close(); storeB.close()
}))

test('corrupt persistent data refuses opening rather than silently resetting history', () => withStore(dir => {
  writeFileSync(join(dir, 'rooms.sqlite'), 'not a sqlite database')
  assert.throws(() => new RelayRoomStore(dir), /database|malformed|corrupt|file is not/i)
}))


test('replay page stays under two MiB without skipping updates or changing cursors', () => withStore(dir => {
  const store = new RelayRoomStore(dir)
  create(store)
  const large = Buffer.alloc(240_000, 7).toString('base64')
  for (let seq = 2; seq <= 12; seq++) append(store, 'alice', update('alice', seq, 'vault_a', large))
  const page1 = read(store, 'alice')
  assert.ok(page1.updates.length < 12, 'one replay page must not include all large updates')
  assert.ok(page1.updates.reduce((size, row) => size + Buffer.from(row.update.payload, 'base64').length, 0) <= 2 * 1024 * 1024)
  const page2 = read(store, 'alice', page1.nextCursor)
  assert.equal(page1.updates.length + page2.updates.length, 12)
  assert.equal(page2.updates[0].cursor, page1.nextCursor + 1)
  store.close()
}))

test('unsafe world-readable storage directory is rejected without changing its permissions', () => withStore(dir => {
  chmodSync(dir, 0o755)
  assert.throws(() => new RelayRoomStore(dir), /private|permission|unsafe/i)
}))
