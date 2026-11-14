import * as Y from 'yjs'
import {
  MAX_LIVE_DOCUMENT_BYTES,
  MAX_LIVE_UPDATE_BYTES,
  parseLiveCollaborationScope,
  type LiveCollaborationScope,
} from './liveCollaborationProtocol.ts'

export interface PreparedCollaborationChange {
  readonly update: Uint8Array
}

export interface RemoteCollaborationAuthor {
  roomId: string
  documentId: string
  epoch: number
  peerId: string
}

const MAX_INITIAL_CHUNK_BYTES = 120 * 1024
const MAX_SEED_FRAMES = 256
const encoder = new TextEncoder()
const originForBootstrap = Symbol('trusted-owner-bootstrap')
const originForRemote = Symbol('authenticated-remote-update')
const validPeerId = /^[A-Za-z0-9_-]{1,160}$/

function checkedUpdate(value: unknown): Uint8Array {
  if (!(value instanceof Uint8Array) || value.byteLength === 0
    || value.byteLength > MAX_LIVE_UPDATE_BYTES) {
    throw new Error('Invalid or oversized collaboration CRDT update')
  }
  return value
}

function checkedText(markdown: unknown): asserts markdown is string {
  if (typeof markdown !== 'string' || encoder.encode(markdown).byteLength > MAX_LIVE_DOCUMENT_BYTES) {
    throw new Error('Collaboration document exceeds the 2 MiB limit')
  }
}

/**
 * Pure, transport-independent Yjs text model. Not a network client and not an
 * editor binding: the caller MUST durably append each locally returned update
 * to the native journal before sending it, and MUST hydrate only from the
 * authenticated room's seed/replay. No editor can be enabled prior to hydration.
 */
export class CollaborativeMarkdown {
  private readonly scope: LiveCollaborationScope
  private readonly localOrigin = Symbol('local-author-transaction')
  private doc: Y.Doc | null = null
  private undoManager: Y.UndoManager | null = null
  private disposed = false
  private staged: { view: PreparedCollaborationChange; bytes: Uint8Array } | null = null

  constructor(scope: LiveCollaborationScope) {
    this.scope = parseLiveCollaborationScope(scope)
  }

  get ready(): boolean {
    return !this.disposed && this.doc !== null
  }

  /** Verify a locally approved model is bound to the same native vault lease. */
  boundScope(): LiveCollaborationScope {
    return { ...this.scope }
  }

  get value(): string {
    return this.activeDoc().getText('markdown').toString()
  }

  /** Mutable Y.Text is only for a future journal-aware editor binding. */
  sharedText(): Y.Text {
    return this.activeDoc().getText('markdown')
  }

  private activeDoc(): Y.Doc {
    if (this.disposed) throw new Error('Collaboration text session has been disposed')
    if (!this.doc) throw new Error('Authenticated collaboration seed is not ready')
    return this.doc
  }

  private adopt(doc: Y.Doc): void {
    if (this.disposed) throw new Error('Collaboration text session has been disposed')
    if (this.doc) throw new Error('Collaboration seed already initialized')
    const text = doc.getText('markdown')
    checkedText(text.toString())
    this.doc = doc
    this.undoManager = new Y.UndoManager(text, {
      trackedOrigins: new Set([this.localOrigin]),
      captureTimeout: 0,
    })
  }

