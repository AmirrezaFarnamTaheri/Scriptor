import assert from 'node:assert/strict'
import { generateKeyPairSync } from 'node:crypto'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { RelayRoomStore } from '../src/room-store.mjs'

const room = { roomId: 'room_one', documentId: 'doc_one', epoch: 1 }
const key = () => generateKeyPairSync('ed25519').publicKey.export({ format: 'pem', type: 'spki' })
const initialUpdate = { ...room, vaultId: 'vault_local', peerId: 'owner', version: 1, kind: 'LOCAL_UPDATE', messageId: 'seed_1', clientSeq: 1, payload: 'aGk=' }
function run(fn) {
  const dir = mkdtempSync(join(tmpdir(), 'scriptor-key-test-'))
  try { return fn(dir) } finally { rmSync(dir, { recursive: true, force: true }) }
}

test('a registered owner key survives a durable store restart', () => run(dir => {
  const publicKey = key()
  let store = new RelayRoomStore(dir)
  store.createRoom({ ...room, ownerPeerId: 'owner', ownerPublicKey: publicKey, initialUpdate })
  assert.equal(store.getRegisteredKey({ ...room, peerId: 'owner' }), publicKey)
  store.close()
  store = new RelayRoomStore(dir)
  assert.equal(store.getRegisteredKey({ ...room, peerId: 'owner' }), publicKey)
  assert.equal(store.getRole({ ...room, peerId: 'owner' }), 'owner')
  store.close()
}))

test('an owner grants a verified editor key, rotates it and revokes it atomically', () => run(dir => {
  const store = new RelayRoomStore(dir)
  const ownerPublicKey = key(), oldKey = key(), newKey = key()
  store.createRoom({ ...room, ownerPeerId: 'owner', ownerPublicKey, initialUpdate })
  store.grant({ ...room, actorPeerId: 'owner', targetPeerId: 'bob', role: 'editor', publicKey: oldKey })
  assert.equal(store.getRegisteredKey({ ...room, peerId: 'bob' }), oldKey)
  store.grant({ ...room, actorPeerId: 'owner', targetPeerId: 'bob', role: 'editor', publicKey: newKey })
  assert.equal(store.getRegisteredKey({ ...room, peerId: 'bob' }), newKey)
  store.grant({ ...room, actorPeerId: 'owner', targetPeerId: 'bob', role: 'viewer' })
  assert.equal(store.getRegisteredKey({ ...room, peerId: 'bob' }), newKey)
  assert.equal(store.getRole({ ...room, peerId: 'bob' }), 'viewer')
  store.grant({ ...room, actorPeerId: 'owner', targetPeerId: 'bob', role: 'revoked' })
  assert.equal(store.getRegisteredKey({ ...room, peerId: 'bob' }), null)
  assert.equal(store.getRole({ ...room, peerId: 'bob' }), null)
  store.close()
}))

test('invalid public keys and key rotation by nonowner do not change membership', () => run(dir => {
  const store = new RelayRoomStore(dir)
  store.createRoom({ ...room, ownerPeerId: 'owner', ownerPublicKey: key(), initialUpdate })
  assert.throws(() => store.grant({ ...room, actorPeerId: 'owner', targetPeerId: 'bob', role: 'editor', publicKey: 'not-a-key' }), /public key/i)
  assert.equal(store.getRole({ ...room, peerId: 'bob' }), null)
  const bobKey = key()
  store.grant({ ...room, actorPeerId: 'owner', targetPeerId: 'bob', role: 'editor', publicKey: bobKey })
  assert.throws(() => store.grant({ ...room, actorPeerId: 'bob', targetPeerId: 'bob', role: 'editor', publicKey: key() }), /owner/i)
  assert.equal(store.getRegisteredKey({ ...room, peerId: 'bob' }), bobKey)
  store.close()
}))

test('room identity and non-registered legacy grants never authenticate', () => run(dir => {
  const store = new RelayRoomStore(dir)
  store.createRoom({ ...room, ownerPeerId: 'owner', initialUpdate })
  store.grant({ ...room, actorPeerId: 'owner', targetPeerId: 'bob', role: 'editor' })
  assert.equal(store.getRegisteredKey({ ...room, peerId: 'owner' }), null)
  assert.equal(store.getRegisteredKey({ ...room, peerId: 'bob' }), null)
  assert.equal(store.getRegisteredKey({ ...room, documentId: 'other', peerId: 'owner' }), null)
  store.close()
}))
