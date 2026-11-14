/** One-time Ed25519 identity challenge; authenticated transport still pending. */
import { createPublicKey, randomBytes, verify as verifySignature } from 'node:crypto'

const IDENTIFIER = /^[A-Za-z0-9_-]{1,160}$/
const PROTOCOL = 'scriptor.live.auth.v1'

function scopeOf(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid authentication scope')
  const { roomId, documentId, epoch, peerId } = value
  if (![roomId, documentId, peerId].every(id => typeof id === 'string' && IDENTIFIER.test(id)) ||
      !Number.isSafeInteger(epoch) || epoch < 1) throw new Error('Invalid authentication scope')
  return { roomId, documentId, epoch, peerId }
}

/**
 * Verification consumes the challenge even on failure, making a bad proof
 * unable to race a later correct proof using the same nonce.
 *
 * lookupRegisteredKey must check the *current* owner-approved peer key in
 * persistent room membership, and must reject revoked/unknown members.
 * The returned identity may be used by a trusted transport to call room-store
 * functions; never accept an authenticatedPeerId straight from client JSON.
 */
export class PeerChallengeBroker {
  #pending = new Map()
  #lookup
  #now
  #ttlMs
  #maxPending

  constructor({ lookupRegisteredKey, now = Date.now, ttlMs = 30_000, maxPending = 256 } = {}) {
    if (typeof lookupRegisteredKey !== 'function' || typeof now !== 'function' ||
        !Number.isSafeInteger(ttlMs) || ttlMs < 1000 || ttlMs > 60_000 ||
        !Number.isSafeInteger(maxPending) || maxPending < 1 || maxPending > 1024) {
      throw new Error('Invalid authentication broker settings')
    }
    this.#lookup = lookupRegisteredKey
    this.#now = now
    this.#ttlMs = ttlMs
    this.#maxPending = maxPending
  }

  issue(untrustedScope) {
    const scope = scopeOf(untrustedScope)
    const now = this.#now()
    for (const [id, item] of this.#pending) {
      if (item.expiresAt <= now) this.#pending.delete(id)
    }
    if (this.#pending.size >= this.#maxPending) throw new Error('Pending authentication challenge limit exceeded')
    const challengeId = randomBytes(24).toString('base64url')
    const expiresAt = now + this.#ttlMs
    const challenge = [PROTOCOL, scope.roomId, scope.documentId, scope.epoch,
      scope.peerId, challengeId, randomBytes(32).toString('base64url'), expiresAt].join('\n')
    this.#pending.set(challengeId, { scope, challenge, expiresAt })
    return { challengeId, challenge, expiresAt }
  }

  verify(proof) {
    if (!proof || typeof proof !== 'object' || Array.isArray(proof) ||
        Object.keys(proof).some(key => !['challengeId', 'signature'].includes(key)) ||
        typeof proof.challengeId !== 'string') throw new Error('Invalid authentication proof scope')
    const attempt = this.#pending.get(proof.challengeId)
    if (!attempt) throw new Error('Unknown or already used authentication challenge')
    this.#pending.delete(proof.challengeId)
    if (attempt.expiresAt <= this.#now()) throw new Error('Authentication challenge expired')
    if (typeof proof.signature !== 'string' || !/^[A-Za-z0-9_-]{86}$/.test(proof.signature)) {
      throw new Error('Invalid authentication signature encoding')
    }
    const bytes = Buffer.from(proof.signature, 'base64url')
    if (bytes.length !== 64 || bytes.toString('base64url') !== proof.signature) {
      throw new Error('Invalid authentication signature encoding')
    }
    const registeredKey = this.#lookup(attempt.scope)
    if (!registeredKey) throw new Error('Peer has no current registered public key or was revoked')
    let publicKey
    try {
      publicKey = createPublicKey(registeredKey)
      if (publicKey.asymmetricKeyType !== 'ed25519') throw new Error('Unsupported public key algorithm')
    } catch {
      throw new Error('Registered peer public key is invalid')
    }
    if (!verifySignature(null, Buffer.from(attempt.challenge, 'utf8'), publicKey, bytes)) {
      throw new Error('Authentication signature denied')
    }
    return {
      roomId: attempt.scope.roomId,
      documentId: attempt.scope.documentId,
      epoch: attempt.scope.epoch,
      authenticatedPeerId: attempt.scope.peerId,
    }
  }

  clear() { this.#pending.clear() }
}