  /**
   * The room owner creates one canonical bootstrap. Other authors must hydrate
   * from this exact authenticated state, never seed a second copy of the file.
   * Chunking keeps every update under the 256 KiB relay limit.
   */
  initializeOwner(markdown: string): Uint8Array[] {
    if (this.disposed) throw new Error('Collaboration text session has been disposed')
    if (this.doc) throw new Error('Collaboration seed already initialized')
    checkedText(markdown)
    const candidate = new Y.Doc()
    const text = candidate.getText('markdown')
    const updates: Uint8Array[] = []
    const onUpdate = (update: Uint8Array) => {
      updates.push(checkedUpdate(update))
    }
    candidate.on('update', onUpdate)
    try {
      let chunk = ''
      let byteLength = 0
      const appendChunk = () => {
        if (!chunk) return
        const data = chunk
        candidate.transact(() => text.insert(text.length, data), originForBootstrap)
        chunk = ''
        byteLength = 0
      }
      for (const character of markdown) {
        const size = encoder.encode(character).byteLength
        if (byteLength + size > MAX_INITIAL_CHUNK_BYTES) appendChunk()
        chunk += character
        byteLength += size
      }
      appendChunk()
      if (!updates.length) updates.push(checkedUpdate(Y.encodeStateAsUpdate(candidate)))
      if (updates.length > MAX_SEED_FRAMES) throw new Error('Too many collaboration bootstrap frames')
      this.adopt(candidate)
      return updates
    } catch (error) {
      candidate.destroy()
      throw error
    } finally {
      candidate.off('update', onUpdate)
    }
  }

  /** Seeds a joining client atomically from a trusted room history page set. */
  hydrate(updates: Uint8Array[]): void {
    if (this.disposed) throw new Error('Collaboration text session has been disposed')
    if (this.doc) throw new Error('Collaboration seed already initialized')
    if (!Array.isArray(updates) || updates.length === 0 || updates.length > MAX_SEED_FRAMES) {
      throw new Error('Invalid authenticated collaboration bootstrap')
    }
    const candidate = new Y.Doc()
    try {
      for (const update of updates) Y.applyUpdate(candidate, checkedUpdate(update), originForRemote)
      this.adopt(candidate)
    } catch (error) {
      candidate.destroy()
      throw error
    }
  }

  private capture(action: () => void): Uint8Array {
    const doc = this.activeDoc()
    const updates: Uint8Array[] = []
    const observer = (update: Uint8Array, origin: unknown) => {
      if (origin === this.localOrigin || origin === this.undoManager) updates.push(update)
    }
    doc.on('update', observer)
    try {
      action()
    } finally {
      doc.off('update', observer)
    }
    if (!updates.length) return new Uint8Array()
    return checkedUpdate(updates.length === 1 ? updates[0] : Y.mergeUpdates(updates))
  }

  /**
   * Produce a Yjs update against a temporary copy. The active editor text is
   * untouched until the native FULL/WAL append confirms local durability.
   * Only one stage is permitted; an ambiguous append must retry these bytes.
   */
  prepareChange(from: number, to: number, insert: string): PreparedCollaborationChange | null {
    const doc = this.activeDoc()
    if (this.staged) throw new Error('A collaboration update is pending durable retry')
    const text = doc.getText('markdown')
    if (!Number.isSafeInteger(from) || !Number.isSafeInteger(to) ||
      from < 0 || from > to || to > text.length) {
      throw new Error('Invalid CRDT edit range')
    }
    if (typeof insert !== 'string' || encoder.encode(insert).byteLength > MAX_INITIAL_CHUNK_BYTES) {
      throw new Error('CRDT edit insertion exceeds the bounded transaction')
    }
    const before = text.toString()
    const after = before.slice(0, from) + insert + before.slice(to)
    checkedText(after)
    if (after === before) return null

    const replica = new Y.Doc()
    try {
      Y.applyUpdate(replica, Y.encodeStateAsUpdate(doc), originForRemote)
      const candidate = replica.getText('markdown')
      replica.transact(() => {
        if (to > from) candidate.delete(from, to - from)
        if (insert) candidate.insert(from, insert)
      }, this.localOrigin)
      checkedText(candidate.toString())
      const update = checkedUpdate(Y.encodeStateAsUpdate(replica, Y.encodeStateVector(doc)))
      const view: PreparedCollaborationChange = Object.freeze({ update: new Uint8Array(update) })
      this.staged = { view, bytes: new Uint8Array(update) }
      return view
    } finally {
      replica.destroy()
    }
  }

