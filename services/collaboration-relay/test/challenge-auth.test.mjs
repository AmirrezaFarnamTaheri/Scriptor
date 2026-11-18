import assert from 'node:assert/strict'
import { generateKeyPairSync, sign } from 'node:crypto'
import test from 'node:test'
import { PeerChallengeBroker } from '../src/challenge-auth.mjs'

const scope = { roomId: 'room_one', documentId: 'doc_one', epoch: 1, peerId: 'alice' }
const alice = generateKeyPairSync('ed25519')
const mallory = generateKeyPairSync('ed25519')
const alicePublic = alice.publicKey.export({ type: 'spki', format: 'pem' })
const registered = new Map([['alice', alicePublic]])
const lookupRegisteredKey = ({ peerId }) => registered.get(peerId) ?? null
const signed = (challenge, key = alice.privateKey) => sign(null, Buffer.from(challenge, 'utf8'), key).toString('base64url')

test('a registered Ed25519 signer proves room, document, epoch and peer identity', () => {
  const broker = new PeerChallengeBroker({ lookupRegisteredKey })
  const issued = broker.issue(scope)
  const identity = broker.verify({ challengeId: issued.challengeId, signature: signed(issued.challenge) })
  assert.deepEqual(identity, { roomId: scope.roomId, documentId: scope.documentId, epoch: 1, authenticatedPeerId: 'alice' })
})

test('same proof is one-time and a forged signature cannot retry the challenge', () => {
  const broker = new PeerChallengeBroker({ lookupRegisteredKey })
  const issued = broker.issue(scope)
  assert.throws(() => broker.verify({ challengeId: issued.challengeId, signature: signed(issued.challenge, mallory.privateKey) }), /signature|denied/i)
  assert.throws(() => broker.verify({ challengeId: issued.challengeId, signature: signed(issued.challenge) }), /unknown|expired|used/i)
})

test('proof cannot be used to impersonate another peer or another document', () => {
  const broker = new PeerChallengeBroker({ lookupRegisteredKey })
  const issued = broker.issue(scope)
  assert.throws(() => broker.verify({ challengeId: issued.challengeId, signature: signed(issued.challenge), scope: { ...scope, documentId: 'different' } }), /scope|unexpected|invalid/i)
})

test('revocation of a registered key blocks completion of a previously issued challenge', () => {
  const revoked = new Map(registered)
  const broker = new PeerChallengeBroker({ lookupRegisteredKey: ({ peerId }) => revoked.get(peerId) ?? null })
  const issued = broker.issue(scope)
  revoked.delete('alice')
  assert.throws(() => broker.verify({ challengeId: issued.challengeId, signature: signed(issued.challenge) }), /registered|denied|revoked/i)
})

test('expired challenges are rejected and the queue limit is enforced', () => {
  let now = 1000
  const broker = new PeerChallengeBroker({ lookupRegisteredKey, now: () => now, ttlMs: 2000, maxPending: 1 })
  const issued = broker.issue(scope)
  assert.throws(() => broker.issue(scope), /limit|budget/i)
  now += 2001
  assert.throws(() => broker.verify({ challengeId: issued.challengeId, signature: signed(issued.challenge) }), /expired|unknown/i)
  assert.ok(broker.issue(scope).challengeId)
})

test('unknown peers and malformed encoded proofs are never admitted', () => {
  const broker = new PeerChallengeBroker({ lookupRegisteredKey })
  const unknown = broker.issue({ ...scope, peerId: 'stranger' })
  assert.throws(() => broker.verify({ challengeId: unknown.challengeId, signature: signed(unknown.challenge) }), /registered|denied|unknown/i)
  const issued = broker.issue(scope)
  assert.throws(() => broker.verify({ challengeId: issued.challengeId, signature: '$$$' }), /signature|invalid/i)
})

test('a valid signature for one challenge cannot satisfy a second room challenge', () => {
  const broker = new PeerChallengeBroker({ lookupRegisteredKey })
  const first = broker.issue(scope)
  const second = broker.issue({ ...scope, roomId: 'room_two' })
  assert.throws(() => broker.verify({ challengeId: second.challengeId, signature: signed(first.challenge) }), /signature|denied/i)
  assert.deepEqual(broker.verify({ challengeId: first.challengeId, signature: signed(first.challenge) }), {
    roomId: scope.roomId, documentId: scope.documentId, epoch: 1, authenticatedPeerId: 'alice',
  })
})
