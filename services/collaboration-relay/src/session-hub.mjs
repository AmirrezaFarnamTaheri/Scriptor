/**
 * Authenticated WebSocket session policy and relay message routing.
 *
 * A transport passes only live WebSocket objects to accept(). We NEVER accept
 * peer identities from a message when invoking the SQLite authority. Every
 * read/write/grant rechecks the current role and public key in durable state.
 * A durable ACK is sent only after RelayRoomStore.append has committed.
 */
import { TextDecoder } from 'node:util'
import { PeerChallengeBroker } from './challenge-auth.mjs'
import { parseLiveCollaborationEnvelope } from '../../../src/lib/liveCollaborationProtocol.ts'

const MAX_INBOUND_FRAME_BYTES = 512 * 1024
const MAX_OUTBOUND_BACKLOG_BYTES = 4 * 1024 * 1024
const PEER_PATTERN = /^[A-Za-z0-9_-]{1,160}$/
const MAX_LIMIT = 100
const UTF8 = new TextDecoder('utf-8', { fatal: true })

function object(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid relay message')
  return value
}
function keys(value, permitted) {
  if (Object.keys(value).some(key => !permitted.includes(key))) throw new Error('Unknown relay message field')
}
function scope(value) {
  const input = object(value)
  keys(input, ['roomId', 'documentId', 'epoch', 'peerId'])
  if (!PEER_PATTERN.test(input.roomId) || !PEER_PATTERN.test(input.documentId) ||
    !PEER_PATTERN.test(input.peerId) || !Number.isSafeInteger(input.epoch) || input.epoch < 1) {
    throw new Error('Invalid collaboration scope')
  }
  return { roomId: input.roomId, documentId: input.documentId, epoch: input.epoch, peerId: input.peerId }
}
function scopeId(value) { return [value.roomId, value.documentId, value.epoch].join('\n') }
function updateForWire(value, cursor) {
  // The originating vault ID is a private local mapping, not remote room identity.
  return { cursor, peerId: value.peerId, messageId: value.messageId,
    clientSeq: value.clientSeq, payload: value.payload }
}
function boundMessage(data, isBinary) {
  if (isBinary === true) throw new Error('Binary relay frames are not supported')
  let text
  if (typeof data === 'string') {
    if (Buffer.byteLength(data, 'utf8') > MAX_INBOUND_FRAME_BYTES) throw new RangeError('Oversized relay frame')
    text = data
  } else if (Buffer.isBuffer(data) || data instanceof Uint8Array) {
    if (data.byteLength > MAX_INBOUND_FRAME_BYTES) throw new RangeError('Oversized relay frame')
    text = UTF8.decode(data)
  } else throw new Error('Invalid relay frame')
  if (!text || text.charCodeAt(0) !== 123) throw new Error('Invalid relay frame')
  const value = object(JSON.parse(text))
  if (typeof value.type !== 'string') throw new Error('Missing relay message type')
  return value
}

export class RelaySessionHub {
  #connections = new Set()
  #store
  #broker
  #maxSessions
  #handshakeTimeoutMs
  #closed = false

