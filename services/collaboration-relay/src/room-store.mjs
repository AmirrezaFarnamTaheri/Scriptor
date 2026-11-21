/**
 * Transactional persistence layer for a future authenticated collaboration relay.
 *
 * This module is intentionally NOT a network listener or an authentication
 * boundary. Every authenticatedPeerId argument must come from a verified
 * challenge-response session, never from an untrusted WebSocket message.
 * SQLite WAL with synchronous=FULL commits before durable receipts are returned.
 */
import { DatabaseSync } from 'node:sqlite'
import { createPublicKey } from 'node:crypto'
import { chmodSync, existsSync, lstatSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import {
  MAX_LIVE_UPDATE_BYTES,
  parseLiveCollaborationEnvelope,
  parseLiveCollaborationScope,
} from '../../../src/lib/liveCollaborationProtocol.ts'

const IDENTIFIER = /^[A-Za-z0-9_-]{1,160}$/
const DEFAULT_MAX_DOCUMENT_BYTES = 128 * 1024 * 1024
const READ_PAGE_LIMIT = 100
const MAX_REPLAY_PAGE_BYTES = 2 * 1024 * 1024

function identifier(value, label) {
  if (typeof value !== 'string' || !IDENTIFIER.test(value)) {
    throw new Error(`Invalid ${label}`)
  }
  return value
}

function roomIdentity(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid room identity')
  const { roomId, documentId, epoch } = value
  identifier(roomId, 'room ID')
  identifier(documentId, 'document ID')
  if (!Number.isSafeInteger(epoch) || epoch < 1) throw new Error('Invalid room epoch')
  return { roomId, documentId, epoch }
}

function expectAuthenticatedPeer(id) {
  return identifier(id, 'authenticated peer identity')
}

/** Store canonical public SPKI only; never accept private key material or EC/RSA keys. */
function normalizePublicKey(value) {
  if (value === undefined) return null
  if (typeof value !== 'string' || value.length > 1024 || value.length < 60 ||
      !value.startsWith('-----BEGIN PUBLIC KEY-----')) throw new Error('Invalid Ed25519 public key')
  try {
    const parsed = createPublicKey(value)
    if (parsed.asymmetricKeyType !== 'ed25519') throw new Error('Wrong public key algorithm')
    return parsed.export({ format: 'pem', type: 'spki' }).toString()
  } catch { throw new Error('Invalid Ed25519 public key') }
}

/** The creator must supply the exact local CRDT update to seed the new room. */
function parseScopedUpdate(value, scope, authenticatedPeerId) {
  const sender = parseLiveCollaborationScope(value)
  return parseLiveCollaborationEnvelope(value, {
    ...sender,
    ...scope,
    peerId: authenticatedPeerId,
  })
}

function payloadBytes(encoded) {
  return encoded.length / 4 * 3 - (encoded.endsWith('==') ? 2 : encoded.endsWith('=') ? 1 : 0)
}

export class RelayRoomStore {
  #db
  #closed = false
  #maxDocumentBytes

  constructor(directory, { maxDocumentBytes = DEFAULT_MAX_DOCUMENT_BYTES } = {}) {
    if (!Number.isSafeInteger(maxDocumentBytes) || maxDocumentBytes < 1 || maxDocumentBytes > DEFAULT_MAX_DOCUMENT_BYTES) {
      throw new Error('Invalid relay document quota')
    }
    this.#maxDocumentBytes = maxDocumentBytes
    mkdirSync(directory, { recursive: true, mode: 0o700 })
    const storage = lstatSync(directory)
    if (!storage.isDirectory() || storage.isSymbolicLink() || (storage.mode & 0o077) !== 0) {
      throw new Error('Relay storage must be a private real directory (mode 0700)')
    }
    const dbPath = join(directory, 'rooms.sqlite')
    if (existsSync(dbPath) && (!lstatSync(dbPath).isFile() || lstatSync(dbPath).isSymbolicLink())) {
      throw new Error('Unsafe relay database location')
    }
    this.#db = new DatabaseSync(dbPath)
    try {
      this.#db.exec(`
        PRAGMA foreign_keys=ON;
        PRAGMA journal_mode=WAL;
        PRAGMA synchronous=FULL;
        PRAGMA busy_timeout=5000;
        PRAGMA trusted_schema=OFF;
        CREATE TABLE IF NOT EXISTS rooms (
          room_id TEXT NOT NULL,
          document_id TEXT NOT NULL,
          epoch INTEGER NOT NULL,
          owner_peer_id TEXT NOT NULL,
          PRIMARY KEY(room_id, document_id, epoch)
        );
        CREATE TABLE IF NOT EXISTS members (
          room_id TEXT NOT NULL,
          document_id TEXT NOT NULL,
          epoch INTEGER NOT NULL,
          peer_id TEXT NOT NULL,
          role TEXT NOT NULL CHECK (role IN ('owner','editor','viewer','revoked')),
          PRIMARY KEY(room_id, document_id, epoch, peer_id),
          FOREIGN KEY(room_id, document_id, epoch)
            REFERENCES rooms(room_id, document_id, epoch)
        );
        CREATE TABLE IF NOT EXISTS member_keys (
          room_id TEXT NOT NULL,
          document_id TEXT NOT NULL,
          epoch INTEGER NOT NULL,
          peer_id TEXT NOT NULL,
          public_key TEXT NOT NULL,
          PRIMARY KEY(room_id, document_id, epoch, peer_id),
          FOREIGN KEY(room_id, document_id, epoch, peer_id)
            REFERENCES members(room_id, document_id, epoch, peer_id)
        );
        CREATE TABLE IF NOT EXISTS updates (
          cursor INTEGER PRIMARY KEY AUTOINCREMENT,
          room_id TEXT NOT NULL,
          document_id TEXT NOT NULL,
          epoch INTEGER NOT NULL,
          peer_id TEXT NOT NULL,
          message_id TEXT NOT NULL,
          client_seq INTEGER NOT NULL,
          payload TEXT NOT NULL,
          payload_bytes INTEGER NOT NULL,
          UNIQUE(room_id, document_id, epoch, peer_id, message_id),
          UNIQUE(room_id, document_id, epoch, peer_id, client_seq),
          FOREIGN KEY(room_id, document_id, epoch)
            REFERENCES rooms(room_id, document_id, epoch)
        );
        CREATE INDEX IF NOT EXISTS updates_room_cursor
          ON updates(room_id, document_id, epoch, cursor);
        CREATE TABLE IF NOT EXISTS room_byte_totals (
          room_id TEXT NOT NULL,
          document_id TEXT NOT NULL,
          epoch INTEGER NOT NULL,
          total INTEGER NOT NULL CHECK (total >= 0),
          PRIMARY KEY(room_id, document_id, epoch),
          FOREIGN KEY(room_id, document_id, epoch)
            REFERENCES rooms(room_id, document_id, epoch) ON DELETE CASCADE
        );
      `)
      const check = this.#db.prepare('PRAGMA quick_check').get()
      if (!check || check.quick_check !== 'ok') throw new Error('Relay database integrity check failed')
      chmodSync(dbPath, 0o600)
    } catch (error) {
      this.#db.close()
      throw error
    }
  }

  #ensureOpen() {
    if (this.#closed) throw new Error('Relay store is closed')
  }

  #transaction(fn) {
    this.#ensureOpen()
    this.#db.exec('BEGIN IMMEDIATE')
    try {
      const outcome = fn()
      // With WAL + synchronous FULL this commit is the durable boundary.
      this.#db.exec('COMMIT')
      return outcome
    } catch (error) {
      try { this.#db.exec('ROLLBACK') } catch { /* Original storage failure is authoritative. */ }
      throw error
    }
  }

  #room(scope) {
    return this.#db.prepare(`SELECT owner_peer_id FROM rooms
      WHERE room_id=? AND document_id=? AND epoch=?`)
      .get(scope.roomId, scope.documentId, scope.epoch)
  }

  #role(scope, authenticatedPeerId) {
    const member = this.#db.prepare(`SELECT role FROM members
      WHERE room_id=? AND document_id=? AND epoch=? AND peer_id=?`)
      .get(scope.roomId, scope.documentId, scope.epoch, authenticatedPeerId)
    if (!member || member.role === 'revoked') throw new Error('Collaboration permission denied or revoked')
    return member.role
  }

  #append(scope, peerId, update) {
    const existing = this.#db.prepare(`SELECT cursor, client_seq, payload FROM updates
      WHERE room_id=? AND document_id=? AND epoch=? AND peer_id=? AND message_id=?`)
      .get(scope.roomId, scope.documentId, scope.epoch, peerId, update.messageId)
    if (existing) {
      if (existing.client_seq !== update.clientSeq || existing.payload !== update.payload) {
        throw new Error('Duplicate message identity has different content')
      }
      return { cursor: existing.cursor, durable: true, duplicate: true }
    }
    const competing = this.#db.prepare(`SELECT message_id FROM updates
      WHERE room_id=? AND document_id=? AND epoch=? AND peer_id=? AND client_seq=?`)
      .get(scope.roomId, scope.documentId, scope.epoch, peerId, update.clientSeq)
    if (competing) throw new Error('Client sequence is already used for a different update')
    const bytes = payloadBytes(update.payload)
    if (bytes < 1 || bytes > MAX_LIVE_UPDATE_BYTES) throw new Error('Update exceeds payload limit')
    // Every new update is inside BEGIN IMMEDIATE. A persisted counter avoids
    // rescanning an unbounded edit history on the synchronous write path.
    // Existing databases lazily backfill the counter once from their history.
    let quota = this.#db.prepare(`SELECT total FROM room_byte_totals
      WHERE room_id=? AND document_id=? AND epoch=?`)
      .get(scope.roomId, scope.documentId, scope.epoch)
    if (!quota) {
      const total = this.#db.prepare(`SELECT COALESCE(SUM(payload_bytes),0) AS total FROM updates
        WHERE room_id=? AND document_id=? AND epoch=?`)
        .get(scope.roomId, scope.documentId, scope.epoch).total
      this.#db.prepare('INSERT INTO room_byte_totals VALUES (?,?,?,?)')
        .run(scope.roomId, scope.documentId, scope.epoch, total)
      quota = { total }
    }
    if (quota.total + bytes > this.#maxDocumentBytes) throw new Error('Relay document quota exceeded')
    const inserted = this.#db.prepare(`INSERT INTO updates
      (room_id, document_id, epoch, peer_id, message_id, client_seq, payload, payload_bytes)
      VALUES (?,?,?,?,?,?,?,?)`)
      .run(scope.roomId, scope.documentId, scope.epoch, peerId, update.messageId, update.clientSeq, update.payload, bytes)
    this.#db.prepare(`UPDATE room_byte_totals SET total=total+?
      WHERE room_id=? AND document_id=? AND epoch=?`)
      .run(bytes, scope.roomId, scope.documentId, scope.epoch)
    return { cursor: Number(inserted.lastInsertRowid), durable: true, duplicate: false }
  }

  createRoom({ ownerPeerId, ownerPublicKey, initialUpdate, ...scopeValue }) {
    const scope = roomIdentity(scopeValue)
    const owner = expectAuthenticatedPeer(ownerPeerId)
    const key = normalizePublicKey(ownerPublicKey)
    const update = parseScopedUpdate(initialUpdate, scope, owner)
    if (update.kind !== 'LOCAL_UPDATE') throw new Error('Room bootstrap requires a local CRDT update')
    return this.#transaction(() => {
      const otherEpoch = this.#db.prepare(`SELECT epoch FROM rooms
        WHERE room_id=? AND document_id=? AND epoch<>?`)
        .get(scope.roomId, scope.documentId, scope.epoch)
      if (otherEpoch) throw new Error('Existing room epoch cannot be reset implicitly')
      const current = this.#room(scope)
      if (current) {
        if (current.owner_peer_id !== owner) throw new Error('Existing room has another owner')
        if (key && this.getRegisteredKey({ ...scope, peerId: owner }) !== key) {
          throw new Error('Existing owner key cannot change during room bootstrap')
        }
        const duplicate = this.#appendDuplicateOnly(scope, owner, update)
        if (!duplicate) throw new Error('Existing room bootstrap does not match saved history')
        return duplicate
      }
      this.#db.prepare('INSERT INTO rooms VALUES (?,?,?,?)')
        .run(scope.roomId, scope.documentId, scope.epoch, owner)
      this.#db.prepare('INSERT INTO members VALUES (?,?,?,?,?)')
        .run(scope.roomId, scope.documentId, scope.epoch, owner, 'owner')
      if (key) this.#db.prepare('INSERT INTO member_keys VALUES (?,?,?,?,?)')
        .run(scope.roomId, scope.documentId, scope.epoch, owner, key)
      return this.#append(scope, owner, update)
    })
  }

  #appendDuplicateOnly(scope, peerId, update) {
    const saved = this.#db.prepare(`SELECT cursor, client_seq, payload FROM updates
      WHERE room_id=? AND document_id=? AND epoch=? AND peer_id=? AND message_id=?`)
      .get(scope.roomId, scope.documentId, scope.epoch, peerId, update.messageId)
    if (!saved || saved.client_seq !== update.clientSeq || saved.payload !== update.payload) return null
    return { cursor: saved.cursor, durable: true, duplicate: true }
  }

  grant({ actorPeerId, targetPeerId, role, publicKey, ...scopeValue }) {
    const scope = roomIdentity(scopeValue)
    const actor = expectAuthenticatedPeer(actorPeerId)
    const target = expectAuthenticatedPeer(targetPeerId)
    if (!['viewer', 'editor', 'revoked'].includes(role)) throw new Error('Invalid grant role')
    if (role === 'revoked' && publicKey !== undefined) throw new Error('A revoked peer cannot register a new public key')
    const key = normalizePublicKey(publicKey)
    return this.#transaction(() => {
      const current = this.#room(scope)
      if (!current || current.owner_peer_id !== actor) throw new Error('Only the room owner can change grants')
      if (target === actor) throw new Error('Owner membership cannot be removed or replaced')
      this.#db.prepare(`INSERT INTO members(room_id,document_id,epoch,peer_id,role) VALUES(?,?,?,?,?)
        ON CONFLICT(room_id,document_id,epoch,peer_id) DO UPDATE SET role=excluded.role`)
        .run(scope.roomId, scope.documentId, scope.epoch, target, role)
      if (key) this.#db.prepare(`INSERT INTO member_keys(room_id,document_id,epoch,peer_id,public_key) VALUES(?,?,?,?,?)
        ON CONFLICT(room_id,document_id,epoch,peer_id) DO UPDATE SET public_key=excluded.public_key`)
        .run(scope.roomId, scope.documentId, scope.epoch, target, key)
      return { peerId: target, role, durable: true }
    })
  }

  /** Current ACL is read from SQLite for every caller (including active sockets). */
  getRole({ peerId, ...scopeValue }) {
    const scope = roomIdentity(scopeValue)
    const peer = expectAuthenticatedPeer(peerId)
    this.#ensureOpen()
    const row = this.#db.prepare(`SELECT role FROM members
      WHERE room_id=? AND document_id=? AND epoch=? AND peer_id=?`)
      .get(scope.roomId, scope.documentId, scope.epoch, peer)
    return row && row.role !== 'revoked' ? row.role : null
  }

  /** Only the trusted relay authentication layer calls this lookup. */
  getRegisteredKey({ peerId, ...scopeValue }) {
    const scope = roomIdentity(scopeValue)
    const peer = expectAuthenticatedPeer(peerId)
    this.#ensureOpen()
    const row = this.#db.prepare(`SELECT m.role,k.public_key FROM members m
      LEFT JOIN member_keys k ON k.room_id=m.room_id AND k.document_id=m.document_id
        AND k.epoch=m.epoch AND k.peer_id=m.peer_id
      WHERE m.room_id=? AND m.document_id=? AND m.epoch=? AND m.peer_id=?`)
      .get(scope.roomId, scope.documentId, scope.epoch, peer)
    return row && row.role !== 'revoked' ? row.public_key ?? null : null
  }

  append({ authenticatedPeerId, update: value, ...scopeValue }) {
    const scope = roomIdentity(scopeValue)
    const peer = expectAuthenticatedPeer(authenticatedPeerId)
    const update = parseScopedUpdate(value, scope, peer)
    if (update.kind !== 'LOCAL_UPDATE') throw new Error('Only local update frames can be appended')
    return this.#transaction(() => {
      const role = this.#role(scope, peer)
      if (role !== 'owner' && role !== 'editor') throw new Error('Viewer cannot append collaboration updates')
      return this.#append(scope, peer, update)
    })
  }

  read({ authenticatedPeerId, afterCursor = 0, limit = READ_PAGE_LIMIT, ...scopeValue }) {
    const scope = roomIdentity(scopeValue)
    const peer = expectAuthenticatedPeer(authenticatedPeerId)
    if (!Number.isSafeInteger(afterCursor) || afterCursor < 0 || !Number.isSafeInteger(limit) || limit < 1 || limit > READ_PAGE_LIMIT) {
      throw new Error('Invalid replay cursor or page limit')
    }
    this.#ensureOpen()
    // Membership is read from SQLite on each request; no stale cached grants.
    this.#role(scope, peer)
    // Bound the total response, not only each individual update. Select cursors
    // before loading payloads to avoid materializing a 25 MiB replay page.
    const candidates = this.#db.prepare(`SELECT cursor,payload_bytes FROM updates
      WHERE room_id=? AND document_id=? AND epoch=? AND cursor>?
      ORDER BY cursor ASC LIMIT ?`)
      .all(scope.roomId, scope.documentId, scope.epoch, afterCursor, limit)
    let pageBytes = 0
    let finalCursor = afterCursor
    for (const item of candidates) {
      if (pageBytes + item.payload_bytes > MAX_REPLAY_PAGE_BYTES) break
      pageBytes += item.payload_bytes
      finalCursor = item.cursor
    }
    const rows = finalCursor === afterCursor ? [] : this.#db.prepare(`SELECT cursor,peer_id,message_id,client_seq,payload FROM updates
      WHERE room_id=? AND document_id=? AND epoch=? AND cursor>? AND cursor<=?
      ORDER BY cursor ASC`)
      .all(scope.roomId, scope.documentId, scope.epoch, afterCursor, finalCursor)
    return {
      updates: rows.map(row => ({
        cursor: row.cursor,
        update: { version: 1, kind: 'SYNC_UPDATE', ...scope,
          peerId: row.peer_id, messageId: row.message_id, clientSeq: row.client_seq, payload: row.payload },
      })),
      nextCursor: rows.length ? rows[rows.length - 1].cursor : afterCursor,
    }
  }

  close() {
    if (this.#closed) return
    this.#closed = true
    this.#db.close()
  }
}
