import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { generateKeyPairSync, sign } from 'node:crypto'
import { once } from 'node:events'
import { chmodSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { WebSocket } from 'ws'
import { CollaborativeMarkdown } from '../../../src/lib/liveCollaborationYjs.ts'
import { RelayRoomStore } from '../src/room-store.mjs'
import { startRelayServer } from '../src/server.mjs'

const room = { roomId: 'room_crdt_e2e', documentId: 'doc_crdt_e2e', epoch: 1 }
const localScope = peerId => ({ ...room, vaultId: 'local_' + peerId, peerId })
const peer = peerId => ({ ...room, peerId })
const publicKey = pair => pair.publicKey.export({ format: 'pem', type: 'spki' })

function inbox(socket) {
  const buffered = []
  const pending = []
  socket.on('message', raw => {
    const message = JSON.parse(raw.toString())
    const index = pending.findIndex(entry => entry.type === message.type)
    if (index < 0) { buffered.push(message); return }
    const [entry] = pending.splice(index, 1)
    clearTimeout(entry.timer)
    entry.resolve(message)
  })
  return {
    take(type) {
      const index = buffered.findIndex(message => message.type === type)
      if (index >= 0) return Promise.resolve(buffered.splice(index, 1)[0])
      return new Promise((resolve, reject) => {
        const entry = { type, resolve, timer: null }
        entry.timer = setTimeout(() => {
          const index = pending.indexOf(entry)
          if (index >= 0) pending.splice(index, 1)
          reject(new Error('Timed out waiting for authenticated relay ' + type))
        }, 5000)
        pending.push(entry)
      })
    },
  }
}

async function connect(url, name, keyPair) {
  // Self-signed certificate is for this loopback test only, never production.
  const socket = new WebSocket(url, 'scriptor-live-v1', { rejectUnauthorized: false })
  await once(socket, 'open')
  const received = inbox(socket)
  socket.send(JSON.stringify({ type: 'hello', scope: peer(name) }))
  const challenge = await received.take('challenge')
  assert.equal(challenge.type, 'challenge')
  socket.send(JSON.stringify({
    type: 'proof',
    challengeId: challenge.challengeId,
    signature: sign(null, Buffer.from(challenge.challenge), keyPair.privateKey).toString('base64url'),
  }))
  assert.equal((await received.take('ready')).type, 'ready')
  return { socket, received }
}

function frame(name, sequence, update) {
  return {
    version: 1, kind: 'LOCAL_UPDATE', ...localScope(name),
    messageId: name + '_crdt_' + sequence,
    clientSeq: sequence,
    payload: Buffer.from(update).toString('base64'),
  }
}

test('three authenticated WSS clients converge through durable Yjs replay and relay restart', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'scriptor-yjs-wss-'))
  const keys = Object.fromEntries(['alice', 'bob', 'carol'].map(name => [name, generateKeyPairSync('ed25519')]))
  const texts = Object.fromEntries(['alice', 'bob', 'carol'].map(name => [name, new CollaborativeMarkdown(localScope(name))]))
  const peers = {}
  let store, server
  try {
    const keyPath = join(dir, 'tls-key.pem')
    const certPath = join(dir, 'tls-cert.pem')
    const generated = spawnSync('openssl', [
      'req', '-x509', '-newkey', 'rsa:2048', '-nodes',
      '-keyout', keyPath, '-out', certPath, '-subj', '/CN=localhost', '-days', '1',
    ], { stdio: 'ignore' })
    assert.equal(generated.status, 0, 'OpenSSL is required for the real TLS fixture')
    chmodSync(keyPath, 0o600)
    const initial = 'start سلام 👩🏽‍💻'
    const seeds = texts.alice.initializeOwner(initial)
    assert.equal(seeds.length, 1, 'small source should have one immutable room seed')
    store = new RelayRoomStore(join(dir, 'database'))
    store.createRoom({
      ...room, ownerPeerId: 'alice', ownerPublicKey: publicKey(keys.alice),
      initialUpdate: frame('alice', 1, seeds[0]),
    })
    for (const name of ['bob', 'carol']) {
      store.grant({
        ...room, actorPeerId: 'alice', targetPeerId: name, role: 'editor',
        publicKey: publicKey(keys[name]),
      })
    }
    const start = async () => {
      server = await startRelayServer({
        store, host: '127.0.0.1', port: 0, tls: { keyPath, certPath },
      })
      return 'wss://127.0.0.1:' + server.address().port + '/v1/live'
    }
    const url = await start()
    for (const name of ['alice', 'bob', 'carol']) peers[name] = await connect(url, name, keys[name])
    // Joining peers hydrate through authenticated room replay.
    for (const name of ['bob', 'carol']) {
      const waiting = peers[name].received.take('updates')
      peers[name].socket.send(JSON.stringify({ type: 'sync', afterCursor: 0 }))
      const page = await waiting
      assert.equal(page.updates.length, 1)
      assert.equal(page.updates[0].messageId, 'alice_crdt_1')
      assert.equal('vaultId' in page.updates[0], false)
      texts[name].hydrate(page.updates.map(item => Buffer.from(item.payload, 'base64')))
      assert.equal(texts[name].value, initial)
    }
    // All three edits are generated from the original state before any peer
    // applies another author's update, making them causally concurrent.
    const offset = initial.length
    const edits = {
      alice: texts.alice.change(offset, offset, ' A'),
      bob: texts.bob.change(offset, offset, ' B'),
      carol: texts.carol.change(offset, offset, ' C'),
    }
    const ackWaiters = Object.fromEntries(['alice', 'bob', 'carol'].map(name => [
      name, peers[name].received.take('ack'),
    ]))
    const broadcasts = Object.fromEntries(['alice', 'bob', 'carol'].map(name => [
      name, Promise.all([peers[name].received.take('update'), peers[name].received.take('update')]),
    ]))
    for (const name of ['alice', 'bob', 'carol']) {
      peers[name].socket.send(JSON.stringify({
        type: 'update', update: frame(name, name === 'alice' ? 2 : 1, edits[name]),
      }))
    }
    const cursors = []
    for (const name of ['alice', 'bob', 'carol']) {
      const ack = await ackWaiters[name]
      assert.equal(ack.type, 'ack')
      assert.equal(ack.durable, true)
      assert.equal(ack.duplicate, false)
      assert.ok(ack.cursor > 1)
      cursors.push(ack.cursor)
    }
    for (const name of ['alice', 'bob', 'carol']) {
      const remote = await broadcasts[name]
      assert.equal(remote.length, 2)
      for (const update of remote) {
        assert.equal('vaultId' in update, false, 'local vault identity must not leave the relay')
        texts[name].applyRemote(Buffer.from(update.payload, 'base64'), peer(update.peerId))
      }
    }
    assert.equal(texts.alice.value, texts.bob.value)
    assert.equal(texts.bob.value, texts.carol.value)
    for (const part of [' A', ' B', ' C', 'سلام', '👩🏽‍💻']) {
      assert.ok(texts.alice.value.includes(part), part + ' missing after convergence')
    }

    // Carol disconnects; only Alice and Bob receive a later update.
    const closed = once(peers.carol.socket, 'close')
    peers.carol.socket.terminate()
    await closed
    const priorCursor = Math.max(...cursors)
    const extra = texts.alice.change(texts.alice.value.length, texts.alice.value.length, ' offline')
    const ackPending = peers.alice.received.take('ack')
    const bobPending = peers.bob.received.take('update')
    peers.alice.socket.send(JSON.stringify({ type: 'update', update: frame('alice', 3, extra) }))
    assert.equal((await ackPending).durable, true)
    const next = await bobPending
    texts.bob.applyRemote(Buffer.from(next.payload, 'base64'), peer(next.peerId))

    // Reopen both the relay and SQLite database to verify durable recovery.
    for (const name of ['alice', 'bob']) peers[name].socket.terminate()
    await server.close()
    server = null
    store.close()
    store = new RelayRoomStore(join(dir, 'database'))
    const restartedUrl = await start()
    peers.carol = await connect(restartedUrl, 'carol', keys.carol)
    const waiting = peers.carol.received.take('updates')
    peers.carol.socket.send(JSON.stringify({ type: 'sync', afterCursor: priorCursor }))
    const replay = await waiting
    assert.equal(replay.updates.length, 1)
    assert.equal(replay.updates[0].peerId, 'alice')
    texts.carol.applyRemote(Buffer.from(replay.updates[0].payload, 'base64'), peer(replay.updates[0].peerId))
    assert.equal(texts.alice.value, texts.bob.value)
    assert.equal(texts.bob.value, texts.carol.value)
    assert.match(texts.carol.value, /offline$/)
  } finally {
    for (const connection of Object.values(peers)) connection?.socket?.terminate()
    if (server) await server.close()
    store?.close()
    for (const model of Object.values(texts)) model.close()
    rmSync(dir, { recursive: true, force: true })
  }
})
