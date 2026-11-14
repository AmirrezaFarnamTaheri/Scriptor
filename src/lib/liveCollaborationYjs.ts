import * as Y from 'yjs'
import {
  MAX_LIVE_DOCUMENT_BYTES,
  MAX_LIVE_UPDATE_BYTES,
  parseLiveCollaborationScope,
  type LiveCollaborationScope,
} from './liveCollaborationProtocol.ts'

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

  constructor(scope: LiveCollaborationScope) {
    this.scope = parseLiveCollaborationScope(scope)
  }

  get ready(): boolean {
    return !this.disposed && this.doc !== null
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

  /** UTF-16 offsets match CodeMirror and Monaco model positions. */
  change(from: number, to: number, insert: string): Uint8Array {
    const doc = this.activeDoc()
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
    this.undoManager?.destroy()
    this.doc?.destroy()
    this.undoManager = null
    this.doc = null
  }
}
