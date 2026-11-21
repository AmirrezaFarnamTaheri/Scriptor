import assert from 'node:assert/strict'
import { generateKeyPairSync, sign } from 'node:crypto'
import { once } from 'node:events'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { RelayRoomStore } from '../src/room-store.mjs'
import { startRelayServer } from '../src/server.mjs'
import { writeTestTlsFixture } from './tls-fixture.mjs'

// The root runner installs the exact locked ws dependency in CI. Keep the
// dependency-free protocol tests runnable in offline/container scratchspaces.
const wsPackage = await import('ws').catch(() => null)

function receive(ws) {
  return Promise.race([
    once(ws, 'message').then(([data]) => JSON.parse(data.toString())),
    new Promise((_, reject) => setTimeout(() => reject(new Error('WebSocket message timeout')), 5000)),
  ])
}
async function connect(url, peerId, pair) {
  const ws = new wsPackage.WebSocket(url, 'scriptor-live-v1', { rejectUnauthorized: false })
  await once(ws, 'open')
  const challengePromise = receive(ws)
  ws.send(JSON.stringify({ type: 'hello', scope: { roomId: 'room_a', documentId: 'doc_a', epoch: 1, peerId } }))
  const challenge = await challengePromise
  assert.equal(challenge.type, 'challenge')
  const readyPromise = receive(ws)
  ws.send(JSON.stringify({ type: 'proof', challengeId: challenge.challengeId,
    signature: sign(null, Buffer.from(challenge.challenge), pair.privateKey).toString('base64url') }))
  assert.equal((await readyPromise).type, 'ready')
  return ws
}

test('WSS server routes authenticated updates and persists them before ACK',
  { skip: !wsPackage }, async () => {
  const dir = mkdtempSync(join(tmpdir(), 'scriptor-real-wss-'))
  const alice = generateKeyPairSync('ed25519')
  const bob = generateKeyPairSync('ed25519')
  const pem = pair => pair.publicKey.export({ type: 'spki', format: 'pem' })
  const scope = { roomId: 'room_a', documentId: 'doc_a', epoch: 1 }
  const seed = { version: 1, kind: 'LOCAL_UPDATE', ...scope,
    vaultId: 'vault_a', peerId: 'alice', messageId: 'seed', clientSeq: 1, payload: 'c2VlZA==' }
  let store, server, wsA, wsB
  try {
    const { keyPath: tlsKey, certPath: tlsCert } = writeTestTlsFixture(dir)
    store = new RelayRoomStore(join(dir, 'room-store'))
    store.createRoom({ ...scope, ownerPeerId: 'alice', ownerPublicKey: pem(alice), initialUpdate: seed })
    store.grant({ ...scope, actorPeerId: 'alice', targetPeerId: 'bob', role: 'editor', publicKey: pem(bob) })
    server = await startRelayServer({ store, host: '127.0.0.1', port: 0,
      tls: { keyPath: tlsKey, certPath: tlsCert } })
    const url = `wss://127.0.0.1:${server.address().port}/v1/live`
    wsA = await connect(url, 'alice', alice)
    wsB = await connect(url, 'bob', bob)
    const incoming = receive(wsA)
    const receiptPromise = receive(wsB)
    wsB.send(JSON.stringify({ type: 'update', update: { ...seed, peerId: 'bob', vaultId: 'vault_b', messageId: 'bob_1', payload: 'aGk=', clientSeq: 1 } }))
    const receipt = await receiptPromise
    assert.equal(receipt.type, 'ack')
    assert.equal(receipt.durable, true)
    assert.equal(receipt.duplicate, false)
    const delivered = await incoming
    assert.equal(delivered.type, 'update')
    assert.equal(delivered.payload, 'aGk=')
    assert.equal('vaultId' in delivered, false)
    const syncPromise = receive(wsA)
    wsA.send(JSON.stringify({type:'sync',afterCursor:0}))
    const history = await syncPromise
    assert.deepEqual(history.updates.map(x => x.messageId), ['seed', 'bob_1'])
  } finally {
    wsA?.terminate(); wsB?.terminate()
    if (server) await server.close()
    store?.close()
    rmSync(dir, { recursive:true, force:true })
  }
})