  constructor({ store, maxSessions = 256, handshakeTimeoutMs = 30_000, broker } = {}) {
    if (!store || typeof store.append !== 'function' || typeof store.read !== 'function' ||
        typeof store.getRegisteredKey !== 'function' || !Number.isSafeInteger(maxSessions) ||
        maxSessions < 1 || maxSessions > 4096 || !Number.isSafeInteger(handshakeTimeoutMs) ||
        handshakeTimeoutMs < 1 || handshakeTimeoutMs > 60_000) throw new Error('Invalid relay hub configuration')
    this.#store = store
    this.#maxSessions = maxSessions
    this.#handshakeTimeoutMs = handshakeTimeoutMs
    this.#broker = broker ?? new PeerChallengeBroker({ lookupRegisteredKey: identity =>
      store.getRegisteredKey(identity) })
  }

  accept(socket) {
    if (this.#closed || this.#connections.size >= this.#maxSessions) {
      socket.close(1013, 'Relay busy')
      return
    }
    const session = {
      socket, phase: 'new', scope: null, challengeId: null,
      key: null, closed: false, handshakeTimer: null,
    }
    this.#connections.add(session)
    session.handshakeTimer = setTimeout(() => {
      if (session.phase !== 'ready') this.#reject(session, 1008)
    }, this.#handshakeTimeoutMs)
    session.handshakeTimer.unref?.()
    const cleanup = () => {
      clearTimeout(session.handshakeTimer)
      session.closed = true
      this.#connections.delete(session)
    }
    socket.on('close', cleanup)
    socket.on('error', cleanup)
    socket.on('message', (data, isBinary) => {
      if (session.closed) return
      try { this.#handle(session, boundMessage(data, isBinary)) }
      catch (error) {
        this.#reject(session, error instanceof RangeError ? 1009 : 1008)
      }
    })
  }

  #send(session, payload) {
    if (session.closed || (session.socket.readyState !== undefined && session.socket.readyState !== 1)) return false
    if (typeof session.socket.bufferedAmount === 'number' &&
        session.socket.bufferedAmount > MAX_OUTBOUND_BACKLOG_BYTES) {
      this.#reject(session, 1009)
      return false
    }
    try { session.socket.send(JSON.stringify(payload)); return true }
    catch { this.#reject(session, 1011); return false }
  }

  #reject(session, code = 1008) {
    if (session.closed) return
    session.closed = true
    clearTimeout(session.handshakeTimer)
    this.#connections.delete(session)
    try { session.socket.close(code, code === 1009 ? 'Message too large' : code === 1000 ? 'Normal closure' : 'Policy violation') }
    catch { try { session.socket.terminate?.() } catch { /* Socket is already unusable. */ } }
  }

  #currentRole(session) {
    const { roomId, documentId, epoch, peerId } = session.scope
    const identity = { roomId, documentId, epoch, peerId }
    const role = this.#store.getRole(identity)
    const key = this.#store.getRegisteredKey(identity)
    if (!role || !key || key !== session.key) throw new Error('Session membership revoked or key rotated')
    return role
  }

  #readyPeers(session) {
    const id = scopeId(session.scope)
    return [...this.#connections].filter(other => other !== session && !other.closed &&
      other.phase === 'ready' && scopeId(other.scope) === id)
  }

  #broadcast(session, message) {
    for (const other of this.#readyPeers(session)) {
      try { this.#currentRole(other) }
      catch { this.#reject(other); continue }
      this.#send(other, message)
    }
  }

  #handle(session, value) {
    if (session.phase === 'new') {
      keys(value, ['type', 'scope'])
      if (value.type !== 'hello') throw new Error('Hello required')
      const expected = scope(value.scope)
      if (!this.#store.getRegisteredKey(expected)) throw new Error('Unknown or unapproved peer')
      session.scope = expected
      const challenge = this.#broker.issue(expected)
      session.challengeId = challenge.challengeId
      session.phase = 'challenged'
      this.#send(session, { type: 'challenge', ...challenge })
      return
    }
    if (session.phase === 'challenged') {
      keys(value, ['type', 'challengeId', 'signature'])
      if (value.type !== 'proof' || value.challengeId !== session.challengeId) throw new Error('Wrong challenge')
      const authenticated = this.#broker.verify({ challengeId: value.challengeId, signature: value.signature })
      if (authenticated.authenticatedPeerId !== session.scope.peerId ||
          authenticated.roomId !== session.scope.roomId ||
          authenticated.documentId !== session.scope.documentId ||
          authenticated.epoch !== session.scope.epoch) throw new Error('Challenge crossed sessions')
      const role = this.#store.getRole(session.scope)
      const key = this.#store.getRegisteredKey(session.scope)
      if (!role || !key) throw new Error('Authorization revoked')
      session.key = key
      session.challengeId = null
      session.phase = 'ready'
      clearTimeout(session.handshakeTimer)
      this.#send(session, { type: 'ready', role, scope: session.scope })
      return
    }
    if (session.phase !== 'ready') throw new Error('Invalid session phase')
    const role = this.#currentRole(session)
    const { roomId, documentId, epoch, peerId } = session.scope
    if (value.type === 'sync') {
      keys(value, ['type', 'afterCursor', 'limit'])
      const page = this.#store.read({ roomId, documentId, epoch, authenticatedPeerId: peerId,
        afterCursor: value.afterCursor, limit: value.limit ?? MAX_LIMIT })
      this.#send(session, { type: 'updates', updates: page.updates.map(row => updateForWire(row.update, row.cursor)),
        nextCursor: page.nextCursor })
      return
    }
    if (value.type === 'update') {
      keys(value, ['type', 'update'])
      if (role === 'viewer') throw new Error('Viewers cannot update')
      const receipt = this.#store.append({ roomId, documentId, epoch,
        authenticatedPeerId: peerId, update: value.update })
      const update = parseLiveCollaborationEnvelope(value.update, {
        vaultId: value.update?.vaultId, roomId, documentId, epoch, peerId,
      })
      this.#send(session, { type: 'ack', messageId: update.messageId, clientSeq: update.clientSeq,
        cursor: receipt.cursor, durable: receipt.durable, duplicate: receipt.duplicate })
      if (!receipt.duplicate) this.#broadcast(session, { type: 'update', ...updateForWire(update, receipt.cursor) })
      return
    }
    if (value.type === 'grant') {
      keys(value, ['type', 'targetPeerId', 'role', 'publicKey'])
      if (role !== 'owner') throw new Error('Only the owner can change permissions')
      const receipt = this.#store.grant({ roomId, documentId, epoch, actorPeerId: peerId,
        targetPeerId: value.targetPeerId, role: value.role, publicKey: value.publicKey })
      this.#send(session, { type: 'granted', peerId: receipt.peerId, role: receipt.role, durable: true })
      for (const other of this.#readyPeers(session)) {
        if (other.scope.peerId !== receipt.peerId) continue
        try { this.#currentRole(other) }
        catch { this.#send(other, { type: 'revoked' }); this.#reject(other) }
      }
      return
    }
    if (value.type === 'awareness') {
      keys(value, ['type', 'update'])
      const incoming = parseLiveCollaborationEnvelope(value.update, {
        vaultId: value.update?.vaultId, roomId, documentId, epoch, peerId,
      })
      if (incoming.kind !== 'AWARENESS') throw new Error('Awareness frame type mismatch')
      this.#broadcast(session, { type: 'awareness', peerId, payload: incoming.payload })
      return
    }
    if (value.type === 'leave') {
      keys(value, ['type'])
      this.#reject(session, 1000)
      return
    }
    throw new Error('Unsupported relay operation')
  }

  close() {
    if (this.#closed) return
    this.#closed = true
    this.#broker.clear()
    for (const session of [...this.#connections]) this.#reject(session, 1001)
  }
}