  /** Apply only the exact update previously acknowledged by the native journal. */
  commitPrepared(prepared: PreparedCollaborationChange): void {
    const doc = this.activeDoc()
    const stage = this.staged
    if (!stage || stage.view !== prepared || !prepared.update ||
      prepared.update.byteLength !== stage.bytes.byteLength ||
      prepared.update.some((byte, index) => byte !== stage.bytes[index])) {
      throw new Error('Prepared collaboration update identity or payload mismatch')
    }
    // Remote edits may have arrived during the native commit. Check the merged
    // materialized size before applying the locally accepted staged update.
    const probe = new Y.Doc()
    try {
      Y.applyUpdate(probe, Y.encodeStateAsUpdate(doc), originForRemote)
      Y.applyUpdate(probe, stage.bytes, originForRemote)
      checkedText(probe.getText('markdown').toString())
    } finally {
      probe.destroy()
    }
    Y.applyUpdate(doc, stage.bytes, this.localOrigin)
    this.staged = null
  }

  /** UTF-16 offsets match CodeMirror and Monaco model positions. */
  change(from: number, to: number, insert: string): Uint8Array {
    const doc = this.activeDoc()
    if (this.staged) throw new Error('A collaboration update is pending durable retry')
    const text = doc.getText('markdown')
    if (!Number.isSafeInteger(from) || !Number.isSafeInteger(to)
      || from < 0 || from > to || to > text.length) throw new Error('Invalid CRDT edit range')
    if (typeof insert !== 'string' || encoder.encode(insert).byteLength > MAX_INITIAL_CHUNK_BYTES) {
      throw new Error('CRDT edit insertion exceeds one bounded transaction')
    }
    const prior = text.toString()
    checkedText(prior.slice(0, from) + insert + prior.slice(to))
    return this.capture(() => {
      doc.transact(() => {
        if (to > from) text.delete(from, to - from)
        if (insert) text.insert(from, insert)
      }, this.localOrigin)
    })
  }

  /** Accept updates only from a previously authenticated room session. */
  applyRemote(update: Uint8Array, author: RemoteCollaborationAuthor): void {
    const doc = this.activeDoc()
    if (!author || author.roomId !== this.scope.roomId ||
      author.documentId !== this.scope.documentId || author.epoch !== this.scope.epoch ||
      typeof author.peerId !== 'string' || !validPeerId.test(author.peerId)) {
      throw new Error('Collaboration scope mismatch: wrong remote room, document or epoch')
    }
    checkedUpdate(update)
    // Validate and check materialized size in an isolated copy so an invalid
    // remote payload cannot partially mutate an acknowledged local document.
    const probe = new Y.Doc()
    try {
      Y.applyUpdate(probe, Y.encodeStateAsUpdate(doc), originForRemote)
      Y.applyUpdate(probe, update, originForRemote)
      checkedText(probe.getText('markdown').toString())
    } finally {
      probe.destroy()
    }
    Y.applyUpdate(doc, update, originForRemote)
  }

  stateVector(): Uint8Array {
    return Y.encodeStateVector(this.activeDoc())
  }

  /** Returns a bounded update; large catch-up must use cursor-paged replay. */
  diff(otherStateVector: Uint8Array): Uint8Array {
    if (!(otherStateVector instanceof Uint8Array)
      || otherStateVector.byteLength > MAX_LIVE_UPDATE_BYTES) {
      throw new Error('Invalid collaboration state vector')
    }
    return checkedUpdate(Y.encodeStateAsUpdate(this.activeDoc(), otherStateVector))
  }

  undo(): Uint8Array | null {
    const manager = this.undoManager
    this.activeDoc()
    if (!manager) throw new Error('Local undo manager is not initialized')
    const update = this.capture(() => { manager.undo() })
    return update.byteLength > 0 ? update : null
  }

  redo(): Uint8Array | null {
    const manager = this.undoManager
    this.activeDoc()
    if (!manager) throw new Error('Local redo manager is not initialized')
    const update = this.capture(() => { manager.redo() })
    return update.byteLength > 0 ? update : null
  }

  close(): void {
    if (this.disposed) return
    this.disposed = true
    this.staged = null
    this.undoManager?.destroy()
    this.doc?.destroy()
    this.undoManager = null
    this.doc = null
  }
}
